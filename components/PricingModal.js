'use client';

import { useState } from 'react';
import { useAuth } from './AuthProvider';
import { useFeatures } from './FeatureProvider';
import { signInWithGoogle, getSession } from '@/lib/auth';

/**
 * PricingModal — 3-column plan comparison with Stripe Checkout redirect.
 * Triggered by showUpgrade() from useFeature(), plan badge in header, or "See all plans" link.
 */
export default function PricingModal() {
  const { pricingModalOpen, closePricingModal, featuresByTier } = useFeatures();
  const { isLoggedIn, plan } = useAuth();
  const [loading, setLoading] = useState(false);

  if (!pricingModalOpen) return null;

  const handleUpgrade = async (priceType) => {
    if (!isLoggedIn) {
      // Must sign in first
      await signInWithGoogle();
      return;
    }

    setLoading(true);
    try {
      // Get current session token to authenticate the checkout request
      const session = await getSession();
      const res = await fetch('/api/stripe/checkout', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session?.access_token || ''}`,
        },
        body: JSON.stringify({ priceType }), // 'monthly' or 'yearly'
      });

      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
      } else {
        console.error('[Pricing] No checkout URL returned:', data);
        setLoading(false);
      }
    } catch (err) {
      console.error('[Pricing] Checkout error:', err);
      setLoading(false);
    }
  };

  // Combine anonymous + free features for the "Free" column
  const freeFeatures = [
    ...(featuresByTier.anonymous || []),
    ...(featuresByTier.free || []),
  ];
  const premiumFeatures = featuresByTier.premium || [];

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

            <ul className="space-y-2">
              {freeFeatures.map((f) => (
                <li key={f.key} className="flex items-start gap-2 text-sm">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#0d9488" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 mt-0.5">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                  <span className="text-gray-700">
                    {f.emoji} {f.label}
                    {f.status === 'coming_soon' && (
                      <span className="ml-1 text-[10px] font-bold text-amber-700 bg-amber-100 px-1 py-0.5 rounded-full">SOON</span>
                    )}
                    {f.tier === 'free' && (
                      <span className="ml-1 text-[10px] text-gray-400">(sign in)</span>
                    )}
                  </span>
                </li>
              ))}
            </ul>

            {!isLoggedIn && (
              <button
                onClick={() => { closePricingModal(); signInWithGoogle(); }}
                className="w-full mt-4 py-2.5 px-4 text-sm font-semibold text-teal-700 bg-teal-100 rounded-lg cursor-pointer transition-colors hover:bg-teal-200"
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

            <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
              Everything in Free, plus:
            </div>
            <ul className="space-y-2">
              {premiumFeatures.map((f) => (
                <li key={f.key} className="flex items-start gap-2 text-sm">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#7c3aed" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 mt-0.5">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                  <span className="text-gray-700">
                    {f.emoji} {f.label}
                    {f.status === 'coming_soon' && (
                      <span className="ml-1 text-[10px] font-bold text-amber-700 bg-amber-100 px-1 py-0.5 rounded-full">SOON</span>
                    )}
                  </span>
                </li>
              ))}
            </ul>

            {plan !== 'premium' && (
              <div className="flex flex-col gap-2 mt-4">
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

        {/* Footer */}
        <p className="text-center text-xs text-gray-400">
          Cancel anytime. No long-term commitment.
        </p>
      </div>
    </div>
  );
}
