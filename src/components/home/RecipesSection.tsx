import Link from 'next/link';
import { RecipeCard } from '@/components/recipes/RecipeCard';
import { Reveal } from '@/components/ui/Reveal';
import { SectionHeading } from '@/components/ui/StateBlocks';
import { ButtonLink } from '@/components/ui/ButtonLink';
import type { RecipeDoc } from '@/lib/models/Recipe';
import type { ContentDoc } from '@/lib/models/Content';

/** Section 11 — Recipes / ways to enjoy. */
export function RecipesSection({
  content,
  recipes,
}: {
  content: ContentDoc | null;
  recipes: RecipeDoc[];
}) {
  return (
    <section className="bg-cream-100 py-14 sm:py-20" id="recipes">
      <div className="nc-container">
        <SectionHeading
          as="h2"
          eyebrow={content?.eyebrow?.trim() || 'Ways to enjoy it'}
          title={content?.title?.trim() || 'Simple things to make with it'}
          description={
            content?.body?.trim() ||
            'Recipes and serving ideas written for a normal kitchen — no equipment you do not have.'
          }
        />

        {recipes.length > 0 ? (
          <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {recipes.slice(0, 4).map((recipe, i) => (
              <Reveal key={String(recipe._id)} delay={i * 60}>
                <RecipeCard recipe={recipe} className="h-full" />
              </Reveal>
            ))}
          </div>
        ) : (
          <Reveal className="mt-10">
            <div className="mx-auto max-w-xl rounded-card border border-dashed border-cream-400 bg-white/70 px-6 py-10 text-center">
              <h3 className="font-display text-lg text-jaggery-500">Recipes are on the way</h3>
              <p className="nc-body mt-2 text-ink-muted">
                We are writing and testing recipes now. They will be published here as each one is ready.
              </p>
            </div>
          </Reveal>
        )}

        <div className="mt-10 flex justify-center">
          <ButtonLink href="/recipes" variant="outline">
            See all recipes
          </ButtonLink>
        </div>

        {recipes.length === 0 ? (
          <p className="mt-6 text-center text-xs text-ink-faint">
            Questions in the meantime? <Link href="/faq" className="nc-link">Read the FAQ</Link>.
          </p>
        ) : null}
      </div>
    </section>
  );
}