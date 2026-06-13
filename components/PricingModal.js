'use client';

import { useState } from 'react';
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
    note: 'For one quick plan',
  },
  {
    priceType: 'credits_30',
    name: 'Planner',
    price: '$4.99',
    searches: 30,
    perSearch: '$0.17/search',
    note: 'Best for meetups and trips',
    featured: true,
  },
  {
    priceType: 'credits_100',
    name: 'Road Trip',
    price: '$9.99',
    searches: 100,
    perSearch: '$0.10/search',
    note: 'Best value',
  },
];

export default function PricingModal() {
  const { pricingModalOpen, closePricingModal, openSignIn } = useFeatures();
  const { isLoggedIn, user } = useAuth();
  const [loadingPack, setLoadingPack] = useState(null);
  const [error, setError] = useState('');

  if (!pricingModalOpen) return null;

  const handleCheckout = async (priceType) => {
    logSessionEvent('credit_pack_selected', { priceType }, { userId: user?.id });

    if (!isLoggedIn) {
      try {
        localStorage.setItem('std_open_credits_after_signin', '1');
      } catch {}
      closePricingModal();
      openSignIn({ mode: 'signup', context: 'search_credits' });
      return;
    }

    setLoadingPack(priceType);
    setError('');

    try {
      const session = await getSession();
      if (!session?.access_token) {
        setError('Session expired. Please sign out and sign back in.');
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
        logSessionEvent('checkout_started', { priceType }, { userId: user?.id });
        window.location.assign(data.url);
        return;
      }

      setError(data.error || 'Failed to start checkout. Please try again.');
      setLoadingPack(null);
    } catch (err) {
      console.error('[Pricing] Checkout error:', err);
      setError('Something went wrong. Please try again.');
      setLoadingPack(null);
    }
  };

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
        onClick={closePricingModal}
      />

      <div className="relative bg-white rounded-2xl shadow-2xl max-w-3xl w-full p-6 max-h-[90vh] overflow-y-auto animate-fadeInUp">
        <button
          onClick={closePricingModal}
          className="absolute top-3 right-3 w-8 h-8 flex items-center justify-center rounded-full text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
          aria-label="Close pricing"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
            <path d="M18 6L6 18M6 6l12 12" />
          </svg>
        </button>

        <div className="text-center mb-6 pr-8 pl-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Buy Search Credits</h2>
          <p className="text-sm text-gray-500">
            Credits unlock midpoint calculations, route comparisons, and nearby place discovery.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-5">
          {CREDIT_PACKS.map((pack) => (
            <div
              key={pack.priceType}
              className={`relative rounded-xl border-2 p-5 ${
                pack.featured
                  ? 'border-teal-500 bg-teal-50/40 shadow-sm'
                  : 'border-gray-200 bg-white'
              }`}
            >
              {pack.featured && (
                <span className="absolute -top-3 left-1/2 -translate-x-1/2 text-[10px] font-bold text-white bg-teal-600 px-3 py-1 rounded-full">
                  MOST POPULAR
                </span>
              )}

              <div className="mb-4">
                <h3 className="text-lg font-bold text-gray-900">{pack.name}</h3>
                <div className="text-3xl font-bold text-gray-900 mt-2">{pack.price}</div>
                <div className="text-sm text-gray-500 mt-1">{pack.searches} searches</div>
              </div>

              <div className="rounded-lg bg-white border border-gray-100 p-3 mb-4">
                <p className="text-sm font-semibold text-gray-800">{pack.perSearch}</p>
                <p className="text-xs text-gray-500 mt-1">{pack.note}</p>
              </div>

              <button
                onClick={() => handleCheckout(pack.priceType)}
                disabled={Boolean(loadingPack)}
                className={`w-full py-2.5 px-4 text-sm font-semibold rounded-lg cursor-pointer transition-all disabled:opacity-50 ${
                  pack.featured
                    ? 'text-white bg-teal-600 hover:bg-teal-700 shadow-sm'
                    : 'text-teal-700 bg-teal-50 hover:bg-teal-100'
                }`}
              >
                {loadingPack === pack.priceType ? 'Redirecting...' : 'Buy Credits'}
              </button>
            </div>
          ))}
        </div>

        <div className="rounded-xl bg-gray-50 border border-gray-100 p-4 mb-4">
          <ul className="grid grid-cols-1 md:grid-cols-3 gap-3 text-sm text-gray-600">
            <li className="flex items-start gap-2">
              <span className="text-teal-600 font-bold">✓</span>
              <span>One credit is used after a successful search.</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-teal-600 font-bold">✓</span>
              <span>Credits stay with your account.</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-teal-600 font-bold">✓</span>
              <span>No subscription or surprise bill.</span>
            </li>
          </ul>
        </div>

        {error && (
          <p className="text-center text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg mb-3">
            {error}
          </p>
        )}

        <p className="text-center text-xs text-gray-400">
          Secure checkout by Stripe. Existing Premium subscribers keep access while their subscription is active.
        </p>
      </div>
    </div>
  );
}
