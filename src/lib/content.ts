/**
 * Defensive readers for the loosely-typed `Content.items` payload.
 *
 * `Content.items` is a free-form array whose shape is owned by the specific
 * content key. Rather than pretending one rigid type covers every key, pages
 * read through these helpers: every value is coerced to a plain string and any
 * missing field simply yields an empty string, so a half-filled admin record
 * degrades to less copy instead of a render crash.
 */

export type ContentItem = Record<string, unknown>;

export function asText(value: unknown): string {
  if (typeof value === 'string') return value.trim();
  if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  return '';
}

export function itemText(item: ContentItem | undefined, ...keys: string[]): string {
  if (!item) return '';
  for (const key of keys) {
    const value = asText(item[key]);
    if (value) return value;
  }
  return '';
}

export interface ContentItemVM {
  title: string;
  text: string;
  eyebrow: string;
  /** Optional leading character or short token — never an emoji-sprinkle. */
  icon: string;
  href: string;
}

/** Normalise `items[]` into `{title, text}` cards, dropping empty entries. */
export function readCards(items: unknown): ContentItemVM[] {
  if (!Array.isArray(items)) return [];
  const out: ContentItemVM[] = [];
  for (const raw of items) {
    if (!raw || typeof raw !== 'object') continue;
    const item = raw as ContentItem;
    const title = itemText(item, 'title', 'heading', 'label', 'name');
    const text = itemText(item, 'text', 'body', 'description', 'detail');
    const eyebrow = itemText(item, 'eyebrow', 'kicker');
    const icon = itemText(item, 'icon', 'marker');
    const href = itemText(item, 'href', 'url', 'link');
    if (!title && !text) continue;
    out.push({ title, text, eyebrow, icon, href });
  }
  return out;
}

/** Normalise `sections[]` (heading/body/bullet + optional image). */
export function readSections(doc: { sections?: unknown } | null | undefined) {
  if (!doc || !Array.isArray(doc.sections)) return [];
  return doc.sections
    .filter((s): s is Record<string, unknown> => Boolean(s) && typeof s === 'object')
    .map((s) => ({
      heading: itemText(s, 'heading', 'title'),
      body: itemText(s, 'body', 'text'),
      bullet: itemText(s, 'bullet', 'caption'),
      image: (s.image ?? null) as never,
      verified: s.verified === true,
    }))
    .filter((s) => s.heading || s.body || s.bullet);
}