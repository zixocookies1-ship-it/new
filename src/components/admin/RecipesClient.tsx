'use client';

import { useEffect, useState } from 'react';

import { adminFetch } from './api';
import { ImageField } from './ImageField';
import { useAdminAction, useAdminData } from './useAdminData';
import {
  AdminInput,
  AdminSelect,
  AdminTextarea,
  AdminToggle,
  Btn,
  EmptyRow,
  InlineAlert,
  Loading,
  PageHeader,
  Panel,
  Pill,
  StringListInput,
  Table,
  Td,
  Th,
} from './ui';
import type { AdminMediaRef, AdminProductListItem, AdminRecipe } from './types';

interface RecipesResponse {
  recipes: AdminRecipe[];
  categories: string[];
}

interface StepForm {
  instruction: string;
  durationMinutes: number | null;
}

interface RecipeForm {
  id?: string;
  title: string;
  slug: string;
  excerpt: string;
  body: string;
  image: AdminMediaRef | null;
  category: string;
  servings: number;
  prepMinutes: number;
  cookMinutes: number;
  difficulty: 'Easy' | 'Medium';
  steps: StepForm[];
  ingredients: string[];
  relatedProductIds: string[];
  order: number;
  isActive: boolean;
  seoTitle: string;
  seoDescription: string;
}

function blankForm(): RecipeForm {
  return {
    title: '',
    slug: '',
    excerpt: '',
    body: '',
    image: null,
    category: 'Ways to enjoy',
    servings: 2,
    prepMinutes: 5,
    cookMinutes: 5,
    difficulty: 'Easy',
    steps: [{ instruction: '', durationMinutes: null }],
    ingredients: [],
    relatedProductIds: [],
    order: 0,
    isActive: true,
    seoTitle: '',
    seoDescription: '',
  };
}

/** Recipes. Copy must be real — the recipes section is a top trust signal, and invented
 *  instructions would be worse than none. */
export function RecipesClient() {
  const { data, error, loading, reload } = useAdminData<RecipesResponse>('/api/admin/recipes?all=1');
  const [editing, setEditing] = useState<string | 'new' | null>(null);
  const action = useAdminAction();

  async function toggle(r: AdminRecipe) {
    await action.run(() =>
      adminFetch('/api/admin/recipes', {
        method: 'PATCH',
        body: { id: r.id, isActive: !r.isActive },
      }),
    );
    reload();
  }

  async function remove(r: AdminRecipe) {
    if (!window.confirm(`Delete the recipe "${r.title}"?`)) return;
    const res = await action.run(() =>
      adminFetch(`/api/admin/recipes?id=${r.id}`, { method: 'DELETE' }),
    );
    if (res) reload();
  }

  return (
    <>
      <PageHeader
        title="Recipes"
        description="How people actually use the product. Write real instructions — never placeholder text."
        action={<Btn variant="primary" onClick={() => setEditing('new')}>+ New recipe</Btn>}
      />

      {error ? (
        <div className="mb-4">
          <InlineAlert tone="bad">{error}</InlineAlert>
        </div>
      ) : null}
      {action.error ? (
        <div className="mb-4">
          <InlineAlert tone="bad">{action.error}</InlineAlert>
        </div>
      ) : null}

      <Panel>
        {loading && !data ? (
          <Loading />
        ) : (
          <Table
            minWidth={820}
            headers={
              <>
                <Th>Recipe</Th>
                <Th>Category</Th>
                <Th>Time</Th>
                <Th>Steps</Th>
                <Th>State</Th>
                <Th />
              </>
            }
          >
            {!data?.recipes.length ? (
              <EmptyRow colSpan={6} message="No recipes yet. The recipes section hides itself until you add one." />
            ) : (
              data.recipes.map((r) => (
                <tr key={r.id}>
                  <Td>
                    <span className="block font-semibold text-ink">{r.title}</span>
                    {/* Shown on the homepage "Ways to enjoy it" section. */}
                    <span className="block text-2xs text-ink-faint">Homepage section</span>
                    <span className="mt-0.5 block max-w-sm text-xs text-ink-muted">{r.excerpt}</span>
                  </Td>
                  <Td>
                    <Pill tone="neutral">{r.category}</Pill>
                  </Td>
                  <Td className="whitespace-nowrap text-xs">
                    {r.prepMinutes + r.cookMinutes} min
                    <span className="block text-2xs text-ink-faint">
                      {r.difficulty} · serves {r.servings}
                    </span>
                  </Td>
                  <Td className="tabular-nums text-xs">{r.steps.length}</Td>
                  <Td>
                    <Pill tone={r.isActive ? 'good' : 'neutral'}>
                      {r.isActive ? 'Live' : 'Hidden'}
                    </Pill>
                  </Td>
                  <Td>
                    <div className="flex gap-2">
                      <Btn size="sm" onClick={() => setEditing(r.id)}>
                        Edit
                      </Btn>
                      <Btn size="sm" onClick={() => void toggle(r)} disabled={action.busy}>
                        {r.isActive ? 'Hide' : 'Show'}
                      </Btn>
                      <Btn size="sm" variant="danger" onClick={() => void remove(r)}>
                        Delete
                      </Btn>
                    </div>
                  </Td>
                </tr>
              ))
            )}
          </Table>
        )}
      </Panel>

      {editing ? (
        <RecipeEditor
          recipeId={editing === 'new' ? null : editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            reload();
          }}
        />
      ) : null}
    </>
  );
}

function RecipeEditor({
  recipeId,
  onClose,
  onSaved,
}: {
  recipeId: string | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { data, loading } = useAdminData<RecipesResponse>(recipeId ? '/api/admin/recipes?all=1' : null);
  const { data: productData } = useAdminData<{ products: AdminProductListItem[] }>(
    '/api/admin/products',
  );
  const [form, setForm] = useState<RecipeForm>(blankForm);
  const action = useAdminAction();

  useEffect(() => {
    if (!recipeId || !data) return;
    const r = data.recipes.find((x) => x.id === recipeId);
    if (!r) return;
    setForm({
      id: r.id,
      title: r.title,
      slug: r.slug,
      excerpt: r.excerpt,
      body: r.body ?? '',
      image: r.image ?? null,
      category: r.category,
      servings: r.servings,
      prepMinutes: r.prepMinutes,
      cookMinutes: r.cookMinutes,
      difficulty: r.difficulty,
      steps: (r.steps ?? []).map((s) => ({
        instruction: s.instruction,
        durationMinutes: s.durationMinutes ?? null,
      })),
      ingredients: r.ingredients ?? [],
      relatedProductIds: r.relatedProductIds ?? [],
      order: r.order,
      isActive: r.isActive,
      seoTitle: r.seoTitle,
      seoDescription: r.seoDescription,
    });
  }, [recipeId, data]);

  const patch = <K extends keyof RecipeForm>(key: K, value: RecipeForm[K]) =>
    setForm((f) => ({ ...f, [key]: value }));

  async function save() {
    const res = await action.run(() =>
      adminFetch('/api/admin/recipes', {
        method: 'PUT',
        body: {
          id: form.id,
          title: form.title,
          slug: form.slug,
          excerpt: form.excerpt,
          body: form.body,
          image: form.image,
          category: form.category,
          servings: form.servings,
          prepMinutes: form.prepMinutes,
          cookMinutes: form.cookMinutes,
          difficulty: form.difficulty,
          steps: form.steps
            .filter((s) => s.instruction.trim().length >= 3)
            .map((s) => ({
              instruction: s.instruction,
              ...(s.durationMinutes !== null ? { durationMinutes: s.durationMinutes } : {}),
            })),
          ingredients: form.ingredients.filter(Boolean),
          relatedProductIds: form.relatedProductIds,
          order: form.order,
          isActive: form.isActive,
          seoTitle: form.seoTitle,
          seoDescription: form.seoDescription,
        },
      }),
    );
    if (res) onSaved();
  }

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-ink/40 sm:py-6" role="dialog" aria-modal="true">
      <div className="admin-focus mx-auto min-h-full w-full max-w-3xl bg-cream-50 sm:min-h-0 sm:rounded-xl">
        <header className="sticky top-0 z-10 flex items-center justify-between border-b border-cream-300 bg-cream-50 px-4 py-3">
          <h2 className="font-display text-lg text-jaggery-500">
            {recipeId ? 'Edit recipe' : 'New recipe'}
          </h2>
          <Btn onClick={onClose}>Close</Btn>
        </header>

        <div className="space-y-4 p-4">
          {loading ? <Loading /> : null}
          {action.error ? <InlineAlert tone="bad">{action.error}</InlineAlert> : null}

          <Panel title="Basics">
            <div className="grid gap-3 sm:grid-cols-2">
              <AdminInput
                label="Title"
                required
                value={form.title}
                onChange={(e) => {
                  patch('title', e.target.value);
                  if (!recipeId) {
                    patch(
                      'slug',
                      e.target.value
                        .toLowerCase()
                        .replace(/[^a-z0-9]+/g, '-')
                        .replace(/^-+|-+$/g, ''),
                    );
                  }
                }}
              />
              <AdminInput
                label="URL slug"
                required
                value={form.slug}
                onChange={(e) =>
                  patch(
                    'slug',
                    e.target.value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, ''),
                  )
                }
              />
            </div>
            <div className="mt-3 space-y-3">
              <AdminTextarea
                label="Excerpt"
                required
                rows={2}
                value={form.excerpt}
                onChange={(e) => patch('excerpt', e.target.value)}
                hint="One or two sentences shown on the recipe card."
              />
              <AdminTextarea
                label="Notes / story"
                rows={4}
                value={form.body}
                onChange={(e) => patch('body', e.target.value)}
                hint="Optional. Anything else worth saying about the recipe."
              />
            </div>
            <div className="mt-3 grid gap-3 sm:grid-cols-4">
              <AdminInput
                label="Category"
                value={form.category}
                onChange={(e) => patch('category', e.target.value)}
              />
              <AdminInput
                label="Servings"
                type="number"
                min={1}
                value={form.servings}
                onChange={(e) => patch('servings', Number(e.target.value))}
              />
              <AdminInput
                label="Prep (min)"
                type="number"
                min={0}
                value={form.prepMinutes}
                onChange={(e) => patch('prepMinutes', Number(e.target.value))}
              />
              <AdminInput
                label="Cook (min)"
                type="number"
                min={0}
                value={form.cookMinutes}
                onChange={(e) => patch('cookMinutes', Number(e.target.value))}
              />
            </div>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <AdminSelect
                label="Difficulty"
                value={form.difficulty}
                onChange={(e) => patch('difficulty', e.target.value as RecipeForm['difficulty'])}
              >
                <option value="Easy">Easy</option>
                <option value="Medium">Medium</option>
              </AdminSelect>
              <AdminInput
                label="Order"
                type="number"
                value={form.order}
                onChange={(e) => patch('order', Number(e.target.value))}
              />
            </div>
          </Panel>

          <Panel title="Ingredients">
            <StringListInput
              label="What you need"
              values={form.ingredients}
              onChange={(v) => patch('ingredients', v)}
              placeholder="e.g. 1 tsp Nature's Choice jaggery"
            />
          </Panel>

          <Panel title="Method">
            <ol className="space-y-3">
              {form.steps.map((step, i) => (
                <li key={i} className="rounded-lg border border-cream-300 bg-cream-50 p-3">
                  <div className="mb-2 flex items-center justify-between">
                    <p className="text-xs font-semibold uppercase tracking-wide text-ink-muted">
                      Step {i + 1}
                    </p>
                    {form.steps.length > 1 ? (
                      <Btn
                        size="sm"
                        variant="danger"
                        onClick={() =>
                          patch(
                            'steps',
                            form.steps.filter((_, idx) => idx !== i),
                          )
                        }
                      >
                        Remove
                      </Btn>
                    ) : null}
                  </div>
                  <div className="grid gap-3 sm:grid-cols-3">
                    <div className="sm:col-span-2">
                      <label className="mb-1 block text-xs font-semibold text-ink" htmlFor={`step-${i}`}>
                        Instruction
                      </label>
                      <textarea
                        id={`step-${i}`}
                        rows={3}
                        value={step.instruction}
                        onChange={(e) =>
                          patch(
                            'steps',
                            form.steps.map((s, idx) =>
                              idx === i ? { ...s, instruction: e.target.value } : s,
                            ),
                          )
                        }
                        className="block w-full resize-y rounded-lg border border-cream-400 bg-white px-3 py-2 text-sm leading-relaxed"
                      />
                    </div>
                    <AdminInput
                      label="Minutes (optional)"
                      type="number"
                      min={0}
                      value={step.durationMinutes ?? ''}
                      onChange={(e) =>
                        patch(
                          'steps',
                          form.steps.map((s, idx) =>
                            idx === i
                              ? { ...s, durationMinutes: e.target.value ? Number(e.target.value) : null }
                              : s,
                          ),
                        )
                      }
                    />
                  </div>
                </li>
              ))}
            </ol>
            <div className="mt-3">
              <Btn
                size="sm"
                onClick={() =>
                  patch('steps', [...form.steps, { instruction: '', durationMinutes: null }])
                }
              >
                + Add step
              </Btn>
            </div>
          </Panel>

          <Panel title="Presentation and links">
            <div className="space-y-4">
              <ImageField
                label="Recipe image"
                value={form.image}
                onChange={(v) => patch('image', v)}
                roles={['recipe', 'serving', 'lifestyle']}
                folder="natures-choice/recipes"
              />

              <div>
                <p className="mb-2 text-xs font-semibold text-ink">Related products</p>
                <div className="flex flex-wrap gap-2">
                  {(productData?.products ?? []).map((p) => {
                    const on = form.relatedProductIds.includes(p.id);
                    return (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() =>
                          patch(
                            'relatedProductIds',
                            on
                              ? form.relatedProductIds.filter((x) => x !== p.id)
                              : [...form.relatedProductIds, p.id],
                          )
                        }
                        className={
                          on
                            ? 'rounded-full border border-jaggery-500 bg-jaggery-50 px-3 py-1 text-xs font-semibold text-jaggery-600'
                            : 'rounded-full border border-cream-400 bg-white px-3 py-1 text-xs text-ink-muted hover:bg-cream-50'
                        }
                      >
                        {p.name}
                      </button>
                    );
                  })}
                </div>
              </div>

              <AdminToggle
                label="Published"
                description="Hidden recipes stay editable but disappear from the site."
                checked={form.isActive}
                onChange={(v) => patch('isActive', v)}
              />

              <AdminInput
                label="Meta title"
                value={form.seoTitle}
                onChange={(e) => patch('seoTitle', e.target.value)}
                maxLength={180}
              />
              <AdminTextarea
                label="Meta description"
                rows={2}
                value={form.seoDescription}
                onChange={(e) => patch('seoDescription', e.target.value)}
                maxLength={320}
              />
            </div>
          </Panel>

          <div className="sticky bottom-0 flex justify-end gap-2 border-t border-cream-300 bg-cream-50 py-3">
            <Btn onClick={onClose}>Cancel</Btn>
            <Btn
              variant="primary"
              onClick={() => void save()}
              disabled={action.busy || form.title.length < 3 || form.slug.length < 3}
            >
              {action.busy ? 'Saving…' : 'Save recipe'}
            </Btn>
          </div>
        </div>
      </div>
    </div>
  );
}