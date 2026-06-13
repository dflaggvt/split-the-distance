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
    <section ref={promoRef} className="my-6 rounded-xl border border-teal-100 bg-gradient-to-br from-[#f8fbff] to-[#ecfdfa] p-4 text-slate-900 shadow-sm">
      <div className="flex items-start gap-3">
        <div className="mt-0.5 flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-xl shadow-sm ring-1 ring-black/5">
          <Image
            src="/callheld/icon.svg"
            alt=""
            width={48}
            height={48}
            className="h-12 w-12"
          />
        </div>
        <div className="min-w-0">
          <p className="text-[11px] font-bold uppercase tracking-wide text-teal-700">
            Android beta testers wanted
          </p>
          <h3 className="mt-1 text-lg font-bold leading-tight text-slate-950">
            Call Held answers when you can&apos;t.
          </h3>
          <p className="mt-2 text-sm leading-relaxed text-slate-600">
            Call Held is an AI phone assistant that catches missed calls, summarizes what happened, and helps you decide what needs attention.
          </p>
          <a
            href={CALL_HELD_URL}
            target="_blank"
            rel="noreferrer"
            onClick={handleClick}
            className="mt-4 inline-flex w-full items-center justify-center rounded-lg bg-[#136B6E] px-4 py-2.5 text-sm font-bold text-white shadow-sm transition hover:bg-[#0f5558]"
          >
            Join the Call Held beta
          </a>
          <p className="mt-2 text-center text-[11px] text-slate-500">
            Built by the maker of Split The Distance.
          </p>
        </div>
      </div>
    </section>
  );
}
