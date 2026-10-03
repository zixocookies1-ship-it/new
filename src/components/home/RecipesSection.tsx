import Link from 'next/link';
import { RecipeCard } from '@/components/recipes/RecipeCard';
import { Reveal } from '@/components/ui/Reveal';
import { SectionHeading } from '@/components/ui/StateBlocks';
import { ButtonLink } from '@/components/ui/ButtonLink';
import { ALL_ROUTES } from '@/lib/site';
import type { RecipeDoc } from '@/lib/models/Recipe';
import type { ContentDoc } from '@/lib/models/Content';

/**
 * Section — Ways to enjoy it.
 *
 * A homepage section only: recipes are rendered as real cards straight from the
 * database, and the closing ask points at the contact page rather than a
 * separate recipes route.
 */
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
          title={content?.title?.trim() || 'Not just for your chai'}
          description={
            content?.body?.trim() ||
            'Toast, milk, breakfast bowls, pancakes, fruit and desserts — simple things to make with it.'
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
                We are writing and testing recipes now. They will be published here as each one is
                ready.
              </p>
            </div>
          </Reveal>
        )}

        <div className="mt-10 flex justify-center">
          <ButtonLink href={ALL_ROUTES.contact} variant="outline">
            Ask us for a recipe
          </ButtonLink>
        </div>

        {recipes.length === 0 ? (
          <p className="mt-6 text-center text-xs text-ink-faint">
            Something specific in mind?{' '}
            <Link href={ALL_ROUTES.contact} className="nc-link">
              Send us a message
            </Link>
            .
          </p>
        ) : null}
      </div>
    </section>
  );
}
