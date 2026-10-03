import type { Metadata } from 'next';

import { buildMetadata } from '@/lib/seo';
import {
  getActiveRecipes,
  getStorefrontProducts,
  safeContent,
} from '@/lib/catalog';
import {
  getBusinessSettings,
  SETTINGS_DEFAULTS,
} from '@/lib/models/BusinessSettings';
import type { RecipeDoc } from '@/lib/models/Recipe';
import type { ProductVM } from '@/lib/catalog';
import type { AboutRecipe } from '@/components/about/types';

import { StorySection } from '@/components/about/StorySection';
import { WhySection } from '@/components/about/WhySection';
import { FarmToJarSection } from '@/components/about/FarmToJarSection';
import { FlavoursSection } from '@/components/about/FlavoursSection';
import { WaysToEnjoySection } from '@/components/about/WaysToEnjoySection';
import { FounderSection } from '@/components/about/FounderSection';
import { FinalCtaSection } from '@/components/about/FinalCtaSection';

/**
 * About — the complete brand story, on one page.
 *
 * Our Story, Why Nature's Choice, From Farm to Jar, the
 * three flavours, Ways to Enjoy, the co-founder and the
 * closing CTA are all sections of this page. There are no
 * separate routes for them.
 */

export const revalidate = 300;

export async function generateMetadata(): Promise<Metadata> {
  const [content, settings] = await Promise.all([
    safeContent(['home_hero']),
    getBusinessSettings().catch(
      () => ({ ...SETTINGS_DEFAULTS }) as never,
    ),
  ]);

  return buildMetadata(settings as never, {
    title: 'About',
    description:
      'The Nature’s Choice story — a modern take on a familiar Indian favourite. Three flavours of chocolatey desi jaggery, from farm to jar, with ways to enjoy every jar.',
    path: '/about',
    image: content.home_hero?.images?.[0] ?? '/media/hero-banner.png',
  });
}

/** Which Nature's Choice flavour a recipe is written around. */
function matchFlavour(
  recipe: RecipeDoc,
  products: ProductVM[],
): AboutRecipe['flavour'] {
  if (!products.length) return null;

  // The ingredient list names the jar the recipe is built on.
  for (const ingredient of recipe.ingredients) {
    const line = ingredient.toLowerCase();
    const match = products.find((p) =>
      line.includes(p.name.toLowerCase()),
    );
    if (match) return toFlavourInfo(match);
  }

  // Fall back to the recipe's related products, then the range.
  const related = products.find((p) =>
    recipe.relatedProductIds.some((id) => String(id) === p.id),
  );
  return toFlavourInfo(related ?? products[0]);
}

function toFlavourInfo(product: ProductVM): AboutRecipe['flavour'] {
  return {
    name: product.name,
    slug: product.slug,
    image: product.primaryImage,
    href: `/products/${product.slug}`,
  };
}

function toAboutRecipes(
  recipes: RecipeDoc[],
  products: ProductVM[],
): AboutRecipe[] {
  return recipes.map((recipe) => ({
    id: String(recipe._id),
    title: recipe.title,
    excerpt: recipe.excerpt,
    category: recipe.category,
    servings: recipe.servings,
    prepMinutes: recipe.prepMinutes,
    cookMinutes: recipe.cookMinutes,
    difficulty: recipe.difficulty,
    ingredients: recipe.ingredients,
    steps: recipe.steps.map((step) => ({
      instruction: step.instruction,
      durationMinutes: step.durationMinutes ?? null,
    })),
    body: recipe.body,
    image: recipe.image ?? null,
    flavour: matchFlavour(recipe, products),
  }));
}

export default async function AboutPage() {
  const [content, productsResult, recipes, settings] = await Promise.all([
    safeContent([
      'our_story',
      'why_natures_choice',
      'home_three_flavours',
      'home_process',
    ]),
    getStorefrontProducts().catch(() => null),
    getActiveRecipes(6).catch(() => []),
    getBusinessSettings().catch(
      () => ({ ...SETTINGS_DEFAULTS }) as never,
    ),
  ]);

  const products = productsResult?.products ?? [];
  const aboutRecipes = toAboutRecipes(recipes, products);

  return (
    <div>
      <StorySection
        content={content.our_story ?? null}
        products={products}
      />

      <WhySection content={content.why_natures_choice ?? null} />

      <FarmToJarSection
        content={content.home_process ?? null}
        products={products}
      />

      <FlavoursSection
        products={products}
        content={content.home_three_flavours ?? null}
      />

      <WaysToEnjoySection recipes={aboutRecipes} />

      <FounderSection content={content.our_story ?? null} />

      <FinalCtaSection />
    </div>
  );
}
