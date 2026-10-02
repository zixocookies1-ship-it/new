import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import Link from 'next/link';

import { OptimizedImage } from '@/components/media/OptimizedImage';
import { RecipeCard } from '@/components/recipes/RecipeCard';
import { ProductCard } from '@/components/product/ProductCard';
import { Breadcrumbs } from '@/components/ui/Breadcrumbs';
import { Prose } from '@/components/ui/Prose';
import { ButtonLink } from '@/components/ui/ButtonLink';
import { EmptyState } from '@/components/ui/StateBlocks';

import { getActiveRecipes, getRecipeBySlug, getStorefrontProducts } from '@/lib/catalog';
import { getBusinessSettings, SETTINGS_DEFAULTS } from '@/lib/models/BusinessSettings';
import { buildMetadata, breadcrumbJsonLd, jsonLdScript, recipeJsonLd } from '@/lib/seo';

export const revalidate = 300;

interface Params {
  params: Promise<{ slug: string }>;
}

export async function generateStaticParams() {
  const recipes = await getActiveRecipes(60).catch(() => []);
  return recipes.map((r) => ({ slug: r.slug }));
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { slug } = await params;
  const [recipe, settings] = await Promise.all([
    getRecipeBySlug(slug).catch(() => null),
    getBusinessSettings().catch(() => ({ ...SETTINGS_DEFAULTS }) as never),
  ]);

  if (!recipe) return { title: 'Recipe not found', robots: { index: false, follow: false } };

  return buildMetadata(settings, {
    title: recipe.seoTitle?.trim() || recipe.title,
    description: recipe.seoDescription?.trim() || recipe.excerpt,
    path: `/recipes/${recipe.slug}`,
    image: recipe.image,
    type: 'article',
  });
}

export default async function RecipePage({ params }: Params) {
  const { slug } = await params;
  const recipe = await getRecipeBySlug(slug);
  if (!recipe) notFound();

  const [others, catalogue] = await Promise.all([
    getActiveRecipes(12).catch(() => []),
    getStorefrontProducts().catch(() => null),
  ]);

  // `relatedProductIds` are Mongo ObjectIds; we match them against the live
  // storefront list, so an inactive product simply drops out of the block.
  const relatedIds = new Set((recipe.relatedProductIds ?? []).map(String));
  const relatedProducts = (catalogue?.products ?? [])
    .filter((p) => relatedIds.has(p.id))
    .slice(0, 3);

  const suggestions = others.filter((r) => String(r._id) !== String(recipe._id)).slice(0, 3);
  const totalMinutes = (recipe.prepMinutes ?? 0) + (recipe.cookMinutes ?? 0);

  const jsonLd = recipeJsonLd({
    title: recipe.title,
    excerpt: recipe.excerpt,
    servings: recipe.servings,
    prepMinutes: recipe.prepMinutes,
    cookMinutes: recipe.cookMinutes,
    ingredients: recipe.ingredients ?? [],
    steps: (recipe.steps ?? []).map((s) => s.instruction),
    imageUrl: recipe.image?.secureUrl ?? recipe.image?.url ?? null,
  });

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: jsonLdScript([
            breadcrumbJsonLd([
              { name: 'Home', path: '/' },
              { name: 'Recipes', path: '/recipes' },
              { name: recipe.title, path: `/recipes/${recipe.slug}` },
            ]),
            jsonLd,
          ].filter(Boolean)),
        }}
      />

      <div className="bg-cream-100">
        <div className="nc-container py-8 sm:py-12">
          <Breadcrumbs
            items={[
              { label: 'Home', href: '/' },
              { label: 'Recipes', href: '/recipes' },
              { label: recipe.title },
            ]}
          />
        </div>
      </div>

      <article className="bg-white pb-14">
        <div className="nc-container max-w-3xl">
          <header>
            {recipe.category ? <p className="nc-eyebrow mb-3">{recipe.category}</p> : null}
            <h1 className="nc-h1">{recipe.title}</h1>
            {recipe.excerpt ? <p className="nc-lede mt-5">{recipe.excerpt}</p> : null}

            <dl className="mt-6 flex flex-wrap items-center gap-x-6 gap-y-2 border-y border-cream-200 py-4 text-sm">
              {totalMinutes > 0 ? (
                <div className="flex items-center gap-1.5">
                  <dt className="text-ink-muted">Total time</dt>
                  <dd className="font-semibold text-ink">{totalMinutes} min</dd>
                </div>
              ) : null}
              {recipe.servings ? (
                <div className="flex items-center gap-1.5">
                  <dt className="text-ink-muted">Serves</dt>
                  <dd className="font-semibold text-ink">{recipe.servings}</dd>
                </div>
              ) : null}
              {recipe.difficulty ? (
                <div className="flex items-center gap-1.5">
                  <dt className="text-ink-muted">Difficulty</dt>
                  <dd className="font-semibold text-ink">{recipe.difficulty}</dd>
                </div>
              ) : null}
              {recipe.prepMinutes > 0 ? (
                <div className="flex items-center gap-1.5">
                  <dt className="text-ink-muted">Prep</dt>
                  <dd className="font-semibold text-ink">{recipe.prepMinutes} min</dd>
                </div>
              ) : null}
              {recipe.cookMinutes > 0 ? (
                <div className="flex items-center gap-1.5">
                  <dt className="text-ink-muted">Cook</dt>
                  <dd className="font-semibold text-ink">{recipe.cookMinutes} min</dd>
                </div>
              ) : null}
            </dl>
          </header>

          {recipe.image ? (
            <div className="mt-8 overflow-hidden rounded-[1.5rem] border border-cream-300/70 bg-cream-50">
              <OptimizedImage
                media={recipe.image}
                alt={recipe.image.alt || recipe.title}
                aspect="16/9"
                fit="cover"
                sizes="(min-width: 768px) 768px, 92vw"
                priority
                maxWidth={1600}
              />
            </div>
          ) : null}

          {recipe.ingredients?.length ? (
            <section className="mt-10">
              <h2 className="nc-h3 mb-4">Ingredients</h2>
              <ul className="space-y-2.5">
                {recipe.ingredients.map((ingredient, i) => (
                  <li key={i} className="flex gap-3 text-[0.9375rem] text-ink-soft">
                    <svg
                      viewBox="0 0 20 20"
                      className="mt-1 h-4 w-4 shrink-0 text-leaf-500"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.7"
                      aria-hidden="true"
                    >
                      <path d="M4.5 10.5 8 14l7.5-8" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                    {ingredient}
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          {recipe.steps?.length ? (
            <section className="mt-10">
              <h2 className="nc-h3 mb-5">Method</h2>
              <ol className="space-y-5">
                {recipe.steps.map((step, i) => (
                  <li key={i} className="flex gap-4">
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-jaggery-500 font-display text-sm text-cream-50">
                      {i + 1}
                    </span>
                    <div className="min-w-0 pt-1">
                      <p className="text-[0.9375rem] leading-relaxed text-ink-soft">
                        {step.instruction}
                      </p>
                      {step.durationMinutes ? (
                        <p className="mt-1 text-xs text-ink-faint">
                          About {step.durationMinutes} minutes for this step
                        </p>
                      ) : null}
                    </div>
                  </li>
                ))}
              </ol>
            </section>
          ) : null}

          {recipe.body ? (
            <section className="mt-10">
              <Prose>{recipe.body}</Prose>
            </section>
          ) : null}

          <div className="mt-10 flex flex-wrap items-center gap-4 border-t border-cream-200 pt-6">
            <ButtonLink href="/shop" variant="accent">
              Shop the range
            </ButtonLink>
            <ButtonLink href="/recipes" variant="outline">
              More recipes
            </ButtonLink>
          </div>
        </div>

        {relatedProducts.length > 0 ? (
          <section className="nc-container mt-14">
            <h2 className="nc-h3 mb-6">Pairs well with</h2>
            <div className="grid gap-4 sm:grid-cols-3">
              {relatedProducts.map((p) => (
                <ProductCard key={p.id} product={p} compact />
              ))}
            </div>
          </section>
        ) : null}

        {suggestions.length > 0 ? (
          <section className="nc-container mt-14 border-t border-cream-200 pt-12">
            <h2 className="nc-h3 mb-6">More from the kitchen</h2>
            <div className="grid gap-5 sm:grid-cols-3">
              {suggestions.map((r) => (
                <RecipeCard key={String(r._id)} recipe={r} compact className="h-full" />
              ))}
            </div>
          </section>
        ) : (
          <div className="nc-container mt-14">
            <EmptyState
              title="More recipes coming"
              message="We are still building out the recipe collection."
              action={{ label: 'Back to recipes', href: '/recipes' }}
            />
          </div>
        )}

        <p className="nc-container mt-10 text-sm text-ink-muted">
          Tried it?{' '}
          <Link href="/contact" className="nc-link">
            Tell us how it went
          </Link>{' '}
          — we read every message.
        </p>
      </article>
    </>
  );
}