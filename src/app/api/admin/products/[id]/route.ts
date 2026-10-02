import { Types } from 'mongoose';

import { guardAdmin } from '@/lib/admin';
import { connectDb } from '@/lib/db';
import { Product } from '@/lib/models/Product';
import { ProductVariant } from '@/lib/models/ProductVariant';
import { ok, fail, handleRouteError, noStore } from '@/lib/http';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Full product document for the admin editor.
 *
 * The list endpoint deliberately returns only a summary; the editor needs every
 * field (description, nutrition, images, SEO) plus each variant's `_id` so an
 * existing pack size is updated rather than duplicated.
 */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const guard = await guardAdmin();
  if (!guard.ok) return guard.response;

  try {
    const { id } = await params;
    if (!Types.ObjectId.isValid(id)) {
      return fail('A valid product id is required.', { status: 422, code: 'VALIDATION_ERROR' });
    }

    await connectDb();
    const [product, variants] = await Promise.all([
      Product.findById(id).lean().exec(),
      ProductVariant.find({ productId: id }).sort({ sortOrder: 1 }).lean().exec(),
    ]);

    if (!product) return fail('Product not found.', { status: 404, code: 'NOT_FOUND' });

    return ok(
      {
        product: {
          ...product,
          id: String(product._id),
          _id: undefined,
          createdAt: new Date(product.createdAt).toISOString(),
          updatedAt: new Date(product.updatedAt).toISOString(),
          variants: variants.map((v) => ({
            id: String(v._id),
            _id: String(v._id),
            sku: v.sku,
            weightLabel: v.weightLabel,
            weightGrams: v.weightGrams ?? null,
            pricePaise: v.pricePaise,
            mrpPaise: v.mrpPaise ?? null,
            inventory: v.inventory,
            lowStockThreshold: v.lowStockThreshold,
            isActive: v.isActive,
            sortOrder: v.sortOrder,
          })),
        },
      },
      { headers: noStore },
    );
  } catch (err) {
    return handleRouteError(err);
  }
}