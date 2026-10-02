import Link from 'next/link';
import { Accordion } from '@/components/ui/Accordion';
import { Reveal } from '@/components/ui/Reveal';
import { SectionHeading } from '@/components/ui/StateBlocks';
import { Prose } from '@/components/ui/Prose';
import type { FaqDoc } from '@/lib/models/Faq';
import type { ContentDoc } from '@/lib/models/Content';

/** Section 12 — FAQ. Answers are merchant copy; the accordion is accessible by default. */
export function FaqSection({
  content,
  faqs,
}: {
  content: ContentDoc | null;
  faqs: FaqDoc[];
}) {
  return (
    <section className="bg-white py-14 sm:py-20" id="faq">
      <div className="nc-container max-w-3xl">
        <SectionHeading
          as="h2"
          eyebrow={content?.eyebrow?.trim() || 'Questions'}
          title={content?.title?.trim() || 'Questions people actually ask'}
          description={
            content?.body?.trim() ||
            'If something is missing, the contact page reaches a person, not a bot.'
          }
        />

        {faqs.length > 0 ? (
          <Reveal className="mt-10">
            <Accordion
              items={faqs.map((faq, i) => ({
                id: String(faq._id ?? i),
                question: faq.question,
                answer: <Prose>{faq.answer}</Prose>,
              }))}
            />
          </Reveal>
        ) : null}

        <p className="mt-8 text-center text-sm text-ink-muted">
          Still unsure?{' '}
          <Link href="/contact" className="nc-link">
            Ask us directly
          </Link>{' '}
          or read the{' '}
          <Link href="/faq" className="nc-link">
            full FAQ
          </Link>
          .
        </p>
      </div>
    </section>
  );
}