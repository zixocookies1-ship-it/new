import { type ReactNode } from 'react';
import clsx from 'clsx';

/**
 * Minimal, safe long-form renderer for merchant-authored copy.
 *
 * Everything stored in MongoDB (`Content.body`, `Recipe.body`, FAQ answers) is
 * rendered through here. We deliberately do NOT use `dangerouslySetInnerHTML`:
 * the parser only ever produces React elements, so a stray `<script>` in the
 * database is rendered as text and can never execute.
 *
 * Supported markdown-lite:
 *   ## heading / ### heading
 *   - bullet list  /  1. numbered list
 *   > blockquote
 *   | a | b |   (tables, second row = header/alignment rule)
 *   ---          (horizontal rule)
 *   **bold**  *italic*  `code`  [label](https://…)
 */

const INLINE_TOKEN =
  /(\*\*[^*\n]+\*\*|__[^_\n]+__|\*[^*\n]+\*|_[^_\n]+_|`[^`\n]+`|\[[^\]\n]+\]\([^)\s]+\))/g;

function safeHref(raw: string): string | null {
  const url = raw.trim();
  if (/^(https?:|mailto:|tel:)/i.test(url)) return url;
  if (url.startsWith('/') || url.startsWith('#')) return url;
  return null;
}

function renderInline(text: string, keyPrefix: string): ReactNode[] {
  const out: ReactNode[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  let n = 0;

  INLINE_TOKEN.lastIndex = 0;
  while ((match = INLINE_TOKEN.exec(text)) !== null) {
    if (match.index > lastIndex) out.push(text.slice(lastIndex, match.index));
    const token = match[0];
    const key = `${keyPrefix}-i${n++}`;

    const link = /^\[([^\]\n]+)\]\(([^)\s]+)\)$/.exec(token);
    const strong = /^(?:\*\*([^*\n]+)\*\*|__([^_\n]+)__)$/.exec(token);
    const em = /^(?:\*([^*\n]+)\*|_([^_\n]+)_)$/.exec(token);
    const code = /^`([^`\n]+)`$/.exec(token);

    if (link) {
      const href = safeHref(link[2]);
      const label = link[1];
      out.push(
        href ? (
          <a
            key={key}
            href={href}
            {...(href.startsWith('http') ? { rel: 'noopener noreferrer', target: '_blank' } : {})}
          >
            {label}
          </a>
        ) : (
          <span key={key}>{label}</span>
        ),
      );
    } else if (strong) {
      out.push(
        <strong key={key} className="font-semibold text-ink">
          {strong[1] ?? strong[2]}
        </strong>,
      );
    } else if (em) {
      out.push(<em key={key}>{em[1] ?? em[2]}</em>);
    } else if (code) {
      out.push(
        <code key={key} className="rounded bg-cream-200 px-1.5 py-0.5 text-[0.85em] text-jaggery-600">
          {code[1]}
        </code>,
      );
    } else {
      out.push(token);
    }
    lastIndex = match.index + token.length;
  }

  if (lastIndex < text.length) out.push(text.slice(lastIndex));
  return out;
}

type Block =
  | { kind: 'h2' | 'h3' | 'h4'; text: string }
  | { kind: 'p'; text: string }
  | { kind: 'quote'; text: string }
  | { kind: 'hr' }
  | { kind: 'ul' | 'ol'; items: string[] }
  | { kind: 'table'; head: string[]; rows: string[][] };

function splitRow(line: string): string[] {
  return line
    .replace(/^\s*\|/, '')
    .replace(/\|\s*$/, '')
    .split('|')
    .map((c) => c.trim());
}

function parse(md: string): Block[] {
  const lines = md.replace(/\r\n/g, '\n').split('\n');
  const blocks: Block[] = [];

  let paragraph: string[] = [];
  let list: { kind: 'ul' | 'ol'; items: string[] } | null = null;
  let quote: string[] = [];
  let table: { head: string[]; rows: string[][] } | null = null;

  const flushParagraph = () => {
    const text = paragraph.join(' ').trim();
    if (text) blocks.push({ kind: 'p', text });
    paragraph = [];
  };
  const flushList = () => {
    if (list) blocks.push(list);
    list = null;
  };
  const flushQuote = () => {
    const text = quote.join(' ').trim();
    if (text) blocks.push({ kind: 'quote', text });
    quote = [];
  };
  const flushTable = () => {
    if (table) blocks.push({ kind: 'table', head: table.head, rows: table.rows });
    table = null;
  };
  const flushAll = () => {
    flushParagraph();
    flushList();
    flushQuote();
    flushTable();
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();

    if (!line) {
      flushAll();
      continue;
    }

    // --- table row ---------------------------------------------------------
    if (/^\|.*\|$/.test(line)) {
      const cells = splitRow(line);
      const next = lines[i + 1]?.trim() ?? '';
      const isRule = next.includes('-') && /^\|?[\s:|-]+\|[\s:|-]*$/.test(next);
      flushParagraph();
      flushList();
      flushQuote();
      if (isRule) {
        flushTable();
        table = { head: cells, rows: [] };
        i++; // consume the alignment rule
      } else if (table) {
        table.rows.push(cells);
      } else {
        // A table without an explicit header rule still renders its first row
        // as a header rather than silently dropping it.
        table = { head: cells, rows: [] };
      }
      continue;
    }

    if (/^(?:-{3,}|\*{3,}|_{3,})$/.test(line)) {
      flushAll();
      blocks.push({ kind: 'hr' });
      continue;
    }

    const heading = /^(#{2,4})\s+(.*)$/.exec(line);
    if (heading) {
      flushAll();
      const level = heading[1].length;
      blocks.push({
        kind: level === 2 ? 'h2' : level === 3 ? 'h3' : 'h4',
        text: heading[2].trim(),
      });
      continue;
    }

    const quoted = /^>\s?(.*)$/.exec(line);
    if (quoted) {
      flushParagraph();
      flushList();
      flushTable();
      quote.push(quoted[1]);
      continue;
    }

    const bullet = /^[-*+]\s+(.*)$/.exec(line);
    if (bullet) {
      flushParagraph();
      flushQuote();
      flushTable();
      if (!list || list.kind !== 'ul') {
        flushList();
        list = { kind: 'ul', items: [] };
      }
      list.items.push(bullet[1]);
      continue;
    }

    const numbered = /^\d{1,2}[.)]\s+(.*)$/.exec(line);
    if (numbered) {
      flushParagraph();
      flushQuote();
      flushTable();
      if (!list || list.kind !== 'ol') {
        flushList();
        list = { kind: 'ol', items: [] };
      }
      list.items.push(numbered[1]);
      continue;
    }

    flushList();
    flushQuote();
    flushTable();
    paragraph.push(line);
  }

  flushAll();
  return blocks;
}

export function Prose({
  children,
  className = '',
}: {
  children: string | null | undefined;
  className?: string;
}) {
  const source = (children ?? '').trim();
  if (!source) return null;

  const blocks = parse(source);

  return (
    <div className={clsx('nc-prose', className)}>
      {blocks.map((block, index) => {
        const key = `b${index}`;

        switch (block.kind) {
          case 'h2':
            return <h2 key={key}>{renderInline(block.text, key)}</h2>;
          case 'h3':
            return <h3 key={key}>{renderInline(block.text, key)}</h3>;
          case 'h4':
            return (
              <h4 key={key} className="mt-6 font-semibold text-ink">
                {renderInline(block.text, key)}
              </h4>
            );
          case 'p':
            return <p key={key}>{renderInline(block.text, key)}</p>;
          case 'quote':
            return (
              <blockquote
                key={key}
                className="border-l-2 border-ginger-300 pl-4 italic text-ink-soft"
              >
                {renderInline(block.text, key)}
              </blockquote>
            );
          case 'hr':
            return <hr key={key} className="border-cream-300" />;
          case 'ul':
          case 'ol':
            return block.kind === 'ul' ? (
              <ul key={key}>
                {block.items.map((item, i) => (
                  <li key={`${key}-${i}`}>{renderInline(item, `${key}-${i}`)}</li>
                ))}
              </ul>
            ) : (
              <ol key={key}>
                {block.items.map((item, i) => (
                  <li key={`${key}-${i}`}>{renderInline(item, `${key}-${i}`)}</li>
                ))}
              </ol>
            );
          case 'table':
            return (
              <div key={key} className="nc-card overflow-x-auto !p-0">
                <table>
                  <thead>
                    <tr>
                      {block.head.map((cell, i) => (
                        <th key={`${key}-h${i}`}>{renderInline(cell, `${key}-h${i}`)}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {block.rows.map((row, r) => (
                      <tr key={`${key}-r${r}`}>
                        {row.map((cell, c) => (
                          <td key={`${key}-r${r}c${c}`}>{renderInline(cell, `${key}-r${r}c${c}`)}</td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            );
          default:
            return null;
        }
      })}
    </div>
  );
}