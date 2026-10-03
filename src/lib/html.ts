/**
 * HTML text escaping.
 *
 * Any value that reaches a template string must pass through this first. Order
 * data contains customer-supplied text (names, addresses, notes, coupon codes)
 * and is rendered inside an HTML document, so an unescaped `<` or `&` would let
 * a customer inject markup into the invoice or any server-rendered page.
 */

const HTML_ENTITIES: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
};

const HTML_ESCAPE_RE = /[&<>"']/g;

export function escapeHtml(value: unknown): string {
  if (value === null || value === undefined) return '';
  return String(value).replace(HTML_ESCAPE_RE, (ch) => HTML_ENTITIES[ch] ?? ch);
}