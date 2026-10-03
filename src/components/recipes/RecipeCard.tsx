import Link from 'next/link';
import { OptimizedImage } from '@/components/media/OptimizedImage';
import { ALL_ROUTES } from '@/lib/site';
import type { RecipeDoc } from '@/lib/models/Recipe';

/**
 * Recipe teaser card — used on the homepage "Ways to enjoy it" section.
 *
 * There is no separate recipe detail route, so nothing here pretends to be a
 * link that goes somewhere. The closing ask points at the contact page, where a
 * customer can actually ask for the full recipe.
 */
export function RecipeCard({
  recipe,
  priority = false,
  compact = false,
  className = '',
}: {
  recipe: RecipeDoc;
  priority?: boolean;
  /** Denser variant for "more like this" rails where cards sit side by side. */
  compact?: boolean;
  className?: string;
}) {
  const totalMinutes = (recipe.prepMinutes ?? 0) + (recipe.cookMinutes ?? 0);

  return (
    <article
      className={`group nc-card flex flex-col overflow-hidden transition-shadow duration-300 hover:shadow-card-hover ${className}`}
    >
      <div className={`block nc-product-media ${compact ? 'aspect-[16/10]' : 'aspect-[4/3]'}`}>
        <OptimizedImage
          media={recipe.image}
          alt={recipe.image?.alt || recipe.title}
          aspect={compact ? '16/10' : '4/3'}
          fit="cover"
          sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw"
          priority={priority}
          maxWidth={compact ? 900 : 1200}
        />
      </div>

      <div className={`flex flex-1 flex-col gap-2 ${compact ? 'p-4' : 'p-5'}`}>
        <div className="flex flex-wrap items-center gap-2 text-2xs font-semibold uppercase tracking-eyebrow text-ginger-600">
          {recipe.category ? <span>{recipe.category}</span> : null}
          {totalMinutes > 0 ? (
            <>
              {recipe.category ? <span className="text-ink-faint/60">·</span> : null}
              <span className="text-ink-muted">{totalMinutes} min</span>
            </>
          ) : null}
        </div>

        <h3
          className={`font-display leading-snug text-jaggery-500 ${
            compact ? 'text-base' : 'text-lg'
          }`}
        >
          {recipe.title}
        </h3>

        {recipe.excerpt && !compact ? (
          <p className="nc-body line-clamp-3 flex-1 text-ink-muted">{recipe.excerpt}</p>
        ) : null}

        <Link
          href={ALL_ROUTES.contact}
          className="mt-1 inline-flex items-center gap-1.5 text-sm font-semibold text-jaggery-500"
        >
          Ask for this recipe
          <svg
            viewBox="0 0 20 20"
            className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-0.5"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            aria-hidden="true"
          >
            <path d="M4 10h11M11 5.5 15.5 10 11 14.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </Link>
      </div>
    </article>
  );
}
