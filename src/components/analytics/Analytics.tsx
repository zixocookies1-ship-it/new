'use client';

import { useEffect, useState } from 'react';
import Script from 'next/script';
import { initAnalytics, hasAnalyticsConsent } from '@/lib/analytics';

/**
 * Loads GA4 and Meta Pixel only after consent has been granted.
 *
 * No third-party script is fetched, and no identifier is read, until the
 * visitor opts in — a privacy requirement and a real performance win for the
 * majority of first-time mobile visitors.
 */
export function Analytics({ gaId, pixelId }: { gaId: string; pixelId: string }) {
  const [consented, setConsented] = useState(false);

  useEffect(() => {
    initAnalytics({ gaId, pixelId });
    setConsented(hasAnalyticsConsent());
  }, [gaId, pixelId]);

  // The consent banner dispatches this once the visitor decides.
  useEffect(() => {
    const onChange = () => setConsented(hasAnalyticsConsent());
    window.addEventListener('nc:consent-change', onChange);
    return () => window.removeEventListener('nc:consent-change', onChange);
  }, []);

  if (!consented) return null;

  return (
    <>
      {gaId ? (
        <Script
          src={`https://www.googletagmanager.com/gtag/js?id=${gaId}`}
          strategy="afterInteractive"
          id="nc-ga4"
        />
      ) : null}

      {gaId ? (
        <Script id="nc-ga4-init" strategy="afterInteractive">
          {`window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}window.gtag=gtag;gtag('js',new Date());gtag('config',${JSON.stringify(
            gaId,
          )},{send_page_view:false,anonymize_ip:true});`}
        </Script>
      ) : null}

      {pixelId ? (
        <Script id="nc-meta-pixel" strategy="afterInteractive">
          {`!function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,document,'script','https://connect.facebook.net/en_US/fbevents.js');window.fbq('init',${JSON.stringify(
            pixelId,
          )});window.fbq('track','PageView');`}
        </Script>
      ) : null}
    </>
  );
}
