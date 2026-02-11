'use client';

import { useState, useEffect } from 'react';
import { useAuth } from './AuthProvider';
import { submitWaitlistSignup, checkWaitlistStatus, TIER_LABELS, TIER_COLORS } from '@/lib/features';

/**
 * ComingSoonCard — teaser card for a coming_soon feature.
 * Shows emoji, name, description, tier badge, and "Notify Me" button.
 * 
 * If user is logged in: one-click signup using their email.
 * If anonymous: shows email input field.
 */
export default function ComingSoonCard({ featureKey, label, description, emoji, tier, inline = false }) {
  const { user, isLoggedIn } = useAuth();
  const [notified, setNotified] = useState(false);
  const [email, setEmail] = useState('');
  const [showEmailInput, setShowEmailInput] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  // Check if already signed up
  useEffect(() => {
    const userEmail = user?.email;
    if (userEmail) {
      checkWaitlistStatus(featureKey, userEmail).then((onList) => {
        if (onList) setNotified(true);
      });
    }
  }, [featureKey, user?.email]);

  const handleNotifyClick = async () => {
    if (notified) return;

    if (isLoggedIn && user?.email) {
      // One-click signup for logged-in users
      setSubmitting(true);
      const result = await submitWaitlistSignup(featureKey, user.email, user.id);
      setSubmitting(false);
      if (result.success) {
        setNotified(true);
      } else {
        setError('Something went wrong. Try again.');
      }
    } else {
      // Show email input for anonymous users
      setShowEmailInput(true);
    }
  };

  const handleEmailSubmit = async (e) => {
    e.preventDefault();
    const trimmedEmail = email.trim();
    if (!trimmedEmail || !trimmedEmail.includes('@')) {
      setError('Please enter a valid email');
      return;
    }

    setSubmitting(true);
    setError(null);
    const result = await submitWaitlistSignup(featureKey, trimmedEmail);
    setSubmitting(false);

    if (result.success) {
      setNotified(true);
      setShowEmailInput(false);
    } else {
      setError('Something went wrong. Try again.');
    }
  };

  const tierLabel = tier === 'anonymous' ? 'Free' : TIER_LABELS[tier] || 'Free';
  const tierColor = TIER_COLORS[tier] || TIER_COLORS.free;

  if (inline) {
    // Compact inline version for FeatureGate fallback
    return (
      <div className="flex items-center gap-2 px-3 py-1.5 border-[1.5px] border-dashed border-gray-300 rounded-full text-[13px] text-gray-500">
        <span>{emoji}</span>
        <span className="font-medium">{label}</span>
        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-700">SOON</span>
      </div>
    );
  }

  return (
    <div className="flex items-start gap-3 p-3 bg-white border border-gray-100 rounded-xl transition-all duration-200 hover:border-gray-200 hover:shadow-sm">
      {/* Emoji */}
      <div className="text-2xl shrink-0 mt-0.5">{emoji}</div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-0.5">
          <span className="text-sm font-semibold text-gray-900">{label}</span>
          <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${tierColor}`}>
            {tierLabel}
          </span>
          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-700">
            COMING SOON
          </span>
        </div>
        <p className="text-xs text-gray-500 leading-relaxed mb-2">{description}</p>

        {/* Notify Me */}
        {notified ? (
          <div className="flex items-center gap-1.5 text-xs text-emerald-600 font-medium">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="20 6 9 17 4 12" />
            </svg>
            You&apos;ll be notified
          </div>
        ) : showEmailInput ? (
          <form onSubmit={handleEmailSubmit} className="flex gap-1.5">
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="your@email.com"
              className="flex-1 px-2.5 py-1.5 text-xs border border-gray-200 rounded-lg focus:outline-none focus:border-teal-400 focus:ring-1 focus:ring-teal-400/30"
              autoFocus
            />
            <button
              type="submit"
              disabled={submitting}
              className="px-3 py-1.5 text-xs font-medium text-white bg-teal-600 rounded-lg cursor-pointer hover:bg-teal-700 transition-colors disabled:opacity-50"
            >
              {submitting ? '...' : 'Notify Me'}
            </button>
          </form>
        ) : (
          <button
            onClick={handleNotifyClick}
            disabled={submitting}
            className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-teal-700 bg-teal-50 border border-teal-200 rounded-lg cursor-pointer transition-all duration-200 hover:bg-teal-100 hover:border-teal-300 disabled:opacity-50"
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
              <path d="M13.73 21a2 2 0 0 1-3.46 0" />
            </svg>
            {submitting ? 'Signing up...' : 'Notify Me'}
          </button>
        )}

        {error && <p className="text-xs text-red-500 mt-1">{error}</p>}
      </div>
    </div>
  );
}
