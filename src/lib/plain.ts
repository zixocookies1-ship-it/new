/**
 * Server → Client serialisation guard.
 *
 * React can only pass *plain* values across the Server Component boundary. A
 * MongoDB document — even a `.lean()` one — carries a BSON `ObjectId` in `_id`,
 * and `ObjectId` is a class instance, so React refuses it and logs:
 *
 *   "Only plain objects can be passed to Client Components from Server
 *    Components. Objects with toJSON methods are not supported."
 *
 * The bug is invisible at the type level: `Types.ObjectId` is declared, the
 * value is present, the render succeeds. It only shows up as a console error.
 *
 * Everything in `src/lib/catalog.ts` already builds string-id view models, so
 * the exposure is limited to the singleton documents that get handed straight to
 * a client component (`BusinessSettingsDoc`, `ShippingConfigurationDoc`).
 * `toPlain()` is the one place that normalises them, so a future field cannot
 * silently reintroduce the problem.
 *
 * Client-safe: no `server-only`, no Node built-ins.
 */

/** BSON `ObjectId` in both the `bson` package and mongoose's re-export. */
function isObjectId(value: object): value is { toHexString(): string } {
  return (
    typeof (value as { toHexString?: unknown }).toHexString === 'function' &&
    typeof (value as { _bsontype?: unknown })._bsontype === 'string'
  );
}

function isDecimal(value: object): value is { toString(): string } {
  return typeof (value as { _bsontype?: unknown })._bsontype === 'Decimal128';
}

function isBinary(value: object): boolean {
  return typeof (value as { _bsontype?: unknown })._bsontype === 'Binary';
}

function walk(value: unknown, seen: WeakMap<object, unknown>): unknown {
  if (value === null || typeof value !== 'object') return value;

  // Dates are a supported React prop type — pass them through as Dates.
  if (value instanceof Date) return value;

  if (Array.isArray(value)) return value.map((item) => walk(item, seen));

  const existing = seen.get(value);
  if (existing !== undefined) return existing;

  if (isObjectId(value)) return value.toHexString();
  if (isDecimal(value)) return Number(value.toString());
  if (isBinary(value)) return String((value as { buffer?: unknown }).toString());
  if (value instanceof Map) {
    const out: Record<string, unknown> = {};
    for (const [k, v] of value) out[String(k)] = walk(v, seen);
    return out;
  }
  if (value instanceof Set) return [...value].map((v) => walk(v, seen));

  // Anything still non-plain (a class instance, a Buffer) becomes a string
  // rather than silently reaching React and failing there.
  const proto = Object.getPrototypeOf(value);
  if (proto !== Object.prototype && proto !== null) {
    const buf = (value as { toString?: () => string }).toString;
    return typeof buf === 'function' ? buf.call(value) : String(value);
  }

  const out: Record<string, unknown> = {};
  seen.set(value, out);
  for (const [key, item] of Object.entries(value)) {
    if (key === '__v' || key.startsWith('$')) continue; // Mongoose internals.
    if (item === undefined) continue;
    out[key] = walk(item, seen);
  }
  return out;
}

/**
 * Deep-copy `value` into a structure React can serialise.
 *
 * BSON ids become their hex string, `Decimal128` becomes a number, and Mongoose
 * internals (`__v`, `$`-prefixed keys) are dropped. The return type matches the
 * input so call sites stay readable; the one honest difference is that an `_id`
 * typed as `Types.ObjectId` is a string at runtime, so never use it as anything
 * but an opaque identifier on the client.
 */
export function toPlain<T>(value: T): T {
  return walk(value, new WeakMap()) as T;
}