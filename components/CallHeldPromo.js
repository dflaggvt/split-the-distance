'use client';

import { useEffect, useRef } from 'react';
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
    <section ref={promoRef} className="my-6 rounded-xl border border-slate-200 bg-gradient-to-br from-slate-950 to-slate-800 p-4 text-white shadow-sm">
      <div className="flex items-start gap-3">
        <div className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-white/10 text-teal-200">
          <svg
            width="22"
            height="22"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.8 19.8 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.12 4.18 2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.12.91.33 1.8.62 2.65a2 2 0 0 1-.45 2.11L8.09 9.67a16 16 0 0 0 6.24 6.24l1.19-1.19a2 2 0 0 1 2.11-.45c.85.29 1.74.5 2.65.62A2 2 0 0 1 22 16.92z" />
          </svg>
        </div>
        <div className="min-w-0">
          <p className="text-[11px] font-bold uppercase tracking-wide text-teal-200">
            Android beta testers wanted
          </p>
          <h3 className="mt-1 text-lg font-bold leading-tight">
            Missed calls should not become lost context.
          </h3>
          <p className="mt-2 text-sm leading-relaxed text-slate-200">
            Call Held is an AI phone assistant that catches missed calls, summarizes what happened, and helps you decide what needs attention.
          </p>
          <a
            href={CALL_HELD_URL}
            target="_blank"
            rel="noreferrer"
            onClick={handleClick}
            className="mt-4 inline-flex w-full items-center justify-center rounded-lg bg-teal-500 px-4 py-2.5 text-sm font-bold text-white shadow-sm transition hover:bg-teal-400"
          >
            Join the Call Held beta
          </a>
          <p className="mt-2 text-center text-[11px] text-slate-400">
            Built by the maker of Split The Distance.
          </p>
        </div>
      </div>
    </section>
  );
}
