import type { Metadata } from 'next';
import Link from 'next/link';

import { RecipeCard } from '@/components/recipes/RecipeCard';
import { Breadcrumbs } from '@/components/ui/Breadcrumbs';
import { EmptyState } from '@/components/ui/StateBlocks';
import { Reveal } from '@/components/ui/Reveal';

import { getActiveRecipes } from '@/lib/catalog';
import { getBusinessSettings, SETTINGS_DEFAULTS } from '@/lib/models/BusinessSettings';
import { buildMetadata } from '@/lib/seo';

export const revalidate = 300;

export async function generateMetadata(): Promise<Metadata> {
  const settings = await getBusinessSettings().catch(() => ({ ...SETTINGS_DEFAULTS }) as never);
  return buildMetadata(settings, {
    title: 'Recipes',
    description:
      'Simple recipes and serving ideas for jaggery — breakfasts, desserts and drinks that work in a normal kitchen.',
    path: '/recipes',
  });
}

export default async function RecipesPage() {
  const recipes = await getActiveRecipes(60).catch(() => []);

  const categories = [...new Set(recipes.map((r) => r.category).filter(Boolean))];

  return (
    <>
      <div className="bg-cream-100">
        <div className="nc-container py-8 sm:py-12">
          <Breadcrumbs items={[{ label: 'Home', href: '/' }, { label: 'Recipes' }]} />

          <header className="mt-6 max-w-3xl">
            <p className="nc-eyebrow mb-3">Ways to enjoy it</p>
            <h1 className="nc-h1">Recipes & serving ideas</h1>
            <p className="nc-lede mt-5">
              Written for an ordinary kitchen — nothing that needs a blender you do not own, and
              nothing that takes all afternoon.
            </p>
          </header>

          {categories.length > 1 ? (
            <ul className="mt-7 flex flex-wrap gap-2">
              {categories.map((category) => (
                <li
                  key={category}
                  className="inline-flex items-center rounded-full border border-cream-400 bg-white px-4 py-1.5 text-[0.8125rem] font-semibold text-ink-soft"
                >
                  {category}
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      </div>

      <div className="bg-white py-12 sm:py-16">
        <div className="nc-container">
          {recipes.length > 0 ? (
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {recipes.map((recipe, i) => (
                <Reveal key={String(recipe._id)} delay={Math.min(i, 6) * 60}>
                  <RecipeCard recipe={recipe} priority={i < 3} className="h-full" />
                </Reveal>
              ))}
            </div>
          ) : (
            <EmptyState
              title="Recipes are on the way"
              message="We are writing and testing recipes now. Each one goes up as soon as it is ready — we would rather publish fewer recipes than publish untested ones."
              action={{ label: 'Browse the range', href: '/shop' }}
              secondaryAction={{ label: 'Ask a question', href: '/contact' }}
            />
          )}

          <div className="mt-12 rounded-card border border-cream-300 bg-cream-50 p-6 text-center sm:p-8">
            <h2 className="font-display text-xl text-jaggery-500">Have a recipe of your own?</h2>
            <p className="nc-body mx-auto mt-2 max-w-prose text-ink-muted">
              If you have made something good with our jaggery, we would love to hear about it — and
              with your permission, publish it.
            </p>
            <Link href="/contact" className="nc-btn-primary nc-btn-sm mt-4 inline-flex">
              Send it over
            </Link>
          </div>
        </div>
      </div>
    </>
  );
}