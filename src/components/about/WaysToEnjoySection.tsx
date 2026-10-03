'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';

import { OptimizedImage } from '@/components/media/OptimizedImage';
import { Reveal } from '@/components/ui/Reveal';
import type { AboutRecipe } from './types';
import type { ContentDoc } from '@/lib/models/Content';

/**
 * About page — Ways to enjoy.
 *
 * Recipe cards render real recipes from the store. "View
 * recipe" opens the full recipe in a modal on this same
 * page — there is no separate recipes route. Below the
 * cards, a few no-fuss serving ideas round out the section.
 */

/** Serving ideas with no full recipe behind them — ideas only. */
const QUICK_IDEAS: Array<{ name: string; note: string }> = [
  { name: 'Jaggery toast', note: 'Spoon over warm toast and let it melt' },
  { name: 'Jaggery & milk', note: 'Stirred through warm milk or chai' },
  { name: 'Breakfast bowl', note: 'Drizzle over fruit, oats or yoghurt' },
  { name: 'Jaggery pancakes', note: 'Swap the sugar in your usual batter' },
  { name: 'Jaggery & banana', note: 'Shaved over sliced banana' },
  { name: 'Simple desserts', note: 'Shaved over kheer, ice cream or payasam' },
  { name: 'Directly from the jar', note: 'The way the jar is meant to be used' },
];

function totalMinutes(recipe: AboutRecipe): number {
  return (recipe.prepMinutes ?? 0) + (recipe.cookMinutes ?? 0);
}

export function WaysToEnjoySection({
  recipes,
  content,
}: {
  recipes: AboutRecipe[];
  content: ContentDoc | null;
}) {
  const [openRecipe, setOpenRecipe] = useState<AboutRecipe | null>(null);

  const title = content?.title?.trim() || 'Ways to enjoy';
  const description =
    content?.body?.trim() ||
    'More ways to make every bite a little sweeter.';

  return (
    <section
      className="bg-cream-100 py-14 sm:py-20"
      aria-labelledby="enjoy-heading"
    >
      <div className="nc-container">
        <div className="mx-auto max-w-3xl text-center">
          <Reveal>
            <h2 id="enjoy-heading" className="nc-h2">
              {title}
            </h2>
          </Reveal>
          <Reveal delay={60}>
            <p className="nc-lede mt-4">{description}</p>
          </Reveal>
        </div>

        {recipes.length > 0 ? (
          <div className="mt-12 grid gap-5 sm:mt-14 sm:grid-cols-2 lg:grid-cols-3">
            {recipes.map((recipe, i) => (
              <Reveal key={recipe.id} delay={i * 70} className="h-full">
                <article className="nc-card group flex h-full flex-col overflow-hidden transition-shadow duration-300 hover:shadow-card-hover">
                  <div className="relative block aspect-[4/3] nc-product-media">
                    <OptimizedImage
                      media={recipe.flavour?.image ?? recipe.image}
                      alt={recipe.image?.alt || recipe.flavour?.image?.alt || recipe.title}
                      aspect="4/3"
                      fit="cover"
                      sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 92vw"
                      maxWidth={900}
                    />
                  </div>

                  <div className="flex flex-1 flex-col gap-2 p-5">
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-2xs font-semibold uppercase tracking-eyebrow text-ginger-600">
                      {recipe.category ? <span>{recipe.category}</span> : null}
                      {totalMinutes(recipe) > 0 ? (
                        <>
                          {recipe.category ? (
                            <span className="text-ink-faint/60">·</span>
                          ) : null}
                          <span className="text-ink-muted">
                            {totalMinutes(recipe)} min
                          </span>
                        </>
                      ) : null}
                    </div>

                    <h3 className="font-display text-lg leading-snug text-jaggery-500">
                      {recipe.title}
                    </h3>

                    <p className="nc-body line-clamp-3 flex-1 text-ink-muted">
                      {recipe.excerpt}
                    </p>

                    {recipe.flavour ? (
                      <Link
                        href={recipe.flavour.href}
                        className="mt-1 inline-flex w-fit items-center rounded-full bg-jaggery-50 px-3 py-1 text-2xs font-semibold text-jaggery-500 transition-colors hover:bg-jaggery-100"
                      >
                        Made with {recipe.flavour.name}
                      </Link>
                    ) : null}

                    <button
                      type="button"
                      onClick={() => setOpenRecipe(recipe)}
                      className="nc-btn nc-btn-outline nc-btn-sm nc-btn-block mt-2"
                      aria-haspopup="dialog"
                    >
                      View recipe
                    </button>
                  </div>
                </article>
              </Reveal>
            ))}
          </div>
        ) : (
          <Reveal className="mt-12">
            <div className="mx-auto max-w-xl rounded-card border border-dashed border-cream-400 bg-white/70 px-6 py-10 text-center">
              <h3 className="font-display text-lg text-jaggery-500">
                Recipes are on the way
              </h3>
              <p className="nc-body mt-2 text-ink-muted">
                We are writing and testing recipes now. They will be
                published here as each one is ready.
              </p>
            </div>
          </Reveal>
        )}

        {/* Quick serving ideas */}
        <Reveal className="mt-10" delay={80}>
          <div className="rounded-card border border-cream-300/80 bg-white p-6 shadow-card">
            <h3 className="font-display text-lg text-jaggery-500">
              A few more ways to use a jar
            </h3>
            <ul className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {QUICK_IDEAS.map((idea) => (
                <li
                  key={idea.name}
                  className="rounded-xl border border-cream-300 bg-cream-50 p-4"
                >
                  <p className="font-display text-base text-jaggery-500">
                    {idea.name}
                  </p>
                  <p className="mt-1 text-sm text-ink-muted">{idea.note}</p>
                </li>
              ))}
            </ul>
          </div>
        </Reveal>
      </div>

      {openRecipe ? (
        <RecipeModal recipe={openRecipe} onClose={() => setOpenRecipe(null)} />
      ) : null}
    </section>
  );
}

/* -------------------------------------------------------------------------- */
/* Recipe modal — same page, no navigation                                    */
/* -------------------------------------------------------------------------- */

function RecipeModal({
  recipe,
  onClose,
}: {
  recipe: AboutRecipe;
  onClose: () => void;
}) {
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    closeRef.current?.focus();

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);

    return () => {
      document.body.style.overflow = previous;
      document.removeEventListener('keydown', onKey);
    };
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-[60] flex items-end justify-center sm:items-center sm:p-6"
      role="dialog"
      aria-modal="true"
      aria-labelledby="recipe-modal-title"
    >
      <div
        className="absolute inset-0 bg-jaggery-900/55 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden="true"
      />

      <div className="relative max-h-[88vh] w-full max-w-2xl overflow-y-auto rounded-t-3xl bg-white shadow-2xl animate-slide-up-sheet sm:rounded-3xl">
        <div className="relative aspect-[16/9] nc-product-media">
          <OptimizedImage
            media={recipe.image ?? recipe.flavour?.image}
            alt={recipe.image?.alt || recipe.title}
            aspect="16/9"
            fit="cover"
            sizes="(min-width: 640px) 672px, 92vw"
            maxWidth={1200}
          />
        </div>

        <div className="p-6 sm:p-8">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-2xs font-semibold uppercase tracking-eyebrow text-ginger-600">
            {recipe.category ? <span>{recipe.category}</span> : null}
            {recipe.difficulty ? (
              <>
                {recipe.category ? <span className="text-ink-faint/60">·</span> : null}
                <span className="text-ink-muted">{recipe.difficulty}</span>
              </>
            ) : null}
            {totalMinutes(recipe) > 0 ? (
              <>
                {recipe.category || recipe.difficulty ? (
                  <span className="text-ink-faint/60">·</span>
                ) : null}
                <span className="text-ink-muted">
                  {totalMinutes(recipe)} min
                </span>
              </>
            ) : null}
          </div>

          <h3 id="recipe-modal-title" className="nc-h3 mt-2">
            {recipe.title}
          </h3>

          <p className="nc-body mt-2 text-ink-muted">{recipe.excerpt}</p>

          {recipe.flavour ? (
            <Link
              href={recipe.flavour.href}
              className="mt-4 inline-flex items-center rounded-full bg-jaggery-50 px-3 py-1.5 text-2xs font-semibold text-jaggery-500 transition-colors hover:bg-jaggery-100"
            >
              Made with {recipe.flavour.name}
            </Link>
          ) : null}

          <dl className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Meta label="Servings" value={`${recipe.servings}`} />
            <Meta label="Prep" value={`${recipe.prepMinutes} min`} />
            <Meta label="Cook" value={`${recipe.cookMinutes} min`} />
            <Meta label="Total" value={`${totalMinutes(recipe)} min`} />
          </dl>

          <h4 className="mt-8 font-display text-lg text-jaggery-500">
            Ingredients
          </h4>
          {recipe.ingredients.length > 0 ? (
            <ul className="nc-prose mt-3">
              {recipe.ingredients.map((ingredient, i) => (
                <li key={`${ingredient}-${i}`}>{ingredient}</li>
              ))}
            </ul>
          ) : (
            <p className="nc-body mt-3 text-ink-muted">
              The ingredient list is being written for this recipe.
            </p>
          )}

          <h4 className="mt-8 font-display text-lg text-jaggery-500">
            Method
          </h4>
          {recipe.steps.length > 0 ? (
            <ol className="mt-3 space-y-4">
              {recipe.steps.map((step, i) => (
                <li key={`step-${i}`} className="flex gap-4">
                  <span
                    className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-leaf-50 font-display text-sm text-leaf-600"
                    aria-hidden="true"
                  >
                    {i + 1}
                  </span>
                  <div>
                    <p className="nc-body text-ink-soft">
                      {step.instruction}
                    </p>
                    {step.durationMinutes ? (
                      <p className="mt-1 text-xs text-ink-faint">
                        {step.durationMinutes} min
                      </p>
                    ) : null}
                  </div>
                </li>
              ))}
            </ol>
          ) : (
            <p className="nc-body mt-3 text-ink-muted">
              The method is being written for this recipe.
            </p>
          )}

          {recipe.body ? (
            <div className="mt-8 rounded-xl border-l-4 border-ginger-500 bg-jaggery-50 p-5">
              <h4 className="text-2xs font-semibold uppercase tracking-eyebrow text-ginger-600">
                Serving suggestion
              </h4>
              <p className="nc-body mt-2 text-ink-soft">{recipe.body}</p>
            </div>
          ) : null}

          <div className="mt-8 flex justify-end border-t border-cream-200 pt-5">
            <button
              ref={closeRef}
              type="button"
              onClick={onClose}
              className="nc-btn nc-btn-primary"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function Meta({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-cream-300 bg-cream-50 px-4 py-3">
      <dt className="text-2xs font-semibold uppercase tracking-eyebrow text-ink-faint">
        {label}
      </dt>
      <dd className="mt-1 text-sm font-semibold tabular-nums text-jaggery-500">
        {value}
      </dd>
    </div>
  );
}
