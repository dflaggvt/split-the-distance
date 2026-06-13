'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useAuth } from './AuthProvider';
import { useFeatures } from './FeatureProvider';
import { getSession } from '@/lib/auth';
import { logSessionEvent } from '@/lib/sessionEvents';

const CREDIT_PACKS = [
  {
    priceType: 'credits_10',
    name: 'Starter',
    price: '$1.99',
    searches: 10,
    perSearch: '$0.20/search',
    note: 'Quick meetups, pickups, dates, and errands',
  },
  {
    priceType: 'credits_30',
    name: 'Planner',
    price: '$4.99',
    searches: 30,
    perSearch: '$0.17/search',
    note: 'Multiple meetups, family plans, and short trips',
    featured: true,
  },
  {
    priceType: 'credits_100',
    name: 'Road Trip',
    price: '$9.99',
    searches: 100,
    perSearch: '$0.10/search',
    note: 'Best value for road trips and frequent planning',
  },
];

const PLAN_VALUE_POINTS = [
  'Fair midpoint based on real travel time',
  'Nearby food, coffee, parks, gas, hotels, and activities',
  'Google Maps directions plus saved and shareable plans',
];

export default function PricingModal() {
  const { pricingModalOpen, pricingModalContext, closePricingModal, openSignIn } = useFeatures();
  const { isLoggedIn, user } = useAuth();
  const [loadingPack, setLoadingPack] = useState(null);
  const [error, setError] = useState('');
  const viewLoggedForOpenRef = useRef(false);

  const isBlockedSearch = pricingModalContext === 'blocked_search';
  const packs = useMemo(
    () => CREDIT_PACKS.map((pack) => ({
      ...pack,
      featured: isBlockedSearch ? pack.priceType === 'credits_10' : pack.featured,
      badge: isBlockedSearch
        ? (pack.priceType === 'credits_10' ? 'START HERE' : null)
        : (pack.featured ? 'MOST POPULAR' : null),
    })),
    [isBlockedSearch]
  );

  useEffect(() => {
    if (!pricingModalOpen) {
      viewLoggedForOpenRef.current = false;
      return;
    }

    if (viewLoggedForOpenRef.current) return;
    viewLoggedForOpenRef.current = true;

    const viewportWidth = typeof window !== 'undefined' ? window.innerWidth : null;
    const isMobile = typeof viewportWidth === 'number' ? viewportWidth < 768 : false;

    logSessionEvent('credit_pack_cards_viewed', {
      context: pricingModalContext || null,
      isMobile,
      viewportWidth,
      highlightedPack: packs.find((pack) => pack.featured)?.priceType || null,
      packs: packs.map((pack) => ({
        priceType: pack.priceType,
        price: pack.price,
        searches: pack.searches,
        featured: Boolean(pack.featured),
      })),
    }, { userId: user?.id });
  }, [packs, pricingModalContext, pricingModalOpen, user?.id]);

  if (!pricingModalOpen) return null;

  const handleClose = (reason) => {
    logSessionEvent('pricing_modal_closed', {
      context: pricingModalContext || null,
      reason,
    }, { userId: user?.id });
    closePricingModal();
  };

  const handleCheckout = async (priceType) => {
    logSessionEvent('credit_pack_selected', {
      priceType,
      context: pricingModalContext || null,
    }, { userId: user?.id });

    if (!isLoggedIn) {
      try {
        localStorage.setItem('std_pending_credit_pack', priceType);
        localStorage.setItem('std_open_credits_after_signin', '1');
      } catch {}
      closePricingModal();
      openSignIn({
        mode: 'signup',
        context: 'search_credits',
        source: pricingModalContext || null,
        pendingPack: priceType,
      });
      return;
    }

    setLoadingPack(priceType);
    setError('');

    try {
      const session = await getSession();
      if (!session?.access_token) {
        setError('Session expired. Please sign out and sign back in.');
        logSessionEvent('checkout_failed', {
          priceType,
          context: pricingModalContext || null,
          reason: 'missing_session',
        }, { userId: user?.id });
        setLoadingPack(null);
        return;
      }

      const res = await fetch('/api/stripe/checkout', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ priceType }),
      });

      const data = await res.json();
      if (data.url) {
        logSessionEvent('checkout_started', {
          priceType,
          context: pricingModalContext || null,
        }, { userId: user?.id });
        window.location.assign(data.url);
        return;
      }

      const errorMessage = data.error || 'Failed to start checkout. Please try again.';
      setError(errorMessage);
      logSessionEvent('checkout_failed', {
        priceType,
        context: pricingModalContext || null,
        reason: 'checkout_session_failed',
        error: errorMessage,
      }, { userId: user?.id });
      setLoadingPack(null);
    } catch (err) {
      console.error('[Pricing] Checkout error:', err);
      setError('Something went wrong. Please try again.');
      logSessionEvent('checkout_failed', {
        priceType,
        context: pricingModalContext || null,
        reason: 'exception',
        error: err.message,
      }, { userId: user?.id });
      setLoadingPack(null);
    }
  };

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
        onClick={() => handleClose('backdrop')}
      />

      <div className="relative bg-white rounded-2xl shadow-2xl max-w-3xl w-full p-6 max-h-[90vh] overflow-y-auto animate-fadeInUp">
        <button
          onClick={() => handleClose('close_button')}
          className="absolute top-3 right-3 w-8 h-8 flex items-center justify-center rounded-full text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
          aria-label="Close pricing"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
            <path d="M18 6L6 18M6 6l12 12" />
          </svg>
        </button>

        <div className="text-center mb-6 pr-8 pl-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-2">
            {isBlockedSearch ? 'Finish this midpoint search' : 'Buy Search Credits'}
          </h2>
          {isBlockedSearch && (
            <p className="text-sm font-semibold text-teal-700 mb-1">
              One-time purchase. No subscription.
            </p>
          )}
          <p className="text-sm text-gray-500 max-w-2xl mx-auto">
            {isBlockedSearch
              ? 'Find the fairest place to meet, compare the drive, and discover places near the midpoint.'
              : 'Credits unlock midpoint calculations, route comparisons, and nearby place discovery.'}
          </p>
        </div>

        {isBlockedSearch && (
          <div className="rounded-xl bg-teal-50/50 border border-teal-100 p-4 mb-5">
            <div className="text-xs font-bold uppercase tracking-wide text-teal-700 mb-3">
              Your credits include
            </div>
            <ul className="grid grid-cols-1 md:grid-cols-3 gap-3 text-sm text-gray-700">
              {PLAN_VALUE_POINTS.map((point) => (
                <li key={point} className="flex items-start gap-2">
                  <span className="text-teal-600 font-bold">✓</span>
                  <span>{point}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-5">
          {packs.map((pack) => (
            <div
              key={pack.priceType}
              className={`relative rounded-xl border-2 p-5 ${
                pack.featured
                  ? 'border-teal-500 bg-teal-50/40 shadow-sm'
                  : 'border-gray-200 bg-white'
              }`}
            >
              {pack.badge && (
                <span className="absolute -top-3 left-1/2 -translate-x-1/2 text-[10px] font-bold text-white bg-teal-600 px-3 py-1 rounded-full">
                  {pack.badge}
                </span>
              )}

              <div className="mb-4">
                <h3 className="text-lg font-bold text-gray-900">{pack.name}</h3>
                <div className="text-3xl font-bold text-gray-900 mt-2">{pack.price}</div>
                <div className="text-sm text-gray-500 mt-1">
                  {pack.searches} searches
                </div>
              </div>

              <div className="rounded-lg bg-white border border-gray-100 p-3 mb-4">
                <p className="text-sm font-semibold text-gray-800">{pack.perSearch}</p>
                <p className="text-xs text-gray-500 mt-1">{pack.note}</p>
              </div>

              <button
                onClick={() => handleCheckout(pack.priceType)}
                disabled={Boolean(loadingPack)}
                className={`w-full py-2.5 px-4 text-sm font-semibold rounded-lg cursor-pointer transition-all disabled:opacity-50 whitespace-nowrap ${
                  pack.featured
                    ? 'text-white bg-teal-600 hover:bg-teal-700 shadow-sm'
                    : 'text-teal-700 bg-teal-50 hover:bg-teal-100'
                }`}
              >
                {loadingPack === pack.priceType
                  ? 'Redirecting...'
                  : isBlockedSearch
                    ? `Continue for ${pack.price}`
                    : 'Buy Credits'}
              </button>
            </div>
          ))}
        </div>

        <div className="rounded-xl bg-gray-50 border border-gray-100 p-4 mb-4">
          <ul className="grid grid-cols-1 md:grid-cols-3 gap-3 text-sm text-gray-600">
            <li className="flex items-start gap-2">
              <span className="text-teal-600 font-bold">✓</span>
              <span>One credit is used only after a successful search.</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-teal-600 font-bold">✓</span>
              <span>Credits stay with your account.</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-teal-600 font-bold">✓</span>
              <span>Your current route calculates after checkout.</span>
            </li>
          </ul>
        </div>

        {error && (
          <p className="text-center text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg mb-3">
            {error}
          </p>
        )}

        <p className="text-center text-xs text-gray-400">
          Secure checkout by Stripe.
        </p>
      </div>
    </div>
  );
}
