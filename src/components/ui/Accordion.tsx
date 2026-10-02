'use client';

import { useState, type ReactNode } from 'react';
import clsx from 'clsx';

/**
 * Accessible disclosure accordion built on native <details>/<summary>
 * semantics via controlled buttons + aria-expanded, so it works with
 * keyboard navigation and screen readers out of the box.
 */
export function Accordion({
  items,
  defaultOpenIndex = -1,
  className = '',
  allowMultiple = false,
}: {
  items: Array<{ id: string; question: string; answer: ReactNode }>;
  defaultOpenIndex?: number;
  className?: string;
  allowMultiple?: boolean;
}) {
  const [open, setOpen] = useState<Set<string>>(() => {
    const initial = new Set<string>();
    if (defaultOpenIndex >= 0 && items[defaultOpenIndex]) {
      initial.add(items[defaultOpenIndex].id);
    }
    return initial;
  });

  function toggle(id: string) {
    setOpen((prev) => {
      const next = new Set(allowMultiple ? prev : []);
      if (prev.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  if (!items.length) return null;

  return (
    <div className={clsx('divide-y divide-cream-300 border-y border-cream-300', className)}>
      {items.map((item) => {
        const isOpen = open.has(item.id);
        return (
          <div key={item.id} className="py-1">
            <h3>
              <button
                type="button"
                onClick={() => toggle(item.id)}
                aria-expanded={isOpen}
                aria-controls={`panel-${item.id}`}
                id={`trigger-${item.id}`}
                className="group flex w-full items-start justify-between gap-4 py-4 text-left"
              >
                <span className="text-[0.9375rem] font-semibold leading-snug text-jaggery-500 transition-colors group-hover:text-ginger-600 sm:text-base">
                  {item.question}
                </span>
                <span
                  aria-hidden="true"
                  className={clsx(
                    'mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-cream-400 text-ink-soft transition-all duration-200 ease-out-soft',
                    isOpen && 'rotate-45 border-jaggery-500 text-jaggery-500',
                  )}
                >
                  <svg viewBox="0 0 16 16" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="1.8">
                    <path d="M8 3.5v9M3.5 8h9" strokeLinecap="round" />
                  </svg>
                </span>
              </button>
            </h3>
            <div
              id={`panel-${item.id}`}
              role="region"
              aria-labelledby={`trigger-${item.id}`}
              hidden={!isOpen}
              className="pb-5 pr-10"
            >
              <div className="nc-body text-ink-soft">{item.answer}</div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
