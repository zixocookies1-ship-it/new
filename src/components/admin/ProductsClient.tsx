'use client';

import clsx from 'clsx';
import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';

import { adminFetch } from './api';
import { useAdminAction, useAdminData } from './useAdminData';
import { ImageField, ImageListField } from './ImageField';
import {
  AdminInput,
  AdminSelect,
  AdminTextarea,
  AdminToggle,
  Btn,
  EmptyRow,
  InlineAlert,
  Loading,
  MoneyInput,
  PageHeader,
  Panel,
  Pill,
  StringListInput,
  Table,
  Td,
  Th,
  Toolbar,
} from './ui';
import type { AdminMediaRef, AdminProductDetail, AdminProductListItem } from './types';
import { formatINR } from '@/lib/money';
import { PRODUCT_FLAVOURS, type MediaRole } from '@/lib/types';

interface ProductsResponse {
  products: AdminProductListItem[];
}

interface VariantForm {
  _id?: string;
  sku: string;
  weightLabel: string;
  weightGrams: number | null;
  pricePaise: number;
  mrpPaise: number | null;
  inventory: number;
  lowStockThreshold: number;
  isActive: boolean;
  sortOrder: number;
}

interface NutritionForm {
  label: string;
  per100g: string;
  perServing: string;
}

interface ProductForm {
  id?: string;
  name: string;
  slug: string;
  flavour: 'classic' | 'til';
  tagline: string;
  shortDescription: string;
  description: string;
  ingredients: string[];
  allergens: string[];
  nutrition: NutritionForm[];
  nutritionPer: { amount: number; unit: string; label: string };
  storage: string;
  shelfLife: string;
  howToUse: string[];
  fssaiNote: string;
  images: AdminMediaRef[];
  ogImage: AdminMediaRef | null;
  variants: VariantForm[];
  isActive: boolean;
  isFeatured: boolean;
  isVerified: boolean;
  sortOrder: number;
  seoTitle: string;
  seoDescription: string;
}

const PRODUCT_IMAGE_ROLES: MediaRole[] = [
  'front_pack',
  'open_jar',
  'texture_closeup',
  'ingredients',
  'serving',
  'lifestyle',
  'back_label',
  'gallery',
];

function blankProduct(): ProductForm {
  return {
    name: '',
    slug: '',
    flavour: 'classic',
    tagline: '',
    shortDescription: '',
    description: '',
    ingredients: [],
    allergens: [],
    nutrition: [],
    nutritionPer: { amount: 100, unit: 'g', label: 'Per 100g' },
    storage: '',
    shelfLife: '',
    howToUse: [],
    fssaiNote: '',
    images: [],
    ogImage: null,
    variants: [
      {
        sku: '',
        weightLabel: '',
        weightGrams: null,
        pricePaise: 0,
        mrpPaise: null,
        inventory: 0,
        lowStockThreshold: 5,
        isActive: true,
        sortOrder: 0,
      },
    ],
    isActive: true,
    isFeatured: false,
    isVerified: false,
    sortOrder: 0,
    seoTitle: '',
    seoDescription: '',
  };
}

function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/['’]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 180);
}

export function ProductsClient() {
  const { data, error, loading, reload } = useAdminData<ProductsResponse>('/api/admin/products');
  const [editing, setEditing] = useState<string | 'new' | null>(null);
  const action = useAdminAction();

  async function toggleActive(p: AdminProductListItem) {
    await action.run(() =>
      adminFetch('/api/admin/products', { method: 'PATCH', body: { id: p.id, isActive: !p.isActive } }),
    );
    reload();
  }

  async function toggleFeatured(p: AdminProductListItem) {
    await action.run(() =>
      adminFetch('/api/admin/products', {
        method: 'PATCH',
        body: { id: p.id, isFeatured: !p.isFeatured },
      }),
    );
    reload();
  }

  async function remove(p: AdminProductListItem) {
    if (
      !window.confirm(
        `Delete "${p.name}"?\n\nThis is refused if the product appears on any order — deactivate it instead.`,
      )
    ) {
      return;
    }
    const res = await action.run(() =>
      adminFetch('/api/admin/products', { method: 'DELETE', body: { id: p.id } }),
    );
    if (res) reload();
  }

  return (
    <>
      <PageHeader
        title="Products"
        description="Three flavours, each with its own pack sizes, prices and photography."
        action={<Btn variant="primary" onClick={() => setEditing('new')}>+ New product</Btn>}
      />

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
            minWidth={900}
            headers={
              <>
                <Th>Product</Th>
                <Th>Flavour</Th>
                <Th>Pack sizes</Th>
                <Th>Stock</Th>
                <Th>State</Th>
                <Th>Storefront</Th>
                <Th />
              </>
            }
          >
            {!data?.products.length ? (
              <EmptyRow
                colSpan={7}
                message="No products yet. Add one before the shop can sell anything."
              />
            ) : (
              data.products.map((p) => {
                const inStock = p.variants.filter((v) => v.isActive && v.inventory > 0);
                return (
                  <tr key={p.id}>
                    <Td>
                      <span className="block font-semibold text-ink">{p.name}</span>
                      <span className="block font-mono text-2xs text-ink-faint">/{p.slug}</span>
                    </Td>
                    <Td>
                      <Pill tone="neutral">{p.flavour}</Pill>
                    </Td>
                    <Td>
                      <ul className="space-y-0.5">
                        {p.variants.length === 0 ? (
                          <li className="text-2xs text-ink-faint">none</li>
                        ) : (
                          p.variants.map((v) => (
                            <li key={v.id} className="whitespace-nowrap text-xs">
                              <span className={clsx(v.isActive ? 'text-ink-soft' : 'text-ink-faint line-through')}>
                                {v.weightLabel}
                              </span>{' '}
                              <span className="tabular-nums text-ink-faint">
                                {formatINR(v.pricePaise)} · {v.inventory} in stock
                              </span>
                            </li>
                          ))
                        )}
                      </ul>
                    </Td>
                    <Td>
                      {inStock.length ? (
                        <Pill tone="good">In stock</Pill>
                      ) : (
                        <Pill tone="bad">Out of stock</Pill>
                      )}
                    </Td>
                    <Td className="space-y-1">
                      <span className="block">
                        <Pill tone={p.isActive ? 'good' : 'neutral'}>
                          {p.isActive ? 'Active' : 'Inactive'}
                        </Pill>
                      </span>
                      {p.isVerified ? (
                        <span className="block">
                          <Pill tone="jaggery">Verified</Pill>
                        </span>
                      ) : (
                        <span className="block">
                          <Pill tone="warn">Unverified</Pill>
                        </span>
                      )}
                    </Td>
                    <Td className="text-xs">
                      <label className="flex items-center gap-1.5">
                        <input
                          type="checkbox"
                          checked={p.isFeatured}
                          disabled={action.busy}
                          onChange={() => void toggleFeatured(p)}
                          className="h-4 w-4 accent-[#5A321F]"
                        />
                        Featured
                      </label>
                      <label className="mt-1 flex items-center gap-1.5">
                        <input
                          type="checkbox"
                          checked={p.isActive}
                          disabled={action.busy}
                          onChange={() => void toggleActive(p)}
                          className="h-4 w-4 accent-[#5A321F]"
                        />
                        Listed
                      </label>
                    </Td>
                    <Td>
                      <div className="flex flex-wrap gap-2">
                        <Btn size="sm" onClick={() => setEditing(p.id)}>
                          Edit
                        </Btn>
                        <Btn size="sm" variant="danger" onClick={() => void remove(p)}>
                          Delete
                        </Btn>
                      </div>
                    </Td>
                  </tr>
                );
              })
            )}
          </Table>
        )}
        {error ? (
          <div className="mt-3">
            <InlineAlert tone="bad">{error}</InlineAlert>
          </div>
        ) : null}
      </Panel>

      {editing ? (
        <ProductEditor
          productId={editing === 'new' ? null : editing}
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

/* -------------------------------------------------------------------------- */
/* Editor                                                                      */
/* -------------------------------------------------------------------------- */

function ProductEditor({
  productId,
  onClose,
  onSaved,
}: {
  productId: string | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { data, loading, error } = useAdminData<{ product: AdminProductDetail }>(
    productId ? `/api/admin/products/${productId}` : null,
  );
  const [form, setForm] = useState<ProductForm>(blankProduct);
  const [slugTouched, setSlugTouched] = useState(false);
  const [saved, setSaved] = useState(false);
  const action = useAdminAction();

  useEffect(() => {
    const p = data?.product;
    if (!p) return;
    setForm({
      id: p.id,
      name: p.name ?? '',
      slug: p.slug ?? '',
      flavour: p.flavour ?? 'classic',
      tagline: p.tagline ?? '',
      shortDescription: p.shortDescription ?? '',
      description: p.description ?? '',
      ingredients: p.ingredients ?? [],
      allergens: p.allergens ?? [],
      nutrition: (p.nutrition ?? []).map((n) => ({
        label: n.label ?? '',
        per100g: n.per100g ?? '',
        perServing: n.perServing ?? '',
      })),
      nutritionPer: {
        amount: p.nutritionPer?.amount ?? 100,
        unit: p.nutritionPer?.unit ?? 'g',
        label: p.nutritionPer?.label ?? 'Per 100g',
      },
      storage: p.storage ?? '',
      shelfLife: p.shelfLife ?? '',
      howToUse: p.howToUse ?? [],
      fssaiNote: p.fssaiNote ?? '',
      images: (p.images ?? []) as AdminMediaRef[],
      ogImage: (p.ogImage ?? null) as AdminMediaRef | null,
      variants: (p.variants ?? []).map((v) => ({
        _id: v.id,
        sku: v.sku ?? '',
        weightLabel: v.weightLabel ?? '',
        weightGrams: v.weightGrams ?? null,
        pricePaise: v.pricePaise ?? 0,
        mrpPaise: v.mrpPaise ?? null,
        inventory: v.inventory ?? 0,
        lowStockThreshold: v.lowStockThreshold ?? 0,
        isActive: v.isActive ?? true,
        sortOrder: 0,
      })),
      isActive: p.isActive ?? true,
      isFeatured: p.isFeatured ?? false,
      isVerified: p.isVerified ?? false,
      sortOrder: p.sortOrder ?? 0,
      seoTitle: p.seoTitle ?? '',
      seoDescription: p.seoDescription ?? '',
    });
    setSlugTouched(true);
  }, [data]);

  const patch = useMemo(
    () => <K extends keyof ProductForm>(key: K, value: ProductForm[K]) =>
      setForm((f) => ({ ...f, [key]: value })),
    [],
  );

  const patchVariant = (index: number, key: keyof VariantForm, value: unknown) => {
    setForm((f) => ({
      ...f,
      variants: f.variants.map((v, i) => (i === index ? { ...v, [key]: value } : v)),
    }));
  };

  async function save() {
    const payload = {
      id: form.id,
      name: form.name,
      slug: form.slug,
      flavour: form.flavour,
      tagline: form.tagline,
      shortDescription: form.shortDescription,
      description: form.description,
      ingredients: form.ingredients.filter(Boolean),
      allergens: form.allergens.filter(Boolean),
      nutrition: form.nutrition.filter((n) => n.label.trim()),
      nutritionPer: form.nutritionPer,
      storage: form.storage,
      shelfLife: form.shelfLife,
      howToUse: form.howToUse.filter(Boolean),
      fssaiNote: form.fssaiNote,
      images: form.images,
      ogImage: form.ogImage,
      variants: form.variants.map((v, i) => ({
        _id: v._id,
        sku: v.sku,
        weightLabel: v.weightLabel,
        weightGrams: v.weightGrams ?? undefined,
        pricePaise: v.pricePaise,
        mrpPaise: v.mrpPaise,
        inventory: v.inventory,
        lowStockThreshold: v.lowStockThreshold,
        isActive: v.isActive,
        sortOrder: i,
      })),
      isActive: form.isActive,
      isFeatured: form.isFeatured,
      isVerified: form.isVerified,
      sortOrder: form.sortOrder,
      seoTitle: form.seoTitle,
      seoDescription: form.seoDescription,
    };

    const res = await action.run(() =>
      adminFetch<{ product: { slug: string } }>('/api/admin/products', {
        method: 'PUT',
        body: payload,
      }),
    );
    if (res) {
      setSaved(true);
      onSaved();
    }
  }

  const altComplete = form.images.every((i) => i.alt.trim().length > 0);
  const canSave = form.name.trim().length >= 2 && form.variants.length > 0 && altComplete;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-ink/40 py-0 sm:py-6" role="dialog" aria-modal="true">
      <div className="admin-focus mx-auto min-h-full w-full max-w-4xl bg-cream-50 sm:min-h-0 sm:rounded-xl">
        <header className="sticky top-0 z-10 flex items-center justify-between gap-3 border-b border-cream-300 bg-cream-50 px-4 py-3">
          <div className="min-w-0">
            <h2 className="font-display text-lg text-jaggery-500">
              {productId ? `Edit ${data?.product?.name ?? 'product'}` : 'New product'}
            </h2>
            <p className="text-xs text-ink-muted">
              Everything here is what the storefront will render. Leave a field empty rather than
              inventing it.
            </p>
          </div>
          <div className="flex shrink-0 gap-2">
            {form.slug ? (
              <Link
                href={`/products/${form.slug}`}
                target="_blank"
                className="hidden items-center rounded-lg border border-cream-400 bg-white px-2.5 py-1.5 text-xs font-semibold text-jaggery-500 sm:inline-flex"
              >
                Preview
              </Link>
            ) : null}
            <Btn onClick={onClose}>Close</Btn>
          </div>
        </header>

        <div className="space-y-4 p-4">
          {loading ? <Loading /> : null}
          {error ? <InlineAlert tone="bad">{error}</InlineAlert> : null}
          {action.error ? <InlineAlert tone="bad">{action.error}</InlineAlert> : null}
          {saved ? <InlineAlert tone="good">Saved.</InlineAlert> : null}
          {!altComplete ? (
            <InlineAlert tone="warn">
              Every image needs alt text before this product can be saved — that is an accessibility
              requirement, not a preference.
            </InlineAlert>
          ) : null}

          <Panel title="Basics">
            <div className="grid gap-3 sm:grid-cols-2">
              <AdminInput
                label="Name"
                required
                value={form.name}
                onChange={(e) => {
                  patch('name', e.target.value);
                  if (!slugTouched) patch('slug', slugify(e.target.value));
                }}
                placeholder="Desi Chocolatey Jaggery"
              />
              <AdminInput
                label="URL slug"
                required
                value={form.slug}
                onChange={(e) => {
                  setSlugTouched(true);
                  patch('slug', slugify(e.target.value));
                }}
                hint={`/products/${form.slug || '…'}`}
              />
              <AdminSelect
                label="Flavour"
                value={form.flavour}
                onChange={(e) => patch('flavour', e.target.value as ProductForm['flavour'])}
              >
                {PRODUCT_FLAVOURS.map((f) => (
                  <option key={f} value={f}>
                    {f}
                  </option>
                ))}
              </AdminSelect>
              <AdminInput
                label="Tagline"
                value={form.tagline}
                onChange={(e) => patch('tagline', e.target.value)}
                maxLength={200}
              />
            </div>
            <div className="mt-3 space-y-3">
              <AdminTextarea
                label="Short description"
                required
                rows={2}
                value={form.shortDescription}
                onChange={(e) => patch('shortDescription', e.target.value)}
                hint="Used on cards and search results. 10–320 characters."
              />
              <AdminTextarea
                label="Full description"
                required
                rows={8}
                value={form.description}
                onChange={(e) => patch('description', e.target.value)}
              />
            </div>
          </Panel>

          <Panel
            title="Pack sizes and pricing"
            description="Prices are what customers pay. All money is stored in paise; this form speaks rupees."
          >
            <div className="space-y-3">
              {form.variants.map((v, i) => (
                <div key={v._id ?? `new-${i}`} className="rounded-lg border border-cream-300 bg-cream-50 p-3">
                  <div className="mb-2 flex items-center justify-between">
                    <p className="text-xs font-semibold uppercase tracking-wide text-ink-muted">
                      Pack {i + 1}
                    </p>
                    {form.variants.length > 1 ? (
                      <Btn
                        size="sm"
                        variant="danger"
                        onClick={() =>
                          setForm((f) => ({ ...f, variants: f.variants.filter((_, idx) => idx !== i) }))
                        }
                      >
                        Remove pack
                      </Btn>
                    ) : null}
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    <AdminInput
                      label="Pack label"
                      required
                      value={v.weightLabel}
                      onChange={(e) => patchVariant(i, 'weightLabel', e.target.value)}
                      placeholder="250 g jar"
                    />
                    <AdminInput
                      label="SKU"
                      required
                      value={v.sku}
                      onChange={(e) => patchVariant(i, 'sku', e.target.value.toUpperCase())}
                      placeholder="NC-JAG-CLS-250"
                    />
                    <AdminInput
                      label="Weight (grams)"
                      type="number"
                      min={1}
                      value={v.weightGrams ?? ''}
                      onChange={(e) =>
                        patchVariant(i, 'weightGrams', e.target.value ? Number(e.target.value) : null)
                      }
                      hint="Used for weight-based shipping."
                    />
                    <MoneyInput
                      label="Selling price (₹)"
                      paise={v.pricePaise}
                      onChange={(p) => patchVariant(i, 'pricePaise', p ?? 0)}
                    />
                    <MoneyInput
                      label="MRP (₹)"
                      paise={v.mrpPaise}
                      onChange={(p) => patchVariant(i, 'mrpPaise', p)}
                      allowBlank
                      hint="Leave blank to show no strike-through price."
                    />
                    <AdminInput
                      label="Stock on hand"
                      type="number"
                      min={0}
                      value={v.inventory}
                      onChange={(e) => patchVariant(i, 'inventory', Number(e.target.value))}
                    />
                    <AdminInput
                      label="Low-stock threshold"
                      type="number"
                      min={0}
                      value={v.lowStockThreshold}
                      onChange={(e) => patchVariant(i, 'lowStockThreshold', Number(e.target.value))}
                      hint="Warn me on the dashboard at or below this."
                    />
                    <AdminToggle
                      label="Available to buy"
                      description="Turn off to hide this pack without deleting it."
                      checked={v.isActive}
                      onChange={(next) => patchVariant(i, 'isActive', next)}
                    />
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-3">
              <Btn
                onClick={() =>
                  setForm((f) => ({
                    ...f,
                    variants: [
                      ...f.variants,
                      {
                        sku: '',
                        weightLabel: '',
                        weightGrams: null,
                        pricePaise: 0,
                        mrpPaise: null,
                        inventory: 0,
                        lowStockThreshold: 5,
                        isActive: true,
                        sortOrder: f.variants.length,
                      },
                    ],
                  }))
                }
              >
                + Add pack size
              </Btn>
            </div>
          </Panel>

          <Panel title="Photography" description="Uploads go to Cloudinary. No image bytes are stored in MongoDB.">
            <div className="space-y-5">
              <ImageListField
                label="Product images"
                hint="The first image is used on cards and the product page. Add a back-label shot for the label gallery."
                value={form.images}
                onChange={(next) => patch('images', next)}
                roles={PRODUCT_IMAGE_ROLES}
                folder="natures-choice/products"
              />
              <ImageField
                label="Social share image"
                hint="Optional. Falls back to the first product image."
                value={form.ogImage}
                onChange={(next) => patch('ogImage', next)}
                roles={['og_image', 'front_pack']}
                folder="natures-choice/products"
              />
            </div>
          </Panel>

          <Panel
            title="Product facts"
            description="Only publish what you can substantiate. Leave a list empty and the storefront prints nothing."
          >
            <div className="grid gap-4 sm:grid-cols-2">
              <StringListInput
                label="Ingredients"
                values={form.ingredients}
                onChange={(v) => patch('ingredients', v)}
                placeholder="e.g. Grated jaggery"
              />
              <StringListInput
                label="Allergens"
                values={form.allergens}
                onChange={(v) => patch('allergens', v)}
                placeholder="e.g. Not applicable — write 'None declared' only if true"
              />
              <StringListInput
                label="How to use"
                values={form.howToUse}
                onChange={(v) => patch('howToUse', v)}
                addLabel="Add step"
                multiline
              />
            </div>

            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <AdminInput
                label="Storage"
                value={form.storage}
                onChange={(e) => patch('storage', e.target.value)}
                placeholder="Store in a cool, dry place, away from direct sunlight."
              />
              <AdminInput
                label="Shelf life"
                value={form.shelfLife}
                onChange={(e) => patch('shelfLife', e.target.value)}
                placeholder="e.g. 12 months from manufacture"
              />
              <AdminInput
                label="FSSAI note"
                value={form.fssaiNote}
                onChange={(e) => patch('fssaiNote', e.target.value)}
                placeholder="Only if a licence number actually applies to this product."
              />
            </div>

            <div className="mt-4 border-t border-cream-200 pt-4">
              <p className="text-xs font-semibold text-ink">Nutrition</p>
              <p className="mt-0.5 text-xs text-ink-muted">
                Optional. With no rows the storefront renders no nutrition panel at all — we never
                show a fabricated table.
              </p>
              <div className="mt-2 grid gap-3 sm:grid-cols-4">
                <AdminInput
                  label="Basis amount"
                  type="number"
                  min={0}
                  value={form.nutritionPer.amount}
                  onChange={(e) =>
                    patch('nutritionPer', { ...form.nutritionPer, amount: Number(e.target.value) })
                  }
                />
                <AdminInput
                  label="Unit"
                  value={form.nutritionPer.unit}
                  onChange={(e) => patch('nutritionPer', { ...form.nutritionPer, unit: e.target.value })}
                />
                <AdminInput
                  label="Basis label"
                  value={form.nutritionPer.label}
                  onChange={(e) => patch('nutritionPer', { ...form.nutritionPer, label: e.target.value })}
                  className="sm:col-span-2"
                />
              </div>

              <ul className="mt-3 space-y-2">
                {form.nutrition.map((row, i) => (
                  <li key={i} className="grid gap-2 rounded-lg border border-cream-200 p-2 sm:grid-cols-4">
                    <input
                      aria-label={`Nutrient ${i + 1} name`}
                      value={row.label}
                      placeholder="Energy (kcal)"
                      onChange={(e) =>
                        patch(
                          'nutrition',
                          form.nutrition.map((n, idx) =>
                            idx === i ? { ...n, label: e.target.value } : n,
                          ),
                        )
                      }
                      className="rounded-lg border border-cream-400 px-2.5 py-1.5 text-sm"
                    />
                    <input
                      aria-label={`Nutrient ${i + 1} per 100g`}
                      value={row.per100g}
                      placeholder="per 100g"
                      onChange={(e) =>
                        patch(
                          'nutrition',
                          form.nutrition.map((n, idx) =>
                            idx === i ? { ...n, per100g: e.target.value } : n,
                          ),
                        )
                      }
                      className="rounded-lg border border-cream-400 px-2.5 py-1.5 text-sm"
                    />
                    <input
                      aria-label={`Nutrient ${i + 1} per serving`}
                      value={row.perServing}
                      placeholder="per serving"
                      onChange={(e) =>
                        patch(
                          'nutrition',
                          form.nutrition.map((n, idx) =>
                            idx === i ? { ...n, perServing: e.target.value } : n,
                          ),
                        )
                      }
                      className="rounded-lg border border-cream-400 px-2.5 py-1.5 text-sm"
                    />
                    <button
                      type="button"
                      onClick={() =>
                        patch(
                          'nutrition',
                          form.nutrition.filter((_, idx) => idx !== i),
                        )
                      }
                      className="rounded-lg border border-cream-300 px-2 py-1.5 text-xs font-semibold text-ink-muted hover:border-[#D9B4B4] hover:text-[#8F3333]"
                    >
                      Remove
                    </button>
                  </li>
                ))}
              </ul>
              <div className="mt-2 flex gap-2">
                <Btn
                  size="sm"
                  onClick={() => patch('nutrition', [...form.nutrition, { label: '', per100g: '', perServing: '' }])}
                >
                  + Add nutrient row
                </Btn>
              </div>
            </div>
          </Panel>

          <Panel title="Visibility and verification">
            <div className="space-y-2">
              <AdminToggle
                label="Listed on the storefront"
                description="Inactive products are hidden from the shop but keep their orders."
                checked={form.isActive}
                onChange={(v) => patch('isActive', v)}
              />
              <AdminToggle
                label="Featured product"
                description="Only one product should be featured — it fills the homepage feature slot."
                checked={form.isFeatured}
                onChange={(v) => patch('isFeatured', v)}
              />
              <AdminToggle
                tone="warning"
                label="I have verified every value on this product"
                description="Price, ingredients, nutrition, FSSAI note and legal details. Until this is ticked, the storefront marks unverified claims as placeholders instead of stating them as fact."
                checked={form.isVerified}
                onChange={(v) => patch('isVerified', v)}
              />
            </div>
            <div className="mt-3">
              <AdminInput
                label="Sort order"
                type="number"
                value={form.sortOrder}
                onChange={(e) => patch('sortOrder', Number(e.target.value))}
                hint="Lower numbers come first."
                className="sm:max-w-[200px]"
              />
            </div>
          </Panel>

          <Panel title="SEO" description="Leave blank to fall back to the product name and short description.">
            <div className="space-y-3">
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

          <div className="sticky bottom-0 flex flex-wrap items-center justify-between gap-3 border-t border-cream-300 bg-cream-50 py-3">
            <p className="text-xs text-ink-muted">
              {canSave
                ? 'Ready to save.'
                : 'A name, at least one pack size and alt text on every image are required.'}
            </p>
            <div className="flex gap-2">
              <Btn onClick={onClose}>Cancel</Btn>
              <Btn variant="primary" onClick={() => void save()} disabled={!canSave || action.busy}>
                {action.busy ? 'Saving…' : 'Save product'}
              </Btn>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}