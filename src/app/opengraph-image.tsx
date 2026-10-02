import { ImageResponse } from 'next/og';

/**
 * Default social share image.
 *
 * Every page falls back to this when the merchant has not uploaded a specific
 * `defaultOgImageUrl`, so a link pasted into WhatsApp or X still renders as a
 * branded card rather than a bare text preview.
 *
 * Deliberately typographic: no product photograph, no award badge, no rating and
 * no claim. Until the merchant uploads a real pack shot there is nothing honest
 * to show but the name.
 */

export const runtime = 'nodejs';
export const alt = "Nature's Choice Jaggery — the new age of Indian jaggery";
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

/* Brand palette. Keep in sync with tailwind.config.ts. */
const BROWN = '#5A321F';
const CREAM = '#F7F1E7';
const GREEN = '#314C38';
const GINGER = '#C87945';

export default async function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          backgroundColor: CREAM,
          padding: '72px 80px',
          position: 'relative',
        }}
      >
        {/* Brand colour band — the same cream/brown split the storefront uses. */}
        <div
          style={{
            position: 'absolute',
            left: 0,
            top: 0,
            bottom: 0,
            width: 28,
            backgroundColor: GINGER,
            display: 'flex',
          }}
        />

        <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
          {/* The same stylised jar as src/app/icon.svg, drawn inline. */}
          <svg width="72" height="72" viewBox="0 0 32 32">
            <rect width="32" height="32" rx="7" fill={BROWN} />
            <g
              fill="none"
              stroke={CREAM}
              strokeWidth={1.7}
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path
                d="M11.6 12.6h8.8l-.8 10.7a1.8 1.8 0 0 1-1.8 1.6h-3.6a1.8 1.8 0 0 1-1.8-1.6l-.8-10.7Z"
                fill={CREAM}
                fillOpacity={0.22}
              />
              <path d="M10.3 12.6h11.4" />
              <path d="M13.4 12.6v-1.5a2.6 2.6 0 0 1 5.2 0v1.5" />
            </g>
          </svg>
          <div
            style={{
              display: 'flex',
              fontSize: 30,
              color: GREEN,
              letterSpacing: 3,
              textTransform: 'uppercase',
              fontWeight: 600,
            }}
          >
            Nature&rsquo;s Choice Jaggery
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <div
            style={{
              display: 'flex',
              fontSize: 92,
              lineHeight: 1.05,
              color: BROWN,
              fontWeight: 700,
              maxWidth: 900,
            }}
          >
            The New Age of Indian Jaggery
          </div>
          <div
            style={{
              display: 'flex',
              marginTop: 28,
              fontSize: 32,
              lineHeight: 1.4,
              color: GREEN,
              maxWidth: 880,
            }}
          >
            Three flavours of desi jaggery — classic, roasted sesame and green
            cardamom.
          </div>
        </div>
      </div>
    ),
    size,
  );
}