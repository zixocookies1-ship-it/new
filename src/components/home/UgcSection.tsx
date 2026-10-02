import { OptimizedImage } from '@/components/media/OptimizedImage';
import { Reveal } from '@/components/ui/Reveal';
import { SectionHeading } from '@/components/ui/StateBlocks';
import { readCards } from '@/lib/content';
import type { ContentDoc } from '@/lib/models/Content';
import type { MediaRef } from '@/lib/types';
import type { BusinessSettingsDoc } from '@/lib/models/BusinessSettings';

/**
 * Section 9 — UGC (customer photos).
 *
 * Every tile here is uploaded by a customer through the admin panel, so the
 * section is inherently truthful. With no submissions we show the invitation
 * instead of borrowing stock photography or inventing posts.
 */
export function UgcSection({
  content,
  settings,
}: {
  content: ContentDoc | null;
  settings: BusinessSettingsDoc;
}) {
  const images: MediaRef[] = content?.images ?? [];
  const captions = readCards(content?.items);
  const instagram = settings.social?.instagram?.trim() ?? '';

  return (
    <section className="bg-white py-14 sm:py-20" id="ugc">
      <div className="nc-container">
        <SectionHeading
          as="h2"
          eyebrow={content?.eyebrow?.trim() || 'From the community'}
          title={content?.title?.trim() || 'Shared by customers'}
          description={
            content?.body?.trim() ||
            'Photos sent in by the people who actually unjarred it. If yours is here, thank you.'
          }
        />

        {images.length > 0 ? (
          <div className="mt-10 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {images.slice(0, 8).map((img, i) => {
              const caption = captions[i]?.text ?? '';
              return (
                <Reveal key={img.publicId || i} delay={i * 50}>
                  <figure className="group relative overflow-hidden rounded-card border border-cream-300/70 bg-cream-50">
                    <OptimizedImage
                      media={img}
                      alt={img.alt}
                      aspect="1/1"
                      fit="cover"
                      sizes="(min-width: 1024px) 24vw, (min-width: 640px) 33vw, 48vw"
                      maxWidth={800}
                    />
                    {caption ? (
                      <figcaption className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-jaggery-900/85 to-transparent px-3 pb-3 pt-8 text-xs leading-snug text-cream-50 opacity-0 transition-opacity duration-300 group-hover:opacity-100">
                        {caption}
                      </figcaption>
                    ) : null}
                  </figure>
                </Reveal>
              );
            })}
          </div>
        ) : (
          <Reveal className="mt-10">
            <div className="mx-auto max-w-xl rounded-card border border-dashed border-cream-400 bg-cream-50/70 px-6 py-10 text-center">
              <h3 className="font-display text-lg text-jaggery-500">Be the first to share a photo</h3>
              <p className="nc-body mt-2 text-ink-muted">
                Send us a picture of your jar, your breakfast, or your little experiment. If we love it,
                it goes right here.
              </p>
              <div className="mt-5 flex flex-wrap justify-center gap-3">
                <a href="/contact" className="nc-btn-primary nc-btn-sm">
                  Send a photo
                </a>
                {instagram ? (
                  <a
                    href={instagram}
                    rel="noopener noreferrer nofollow"
                    target="_blank"
                    className="nc-btn-outline nc-btn-sm"
                  >
                    Find us on Instagram
                  </a>
                ) : null}
              </div>
            </div>
          </Reveal>
        )}
      </div>
    </section>
  );
}