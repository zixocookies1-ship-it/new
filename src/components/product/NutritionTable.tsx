import clsx from 'clsx';

export interface NutritionRow {
  label: string;
  per100g?: string;
  perServing?: string;
}

/**
 * Nutrition panel.
 *
 * Anti-scam by construction: when the admin has not entered a nutrition panel,
 * this renders nothing at all. We never show a fabricated "0 g sugar" or
 * "100% natural" table, and the "per" basis always comes from the product
 * record rather than being assumed to be 100 g.
 */
export function NutritionTable({
  rows,
  basis,
  fssaiNote,
  className = '',
}: {
  rows: NutritionRow[];
  basis: { amount: number; unit: string; label: string };
  fssaiNote?: string;
  className?: string;
}) {
  if (!rows.length) return null;

  const usesPer100g = Boolean(basis?.label && /100\s*g/i.test(basis.label));
  const mainKey = usesPer100g ? 'per100g' : 'perServing';
  const otherKey = usesPer100g ? 'perServing' : 'per100g';

  return (
    <div className={clsx('rounded-xl border border-cream-300 bg-white/80', className)}>
      <div className="flex items-baseline justify-between gap-3 border-b border-cream-200 px-4 py-3">
        <h3 className="font-display text-base text-jaggery-500">Nutrition</h3>
        <p className="text-xs font-medium text-ink-muted">{basis?.label || 'Per 100g'}</p>
      </div>

      <table className="w-full text-sm">
        <caption className="sr-only">
          Nutrition information {basis?.label || 'per 100 grams'}
        </caption>
        <tbody>
          {rows.map((r, i) => {
            const main = r[mainKey];
            const other = r[otherKey];
            return (
              <tr key={`${r.label}-${i}`} className="border-b border-cream-200 last:border-0">
                <th scope="row" className="px-4 py-2.5 text-left font-medium text-ink-soft">
                  {r.label}
                </th>
                <td className="px-4 py-2.5 text-right tabular-nums text-ink">
                  {main || (other ? '—' : '—')}
                  {main ? <span className="ml-1 text-xs text-ink-faint">{basis?.unit ?? 'g'}</span> : null}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>

      {fssaiNote ? (
        <p className="border-t border-cream-200 px-4 py-3 text-xs leading-relaxed text-ink-muted">
          {fssaiNote}
        </p>
      ) : null}
    </div>
  );
}