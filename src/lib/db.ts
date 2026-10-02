import 'server-only';

import mongooseImport, { type Mongoose } from 'mongoose';
import { serverEnv } from './env';

/**
 * Single cached Mongoose connection per mongoose *instance*.
 *
 * ── Why the cache is keyed on the mongoose object, not on `globalThis` ────────
 *
 * Next's dev server compiles each route into its own server bundle, so a single
 * process can end up holding several copies of the `mongoose` module. Each copy
 * has its own model registry and its own default connection, but they all share
 * one `globalThis`.
 *
 * A `globalThis`-keyed cache is therefore actively harmful: route A connects
 * copy #1 and writes it to the cache, route B reads the cache, decides it is
 * already connected, and then issues `Bundle.find()` against copy #2 — which has
 * never been connected. With `bufferCommands: false` that is a hard
 *
 *   "Cannot call `bundles.find()` before initial connection is complete"
 *
 * on the first database access of every freshly compiled route, followed by a
 * `notFound()` page and a silent 500 from the API.
 *
 * Keying the cache on the mongoose object itself makes each copy cache against
 * exactly the registry its own models live in, so the connection and the models
 * can never disagree. Copies that do share one mongoose object also share one
 * connection, so there is still only a single pool in production, where a route
 * graph is compiled once.
 */

const CACHE_KEY = Symbol.for('nc.mongoose.connectionCache');

type MongooseCache = {
  conn: Mongoose | null;
  promise: Promise<Mongoose> | null;
};

function cacheFor(m: Mongoose): MongooseCache {
  const holder = m as unknown as Record<symbol, MongooseCache | undefined>;
  holder[CACHE_KEY] ??= { conn: null, promise: null };
  return holder[CACHE_KEY] as MongooseCache;
}

export const MONGO_MAX_POOL_SIZE = 10;

export async function connectDb(): Promise<Mongoose> {
  if (!serverEnv.mongodbUri) {
    throw new Error(
      'MONGODB_URI is not configured. Copy .env.example to .env.local and set it.',
    );
  }

  const cache = cacheFor(mongooseImport);

  if (cache.conn === mongooseImport) return cache.conn;

  // Never clear an in-flight connect. On a cold route Next renders the page and
  // `generateMetadata` concurrently, so two callers arrive here at once; if the
  // second one nulled `cache.promise` it would start a second `connect()` and
  // the loser would query a connection that is not open yet.
  cache.promise ??= mongooseImport
    .connect(serverEnv.mongodbUri, {
      dbName: 'natures_choice',
      maxPoolSize: MONGO_MAX_POOL_SIZE,
      minPoolSize: 1,
      serverSelectionTimeoutMS: 8000,
      socketTimeoutMS: 45000,
      // Fail fast rather than queue a query that may never run. Every database
      // entry point awaits `connectDb()`, so this is a genuine bug signal.
      bufferCommands: false,
      autoIndex: process.env.NODE_ENV !== 'production',
    })
    .then((m) => m);

  try {
    cache.conn = await cache.promise;
  } catch (err) {
    cache.promise = null;
    cache.conn = null;
    throw err;
  }

  return cache.conn;
}

export function isDbConnected(): boolean {
  return mongooseImport.connection.readyState === 1;
}

export async function disconnectDb(): Promise<void> {
  const cache = cacheFor(mongooseImport);
  if (cache.promise) await cache.promise.catch(() => undefined);
  cache.promise = null;
  cache.conn = null;
  await mongooseImport.disconnect().catch(() => undefined);
}