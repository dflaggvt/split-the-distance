'use client';

import { useState } from 'react';
import { useAuth } from './AuthProvider';
import { useFeatures } from './FeatureProvider';
import { getSession } from '@/lib/auth';

// Curated feature lists with user-friendly descriptions
const FREE_FEATURES = [
  { emoji: '📍', label: 'Midpoint Search', desc: 'Find the perfect halfway point between two locations' },
  { emoji: '🚗', label: 'Drive, Bike, or Walk', desc: 'Choose your travel mode for accurate midpoints' },
  { emoji: '📏', label: 'Time or Distance', desc: 'Toggle between drive-time and distance-based splits' },
  { emoji: '🗂️', label: 'Discover Places', desc: 'Browse food, coffee, parks, and more at your midpoint' },
  { emoji: '🔀', label: 'Route Options', desc: 'Compare alternate routes and pick the best one' },
  { emoji: '🔗', label: 'Share Results', desc: 'Send your midpoint to anyone with a link' },
  { emoji: '👥', label: 'Group Search (3)', desc: 'Find the meeting point for 3 people' },
  { emoji: '🎲', label: 'Midpoint Roulette', desc: "Can't decide? Let us pick a random spot" },
  { emoji: '🕐', label: 'Search History', desc: 'Re-run your last 10 searches with one tap' },
];

const PREMIUM_FEATURES = [
  { emoji: '🎯', label: 'Drift Radius', desc: 'See a fairness zone, not just a single point' },
  { emoji: '👥', label: 'Group Search (4-5)', desc: 'Find the optimal spot for up to 5 people' },
  { emoji: '🛣️', label: 'Road Trip Stops', desc: 'Plan stops along your route at regular intervals' },
  { emoji: '🎰', label: 'Unlimited Roulette', desc: 'Unlimited random picks with infinite re-rolls' },
  { emoji: '📚', label: 'Unlimited History', desc: 'Keep your full search history forever' },
];

export default function PricingModal() {
  const { pricingModalOpen, closePricingModal, openSignIn } = useFeatures();
  const { isLoggedIn, plan } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  if (!pricingModalOpen) return null;

  const handleUpgrade = async (priceType) => {
    if (!isLoggedIn) {
      closePricingModal();
      openSignIn();
      return;
    }

    setLoading(true);
    setError('');
    try {
      const session = await getSession();
      if (!session?.access_token) {
        setError('Session expired. Please sign out and sign back in.');
        setLoading(false);
        return;
      }

      const res = await fetch('/api/stripe/checkout', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ priceType }),
      });

      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
      } else {
        setError(data.error || 'Failed to start checkout. Please try again.');
        setLoading(false);
      }
    } catch (err) {
      console.error('[Pricing] Checkout error:', err);
      setError('Something went wrong. Please try again.');
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
        onClick={closePricingModal}
      />

      {/* Modal */}
      <div className="relative bg-white rounded-2xl shadow-2xl max-w-2xl w-full p-6 max-h-[90vh] overflow-y-auto animate-fadeInUp">
        {/* Close button */}
        <button
          onClick={closePricingModal}
          className="absolute top-3 right-3 w-8 h-8 flex items-center justify-center rounded-full text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
            <path d="M18 6L6 18M6 6l12 12" />
          </svg>
        </button>

        {/* Header */}
        <div className="text-center mb-6">
          <h2 className="text-xl font-bold text-gray-900 mb-1">Choose Your Plan</h2>
          <p className="text-sm text-gray-500">Unlock powerful features to find the perfect meeting spot</p>
        </div>

        {/* Plan columns */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
          {/* Free Plan */}
          <div className={`rounded-xl border-2 p-5 ${plan === 'free' || !isLoggedIn ? 'border-teal-400 bg-teal-50/30' : 'border-gray-200'}`}>
            <div className="mb-4">
              <h3 className="text-lg font-bold text-gray-900">Free</h3>
              <div className="text-2xl font-bold text-gray-900 mt-1">$0<span className="text-sm font-normal text-gray-500">/forever</span></div>
              {(!isLoggedIn || plan === 'free') && (
                <span className="inline-block mt-2 text-xs font-bold text-teal-700 bg-teal-100 px-2 py-0.5 rounded-full">
                  {isLoggedIn ? 'CURRENT PLAN' : 'SIGN IN TO UNLOCK'}
                </span>
              )}
            </div>

            <ul className="space-y-3">
              {FREE_FEATURES.map((f) => (
                <li key={f.label} className="flex items-start gap-2.5">
                  <span className="text-base shrink-0 mt-0.5">{f.emoji}</span>
                  <div>
                    <p className="text-sm font-semibold text-gray-800 leading-tight">{f.label}</p>
                    <p className="text-[11px] text-gray-400 leading-snug">{f.desc}</p>
                  </div>
                </li>
              ))}
            </ul>

            {!isLoggedIn && (
              <button
                onClick={() => { closePricingModal(); openSignIn(); }}
                className="w-full mt-5 py-2.5 px-4 text-sm font-semibold text-teal-700 bg-teal-100 rounded-lg cursor-pointer transition-colors hover:bg-teal-200"
              >
                Sign In — It&apos;s Free
              </button>
            )}
          </div>

          {/* Premium Plan */}
          <div className={`rounded-xl border-2 p-5 ${plan === 'premium' ? 'border-purple-400 bg-purple-50/30' : 'border-purple-200 bg-gradient-to-b from-purple-50/50 to-white'}`}>
            <div className="mb-4">
              <div className="flex items-center gap-2">
                <h3 className="text-lg font-bold text-gray-900">Premium</h3>
                <span className="text-[10px] font-bold text-purple-700 bg-purple-100 px-1.5 py-0.5 rounded-full">POPULAR</span>
              </div>
              <div className="text-2xl font-bold text-gray-900 mt-1">$4.99<span className="text-sm font-normal text-gray-500">/month</span></div>
              <div className="text-xs text-gray-500 mt-0.5">or $29.99/year (save 50%)</div>
              {plan === 'premium' && (
                <span className="inline-block mt-2 text-xs font-bold text-purple-700 bg-purple-100 px-2 py-0.5 rounded-full">
                  CURRENT PLAN
                </span>
              )}
            </div>

            <div className="text-[11px] font-semibold text-gray-400 uppercase tracking-wide mb-3">
              Everything in Free, plus:
            </div>
            <ul className="space-y-3">
              {PREMIUM_FEATURES.map((f) => (
                <li key={f.label} className="flex items-start gap-2.5">
                  <span className="text-base shrink-0 mt-0.5">{f.emoji}</span>
                  <div>
                    <p className="text-sm font-semibold text-gray-800 leading-tight">{f.label}</p>
                    <p className="text-[11px] text-gray-400 leading-snug">{f.desc}</p>
                  </div>
                </li>
              ))}
            </ul>

            {plan !== 'premium' && (
              <div className="flex flex-col gap-2 mt-5">
                <button
                  onClick={() => handleUpgrade('monthly')}
                  disabled={loading}
                  className="w-full py-2.5 px-4 text-sm font-semibold text-white bg-gradient-to-r from-purple-600 to-purple-700 rounded-lg cursor-pointer transition-all hover:from-purple-700 hover:to-purple-800 shadow-sm disabled:opacity-50"
                >
                  {loading ? 'Redirecting...' : 'Upgrade — $4.99/mo'}
                </button>
                <button
                  onClick={() => handleUpgrade('yearly')}
                  disabled={loading}
                  className="w-full py-2 px-4 text-xs font-medium text-purple-600 bg-purple-50 rounded-lg cursor-pointer transition-colors hover:bg-purple-100 disabled:opacity-50"
                >
                  {loading ? 'Redirecting...' : 'Or $29.99/year (save 50%)'}
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Error */}
        {error && (
          <p className="text-center text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg mb-3">
            {error}
          </p>
        )}

        {/* Footer */}
        <p className="text-center text-xs text-gray-400">
          Cancel anytime. No long-term commitment.
        </p>
      </div>
    </div>
  );
}
