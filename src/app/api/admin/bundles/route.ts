import { Types } from 'mongoose';

import { guardAdmin } from '@/lib/admin';
import { connectDb } from '@/lib/db';
import { Bundle, computeBundleSavings } from '@/lib/models/Bundle';
import { Product } from '@/lib/models/Product';
import { ProductVariant } from '@/lib/models/ProductVariant';
import { ok, fail, handleRouteError, noStore, readJson } from '@/lib/http';
import { bundleUpsertSchema } from '@/lib/validation';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  const guard = await guardAdmin();
  if (!guard.ok) return guard.response;

  try {
    await connectDb();
    const bundles = await Bundle.find({}).sort({ sortOrder: 1 }).lean().exec();

    const productIds = [...new Set(bundles.flatMap((b) => b.lines.map((l) => String(l.productId))))];
    const variantIds = [
      ...new Set<string>(
        bundles.flatMap((b) => b.lines.map((l) => String(l.variantId ?? ''))).filter(Boolean),
      ),
    ];

    const [products, variants] = await Promise.all([
      productIds.length
        ? Product.find({ _id: { $in: productIds.map((id) => new Types.ObjectId(id)) } })
            .select('name slug flavour')
            .lean()
            .exec()
        : [],
      variantIds.length
        ? ProductVariant.find({ _id: { $in: variantIds.map((id) => new Types.ObjectId(id)) } })
            .select('sku weightLabel pricePaise isActive')
            .lean()
            .exec()
        : [],
    ]);

    const productById = new Map(products.map((p) => [String(p._id), p]));
    const variantById = new Map(variants.map((v) => [String(v._id), v]));

    return ok(
      {
        bundles: bundles.map((b) => {
          const lines = b.lines.map((l) => {
            const p = productById.get(String(l.productId));
            const v = l.variantId ? variantById.get(String(l.variantId)) : null;
            return {
              productId: String(l.productId),
              productName: p?.name ?? '(deleted product)',
              productSlug: p?.slug ?? '',
              flavour: p?.flavour ?? null,
              variantId: l.variantId ? String(l.variantId) : null,
              variantSku: v?.sku ?? null,
              weightLabel: v?.weightLabel ?? '',
              unitPricePaise: v?.pricePaise ?? null,
              qty: l.qty,
              /** Null when the variant is gone — savings must not be fabricated. */
              resolvable: Boolean(p && (l.variantId ? v : true)),
            };
          });

          const individualTotal = lines.every((l) => l.unitPricePaise !== null)
            ? lines.reduce((s, l) => s + (l.unitPricePaise ?? 0) * l.qty, 0)
            : null;

          return {
            id: String(b._id),
            name: b.name,
            slug: b.slug,
            shortDescription: b.shortDescription,
            description: b.description,
            image: b.image,
            lines,
            bundlePricePaise: b.bundlePricePaise,
            compareAtPaise: b.compareAtPaise,
            isActive: b.isActive,
            sortOrder: b.sortOrder,
            seoTitle: b.seoTitle,
            seoDescription: b.seoDescription,
            savings:
              individualTotal === null
                ? null
                : computeBundleSavings(individualTotal, b.bundlePricePaise),
          };
        }),
      },
      { headers: noStore },
    );
  } catch (err) {
    return handleRouteError(err);
  }
}

export async function PUT(req: Request) {
  const guard = await guardAdmin();
  if (!guard.ok) return guard.response;

  try {
    const raw = (await readJson(req, 64 * 1024)) as Record<string, unknown>;
    const id = typeof raw.id === 'string' && Types.ObjectId.isValid(raw.id) ? raw.id : null;
    const body = bundleUpsertSchema.parse({ ...raw, id: undefined });

    await connectDb();

    const slugTaken = await Bundle.findOne({ slug: body.slug }).lean().exec();
    if (slugTaken && String(slugTaken._id) !== id) {
      return fail('That bundle slug is already in use.', { status: 409, code: 'SLUG_TAKEN' });
    }

    // Every referenced product/variant must exist, and the bundle must not be
    // priced above the sum of its parts (a "bundle" that costs more is a bug,
    // and the "Save ₹X" badge would then be silently hidden).
    const productIds = body.lines.map((l) => l.productId);
    const variantIds = body.lines.map((l) => l.variantId).filter((v): v is string => Boolean(v));

    const [products, variants] = await Promise.all([
      Product.countDocuments({ _id: { $in: productIds.map((p) => new Types.ObjectId(p)) } }).exec(),
      variantIds.length
        ? ProductVariant.countDocuments({ _id: { $in: variantIds.map((v) => new Types.ObjectId(v)) } }).exec()
        : Promise.resolve(0),
    ]);

    if (products !== productIds.length) {
      return fail('One or more products in this bundle no longer exist.', {
        status: 422,
        code: 'INVALID_BUNDLE_LINE',
      });
    }
    if (variants !== variantIds.length) {
      return fail('One or more pack sizes in this bundle no longer exist.', {
        status: 422,
        code: 'INVALID_BUNDLE_LINE',
      });
    }

    const payload = {
      name: body.name,
      slug: body.slug,
      shortDescription: body.shortDescription,
      description: body.description,
      image: body.image ?? null,
      lines: body.lines.map((l) => ({
        productId: new Types.ObjectId(l.productId),
        variantId: l.variantId ? new Types.ObjectId(l.variantId) : null,
        qty: l.qty,
      })),
      bundlePricePaise: body.bundlePricePaise,
      compareAtPaise: body.compareAtPaise ?? null,
      isActive: body.isActive,
      sortOrder: body.sortOrder,
      seoTitle: body.seoTitle,
      seoDescription: body.seoDescription,
    };

    const doc = id
      ? await Bundle.findByIdAndUpdate(id, { $set: payload }, { new: true }).exec()
      : await Bundle.create(payload);

    if (!doc) return fail('Bundle not found.', { status: 404, code: 'NOT_FOUND' });

    // Report whether the configured price actually beats the sum of parts.
    const variantPrices = await ProductVariant.find({
      _id: { $in: payload.lines.filter((l) => l.variantId).map((l) => l.variantId) },
    })
      .select('pricePaise')
      .lean()
      .exec();
    const priceById = new Map(variantPrices.map((v) => [String(v._id), v.pricePaise]));

    const fullyPriced = payload.lines.every((l) => !l.variantId || priceById.has(String(l.variantId)));
    const individualTotal = fullyPriced
      ? payload.lines.reduce((s, l) => {
          const unit = l.variantId ? (priceById.get(String(l.variantId)) ?? 0) : 0;
          return s + unit * l.qty;
        }, 0)
      : null;

    return ok(
      {
        id: String(doc._id),
        slug: doc.slug,
        savings: individualTotal === null ? null : computeBundleSavings(individualTotal, doc.bundlePricePaise),
      },
      { headers: noStore },
    );
  } catch (err) {
    return handleRouteError(err);
  }
}

export async function DELETE(req: Request) {
  const guard = await guardAdmin();
  if (!guard.ok) return guard.response;

  try {
    const id = new URL(req.url).searchParams.get('id') ?? '';
    if (!Types.ObjectId.isValid(id)) {
      return fail('A valid bundle id is required.', { status: 422, code: 'VALIDATION_ERROR' });
    }
    await connectDb();
    const doc = await Bundle.findByIdAndDelete(id).exec();
    if (!doc) return fail('Bundle not found.', { status: 404, code: 'NOT_FOUND' });
    return ok({ deleted: true, id }, { headers: noStore });
  } catch (err) {
    return handleRouteError(err);
  }
}