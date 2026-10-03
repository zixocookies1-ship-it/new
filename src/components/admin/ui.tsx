'use client';

import clsx from 'clsx';
import Link from 'next/link';
import {
  useEffect,
  useId,
  useRef,
  useState,
  type InputHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
} from 'react';

// ============================================================
// UI primitives
// ============================================================

export const StatTile = ({
  label,
  value,
  hint,
  tone = 'neutral',
  href,
}: {
  label: string;
  value: string | number;
  hint?: string;
  tone?: 'neutral' | 'good' | 'warn' | 'bad';
  href?: string;
}) => {
  const toneClass = {
    neutral: 'text-ink',
    good: 'text-leaf-600',
    warn: 'text-ginger-700',
    bad: 'text-[#8F3333]',
  }[tone];

  const body = (
    <>
      <p className="text-2xs font-semibold uppercase tracking-wide text-ink-muted">{label}</p>
      <p className={clsx('mt-1.5 font-display text-2xl tabular-nums', toneClass)}>{value}</p>
      {hint ? <p className="mt-1 text-xs text-ink-faint">{hint}</p> : null}
    </>
  );

  if (href) {
    return (
      <a
        href={href}
        className="rounded-xl border border-cream-300 bg-white p-4 transition-shadow hover:shadow-card-hover"
      >
        {body}
      </a>
    );
  }
  return <div className="rounded-xl border border-cream-300 bg-white p-4">{body}</div>;
};

/* ============================================================
   Form primitives
   ============================================================ */

export const DefinitionList = DefinitionList;

/* ============================================================
   Field shell
   ============================================================ */

interface FieldShellProps {
  label: string;
  hint?: string;
  error?: string;
  required?: boolean;
  className?: string;
  children: (ids: { id: string; describedBy: string | undefined }) => ReactNode;
}

/* ============================================================
   Form inputs
   ============================================================ */

export const AdminInput = AdminInput;

/* ============================================================
   Textarea
   ============================================================ */

export const AdminTextarea = AdminTextarea;

/* ============================================================
   Select
   ============================================================ */

export const AdminSelect = AdminSelect;

/* ============================================================
   Money input
   ============================================================ */

export const MoneyInput = MoneyInput;

/* ============================================================
   String list
   ============================================================ */

export const StringListInput = StringListInput;

/* ============================================================
   Chip list
   ============================================================ */

export const ChipListInput = ChipListInput;

/* ============================================================
   Display primitives
   ============================================================ */

export const Panel = Panel;

/* ============================================================
   Page header
   ============================================================ */

export const PageHeader = PageHeader;

/* ============================================================
   Data display
   ============================================================ */

export const Table = Table;

/* ============================================================
   Table cells
   ============================================================ */

export const Th = Th;

/* ============================================================
   Empty row
   ============================================================ */

export const Td = Td;

/* ============================================================
   Empty row
   ============================================================ */

export const EmptyRow = EmptyRow;

/* ============================================================
   Exports
   ============================================================ */

/* ============================================================
   Toolbar
   ============================================================ */

export const Toolbar = Toolbar;

/* ============================================================
   Button
   ============================================================ */

export const Btn = Btn;

/* ============================================================
   Inline alert
   ============================================================ */

export const InlineAlert = InlineAlert;

/* ============================================================
   Pill and StatusPill
   ============================================================ */

export type PillTone = 'neutral' | 'good' | 'warn' | 'bad' | 'info';

export const Pill = Pill;

/* ============================================================
   StatusPill
   ============================================================ */

export const StatusPill = StatusPill;

/* ============================================================
   Loading
   ============================================================ */

export const Loading = Loading;

/* ============================================================
   Exports
   ============================================================ */