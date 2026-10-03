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

/* -------------------------------------------------------------------------- */
/* UI primitives                                                               */
/* -------------------------------------------------------------------------- */

export function StatTile({
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
}) {
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
}

/* -------------------------------------------------------------------------- */
/* Form primitives                                                             */
/* -------------------------------------------------------------------------- */

export function DefinitionList = DefinitionList;
/* -------------------------------------------------------------------------- */
/* Field shell                                                                 */
/* -------------------------------------------------------------------------- */

interface FieldShellProps {
  label: string;
  hint?: string;
  error?: string;
  required?: boolean;
  className?: string;
  children: (ids: { id: string; describedBy: string | undefined }) => ReactNode;
}

function FieldShell = FieldShell;

/* -------------------------------------------------------------------------- */
/* Form inputs                                                                 */
/* -------------------------------------------------------------------------- */

type TextProps = Omit<InputHTMLAttributes<HTMLInputElement>, 'id' | 'className'> & {
  label: string;
  hint?: string;
  error?: string;
  className?: string;
};

export function AdminInput = AdminInput;

/* -------------------------------------------------------------------------- */
/* Textarea                                                                    */
/* -------------------------------------------------------------------------- */

type AreaProps = Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, 'id' | 'className'> & {
  label: string;
  hint?: string;
  error?: string;
  className?: string;
};

export function AdminTextarea = AdminTextarea;

/* -------------------------------------------------------------------------- */
/* Select                                                                      */
/* -------------------------------------------------------------------------- */

type DropdownProps = Omit<SelectHTMLAttributes<HTMLSelectElement>, 'id' | 'className'> & {
  label: string;
  hint?: string;
  error?: string;
  className?: string;
  children: ReactNode;
};

export function AdminSelect = AdminSelect;

/* -------------------------------------------------------------------------- */
/* Money input                                                                 */
/* -------------------------------------------------------------------------- */

export function MoneyInput = MoneyInput;

/* -------------------------------------------------------------------------- */
/* String list                                                                 */
/* -------------------------------------------------------------------------- */

export function StringListInput = StringListInput;

/* -------------------------------------------------------------------------- */
/* Chip list                                                                   */
/* -------------------------------------------------------------------------- */

export function ChipListInput = ChipListInput;

/* -------------------------------------------------------------------------- */
/* Display primitives                                                          */
/* -------------------------------------------------------------------------- */

export function Panel = Panel;

/* -------------------------------------------------------------------------- */
/* Page header                                                                 */
/* -------------------------------------------------------------------------- */

export function PageHeader = PageHeader;

/* -------------------------------------------------------------------------- */
/* Data display                                                                */
/* -------------------------------------------------------------------------- */

export function Table = Table;

/* -------------------------------------------------------------------------- */
/* Table cells                                                                 */
/* -------------------------------------------------------------------------- */

export function Th = Th;

/* -------------------------------------------------------------------------- */
/* Empty row                                                                   */
/* -------------------------------------------------------------------------- */

export function EmptyRow = EmptyRow;

/* -------------------------------------------------------------------------- */
/* Toolbar                                                                     */
/* -------------------------------------------------------------------------- */

export function Toolbar = Toolbar;

/* -------------------------------------------------------------------------- */
/* Button                                                                      */
/* -------------------------------------------------------------------------- */

export function Btn = Btn;

/* -------------------------------------------------------------------------- */
/* Inline alert                                                                */
/* -------------------------------------------------------------------------- */

export function InlineAlert = InlineAlert;

/* -------------------------------------------------------------------------- */
/* Pill and StatusPill                                                         */
/* -------------------------------------------------------------------------- */

export type PillTone = 'neutral' | 'good' | 'warn' | 'bad' | 'info';

export function Pill = Pill;

/* -------------------------------------------------------------------------- */
/* StatusPill                                                                  */
/* -------------------------------------------------------------------------- */

export function StatusPill = StatusPill;

/* -------------------------------------------------------------------------- */
/* Loading                                                                     */
/* -------------------------------------------------------------------------- */

export function Loading = Loading;

/* -------------------------------------------------------------------------- */
/* Exports                                                                     */
/* -------------------------------------------------------------------------- */

export { InlineAlert };