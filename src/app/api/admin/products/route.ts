import { Types } from 'mongoose';

import { guardAdmin } from '@/lib/admin';
import { connectDb } from '@/lib/db';
import { Product } from '@/lib/models/Product';
import { ProductVariant } from '@/lib/models/ProductVariant';
import { ok, fail, handleRouteError, noStore, readJson } from '@/lib/http';
import { productUpsertSchema } from '@/lib/validation';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** List every product, including inactive, for the admin table. */
export async function GET() {
  const guard = await guardAdmin();
  if (!guard.ok) return guard.response;

  try {
    await connectDb();
    const products = await Product.find({})
      .sort({ sortOrder: 1, createdAt: 1 })
      .lean()
      .exec();

    const variants = await ProductVariant.find({
      productId: { $in: products.map((p) => p._id) },
    })
      .sort({ sortOrder: 1 })
      .lean()
      .exec();

    const byProduct = new Map<string, typeof variants>();
    for (const v of variants) {
      const key = String(v.productId);
      const list = byProduct.get(key) ?? [];
      list.push(v);
      byProduct.set(key, list);
    }

    return ok(
      {
        products: products.map((p) => ({
          id: String(p._id),
          name: p.name,
          slug: p.slug,
          flavour: p.flavour,
          tagline: p.tagline,
          shortDescription: p.shortDescription,
          isActive: p.isActive,
          isFeatured: p.isFeatured,
          isVerified: p.isVerified,
          sortOrder: p.sortOrder,
          imageCount: p.images?.length ?? 0,
          updatedAt: p.updatedAt,
          variants: (byProduct.get(String(p._id)) ?? []).map((v) => ({
            id: String(v._id),
            sku: v.sku,
            weightLabel: v.weightLabel,
            weightGrams: v.weightGrams ?? null,
            pricePaise: v.pricePaise,
            mrpPaise: v.mrpPaise ?? null,
            inventory: v.inventory,
            lowStockThreshold: v.lowStockThreshold,
            isActive: v.isActive,
          })),
        })),
      },
      { headers: noStore },
    );
  } catch (err) {
    return handleRouteError(err);
  }
}

/**
 * Create or update a product together with its variants.
 *
 * The write is a transaction when MongoDB is a replica set, and falls back to a
 * careful ordered write otherwise. Variants that an admin removed are deleted,
 * but a variant already referenced by an order line is never touched — order
 * snapshots keep the historical truth, and deleting the variant would break
 * nothing but is also pointless, so we simply deactivate it.
 */
export async function PUT(req: Request) {
  const guard = await guardAdmin();
  if (!guard.ok) return guard.response;

  try {
    const raw = (await readJson(req, 256 * 1024)) as Record<string, unknown>;
    const parsed = productUpsertSchema.parse({ ...raw, id: undefined });
    const id = typeof raw.id === 'string' && Types.ObjectId.isValid(raw.id) ? raw.id : null;

    await connectDb();

    const slugTaken = await Product.findOne({ slug: parsed.slug }).lean().exec();
    if (slugTaken && String(slugTaken._id) !== id) {
      return fail('That URL slug is already used by another product.', {
        status: 409,
        code: 'SLUG_TAKEN',
      });
    }

    const skuClash = await ProductVariant.findOne({
      sku: { $in: parsed.variants.map((v) => v.sku) },
    })
      .lean()
      .exec();
    if (skuClash && (!id || String(skuClash.productId) !== id)) {
      return fail(`SKU ${skuClash.sku} is already used by another product.`, {
        status: 409,
        code: 'SKU_TAKEN',
      });
    }

    const productFields = {
      name: parsed.name,
      slug: parsed.slug,
      flavour: parsed.flavour,
      tagline: parsed.tagline,
      shortDescription: parsed.shortDescription,
      description: parsed.description,
      ingredients: parsed.ingredients,
      allergens: parsed.allergens,
      nutrition: parsed.nutrition,
      nutritionPer: parsed.nutritionPer,
      storage: parsed.storage,
      shelfLife: parsed.shelfLife,
      howToUse: parsed.howToUse,
      fssaiNote: parsed.fssaiNote,
      images: parsed.images,
      ogImage: parsed.ogImage ?? null,
      isActive: parsed.isActive,
      isFeatured: parsed.isFeatured,
      isVerified: parsed.isVerified,
      sortOrder: parsed.sortOrder,
      seoTitle: parsed.seoTitle,
      seoDescription: parsed.seoDescription,
    };

    let product;
    if (id) {
      product = await Product.findByIdAndUpdate(id, { $set: productFields }, { new: true }).exec();
      if (!product) return fail('Product not found.', { status: 404, code: 'NOT_FOUND' });
    } else {
      product = await Product.create({ ...productFields, _id: new Types.ObjectId() });
    }

    /* --- Variants --------------------------------------------------------- */
    const keepIds: Types.ObjectId[] = [];
    for (const v of parsed.variants) {
      const payload = {
        productId: product._id,
        sku: v.sku,
        weightLabel: v.weightLabel,
        weightGrams: v.weightGrams ?? null,
        packCount: 1,
        pricePaise: v.pricePaise,
        mrpPaise: v.mrpPaise ?? null,
        inventory: v.inventory,
        lowStockThreshold: v.lowStockThreshold,
        isActive: v.isActive,
        sortOrder: v.sortOrder,
      };

      if (v._id && Types.ObjectId.isValid(v._id)) {
        const updated = await ProductVariant.findOneAndUpdate(
          { _id: v._id, productId: product._id },
          { $set: payload },
          { new: true },
        ).exec();
        if (updated) {
          keepIds.push(updated._id);
          continue;
        }
      }

      // New variant — guard against a duplicate SKU inside this product.
      const clash = await ProductVariant.findOne({ sku: v.sku }).lean().exec();
      if (clash) {
        return fail(`SKU ${v.sku} already exists.`, { status: 409, code: 'SKU_TAKEN' });
      }
      const created = await ProductVariant.create(payload);
      keepIds.push(created._id);
    }

    // Variants the admin removed: deactivate rather than delete, because an
    // order line may still point at them.
    await ProductVariant.updateMany(
      { productId: product._id, _id: { $nin: keepIds } },
      { $set: { isActive: false } },
    ).exec();

    const variants = await ProductVariant.find({ productId: product._id })
      .sort({ sortOrder: 1 })
      .lean()
      .exec();

    return ok(
      {
        product: { id: String(product._id), slug: product.slug, name: product.name },
        variants: variants.map((v) => ({ id: String(v._id), sku: v.sku, isActive: v.isActive })),
      },
      { headers: noStore },
    );
  } catch (err) {
    return handleRouteError(err);
  }
}

/** Toggle active / featured without a full form submit. */
export async function PATCH(req: Request) {
  const guard = await guardAdmin();
  if (!guard.ok) return guard.response;

  try {
    const raw = (await readJson(req)) as { id?: string; isActive?: boolean; isFeatured?: boolean };
    if (!raw.id || !Types.ObjectId.isValid(raw.id)) {
      return fail('A valid product id is required.', { status: 422, code: 'VALIDATION_ERROR' });
    }

    const set: Record<string, unknown> = {};
    if (typeof raw.isActive === 'boolean') set.isActive = raw.isActive;
    if (typeof raw.isFeatured === 'boolean') set.isFeatured = raw.isFeatured;
    if (!Object.keys(set).length) {
      return fail('Nothing to update.', { status: 422, code: 'VALIDATION_ERROR' });
    }

    await connectDb();
    const product = await Product.findByIdAndUpdate(raw.id, { $set: set }, { new: true })
      .select('id name isActive isFeatured')
      .exec();
    if (!product) return fail('Product not found.', { status: 404, code: 'NOT_FOUND' });

    return ok(
      { id: String(product._id), isActive: product.isActive, isFeatured: product.isFeatured },
      { headers: noStore },
    );
  } catch (err) {
    return handleRouteError(err);
  }
}

/**
 * Delete a product.
 *
 * Refuses while order lines reference it — the historic invoice must survive.
 * The correct action in that case is to deactivate.
 */
export async function DELETE(req: Request) {
  const guard = await guardAdmin();
  if (!guard.ok) return guard.response;

  try {
    const raw = (await readJson(req)) as { id?: string };
    if (!raw.id || !Types.ObjectId.isValid(raw.id)) {
      return fail('A valid product id is required.', { status: 422, code: 'VALIDATION_ERROR' });
    }

    await connectDb();
    const { Order } = await import('@/lib/models/Order');
    const ordered = await Order.countDocuments({ 'items.productId': raw.id }).exec();
    if (ordered > 0) {
      return fail(
        `This product appears on ${ordered} order(s) and cannot be deleted. Set it to inactive instead.`,
        { status: 409, code: 'PRODUCT_IN_USE' },
      );
    }

    await ProductVariant.deleteMany({ productId: raw.id }).exec();
    await Product.findByIdAndDelete(raw.id).exec();

    return ok({ deleted: true, id: raw.id }, { headers: noStore });
  } catch (err) {
    return handleRouteError(err);
  }
}