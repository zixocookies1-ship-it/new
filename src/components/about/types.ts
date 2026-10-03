import type { MediaRef } from '@/lib/types';

/**
 * Plain recipe view model for the About page.
 *
 * Defined here (not in `lib/catalog`) so client components can import
 * the type without pulling the server-only catalogue module into the
 * browser bundle. The server page maps `RecipeDoc` → `AboutRecipe`.
 */
export interface AboutRecipe {
  id: string;
  title: string;
  excerpt: string;
  category: string;
  servings: number;
  prepMinutes: number;
  cookMinutes: number;
  difficulty: string;
  ingredients: string[];
  steps: Array<{ instruction: string; durationMinutes: number | null }>;
  body: string;
  image: MediaRef | null;
  /** The Nature's Choice flavour the recipe is written around. */
  flavour: {
    name: string;
    slug: string;
    image: MediaRef | null;
    href: string;
  } | null;
}
