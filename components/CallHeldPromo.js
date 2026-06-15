'use client';

import { useEffect, useRef } from 'react';
import Image from 'next/image';
import { logSessionEvent } from '@/lib/sessionEvents';

const CALL_HELD_URL = 'https://www.callheld.com/?utm_source=splitthedistance&utm_medium=house_ad&utm_campaign=sidebar_promo';

export default function CallHeldPromo({ placement = 'search_panel' }) {
  const promoRef = useRef(null);
  const loggedViewRef = useRef(false);

  useEffect(() => {
    const logView = () => {
      if (loggedViewRef.current) return;
      loggedViewRef.current = true;
      logSessionEvent('call_held_promo_viewed', { placement });
    };

    if (typeof window === 'undefined' || !promoRef.current) return;

    if (!('IntersectionObserver' in window)) {
      logView();
      return;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) {
          logView();
          observer.disconnect();
        }
      },
      { threshold: 0.5 }
    );

    observer.observe(promoRef.current);
    return () => observer.disconnect();
  }, [placement]);

  const handleClick = () => {
    logSessionEvent('call_held_promo_clicked', { placement, url: CALL_HELD_URL });
  };

  return (
    <section ref={promoRef} className="my-6 flex justify-center">
      <a
        href={CALL_HELD_URL}
        target="_blank"
        rel="noreferrer"
        onClick={handleClick}
        className="block w-full max-w-[300px] overflow-hidden rounded-md shadow-sm transition hover:shadow-md focus:outline-none focus:ring-2 focus:ring-teal-500 focus:ring-offset-2"
        aria-label="Try Call Held"
      >
        <Image
          src="/callheld/callheld_compelling_300x250.png"
          alt="Call Held AI call assistant. It answers, it calls, you relax."
          width={300}
          height={250}
          className="h-auto w-full"
          sizes="300px"
        />
      </a>
    </section>
  );
}
