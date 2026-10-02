import './server-only-noop';
import { loadEnv } from './env-boot';
import { connectDb, disconnectDb } from '@/lib/db';
import { Product } from '@/lib/models/Product';
import { ProductVariant } from '@/lib/models/ProductVariant';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const CLASSIC_ASIN = 'B0HKFQKT6F';
const CLASSIC_AMAZON = 'https://www.amazon.in/dp/B0HKFQKT6F';
const CLASSIC_QUESTIONS = 'https://www.amazon.in/dp/B0HKFQKT6F#AskSeller';

const TIL_ASIN = 'B0D9YFR6BX';
const TIL_AMAZON = 'https://www.amazon.in/dp/B0D9YFR6BX';
const TIL_QUESTIONS = 'https://www.amazon.in/dp/B0D9YFR6BX#AskSeller';

function getImages(slug: string) {
  const manifest = JSON.parse(readFileSync(join(process.cwd(), 'scripts/product-images.json'), 'utf8'));
  return manifest[slug] || [];
}

function toMedia(imgs: any[]) {
  return imgs.map(i => ({
    publicId: i.publicId || '',
    url: i.url,
    secureUrl: i.url,
    width: i.width,
    height: i.height,
    role: i.role || 'gallery',
    alt: i.alt || '',
  }));
}

async function main() {
  loadEnv();
  await connectDb();

  // Classic - Desi Chocolatey
  const classic = await Product.findOne({ slug: 'desi-chocolatey-jaggery' });
  if (classic) {
    const imgs = getImages('desi-chocolatey-jaggery');
    classic.name = 'Nature\'s Choice Desi Chocolatey Gud Chocolate Jaggery';
    classic.tagline = 'Classic jaggery, chocolatey finish';
    classic.shortDescription = 'Pure desi gud with a rich chocolatey twist — a natural sweetener with traditional goodness.';
    classic.description = 'Nature\'s Choice Desi Chocolatey Gud is made from pure desi gur with a luscious chocolate flavour. A wholesome alternative to refined sugar, retaining natural minerals. Enjoy straight, in desserts, or sweeten your beverages.';
    classic.images = toMedia(imgs);
    classic.ogImage = imgs.length ? toMedia([imgs[0]])[0] : null;
    classic.marketplace = {
      asin: CLASSIC_ASIN,
      url: CLASSIC_AMAZON,
      questionsUrl: CLASSIC_QUESTIONS,
    };
    classic.isVerified = false;
    await classic.save();
    console.log('Updated classic product');
  }

  // Til
  const til = await Product.findOne({ slug: 'desi-til-chocolatey-jaggery' });
  if (til) {
    const imgs = getImages('desi-til-chocolatey-jaggery');
    til.name = 'Desi Til Chocolatey Jaggery Gud';
    til.tagline = 'Roasted sesame meets chocolatey jaggery';
    til.shortDescription = 'Pure desi gud blended with roasted til and a chocolatey finish.';
    til.description = 'Desi Til Chocolatey Jaggery Gud is made from 100% natural sugarcane juice. Roasted sesame (til) adds nutty warmth to the chocolatey jaggery base.';
    til.images = toMedia(imgs);
    til.ogImage = imgs.length ? toMedia([imgs[0]])[0] : null;
    til.marketplace = {
      asin: TIL_ASIN,
      url: TIL_AMAZON,
      questionsUrl: TIL_QUESTIONS,
    };
    til.isVerified = false;
    await til.save();
    console.log('Updated til product');
  }

  // Only price the 500g variants
  await ProductVariant.findOneAndUpdate(
    { sku: 'NCJ-CLASSIC-500' },
    { $set: { pricePaise: 24900, mrpPaise: 29900 } }
  );
  await ProductVariant.findOneAndUpdate(
    { sku: 'NCJ-TIL-500' },
    { $set: { pricePaise: 24900, mrpPaise: 29900 } }
  );

  console.log('Updated 500g variant prices');

  await disconnectDb();
}

main().catch(async (e) => {
  console.error(e);
  await disconnectDb().catch(() => {});
  process.exit(1);
});
