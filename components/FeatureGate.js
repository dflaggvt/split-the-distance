'use client';

import { useFeature } from './FeatureProvider';
import ComingSoonCard from './ComingSoonCard';

/**
 * FeatureGate — declarative wrapper that controls feature access.
 * 
 * Usage:
 *   <FeatureGate feature="local_only">
 *     <LocalOnlyToggle />
 *   </FeatureGate>
 * 
 * Behavior based on reason:
 *   - 'allowed'           → renders children
 *   - 'login_required'    → renders children but intercepts with sign-in on interaction (via onGatedAction)
 *   - 'upgrade_required'  → renders fallback or default upgrade prompt
 *   - 'coming_soon'       → renders ComingSoonCard teaser
 *   - 'hidden' / 'disabled' → renders nothing
 * 
 * Props:
 *   - feature: string (feature key)
 *   - children: ReactNode (the actual feature UI)
 *   - fallback: ReactNode (optional custom fallback for locked/coming_soon)
 *   - inline: boolean (if true, renders inline prompts instead of hiding)
 *   - mode: 'render' | 'intercept' (default: 'render')
 *     - 'render': shows/hides children based on access
 *     - 'intercept': always renders children, provides onGatedAction callback
 */
export default function FeatureGate({
  feature,
  children,
  fallback,
  inline = false,
  mode = 'render',
}) {
  const {
    allowed,
    reason,
    label,
    description,
    emoji,
    tier,
    showSignIn,
    showUpgrade,
  } = useFeature(feature);

  // Hidden or disabled — render nothing
  if (reason === 'hidden' || reason === 'disabled') {
    return null;
  }

  // Coming soon — render teaser card
  if (reason === 'coming_soon') {
    if (fallback) return fallback;
    return (
      <ComingSoonCard
        featureKey={feature}
        label={label}
        description={description}
        emoji={emoji}
        tier={tier}
        inline={inline}
      />
    );
  }

  // Allowed — render children
  if (allowed) {
    return children;
  }

  // Login required — in intercept mode, render children (parent handles the gate)
  // In render mode, show a sign-in prompt
  if (reason === 'login_required') {
    if (mode === 'intercept') {
      return children;
    }
    if (fallback) return fallback;
    return (
      <button
        onClick={showSignIn}
        className={`${inline ? 'inline-flex' : 'flex'} items-center gap-2 px-3 py-1.5 border-[1.5px] border-dashed border-teal-300 rounded-full text-[13px] font-medium text-teal-600 bg-teal-50/50 cursor-pointer transition-all duration-200 hover:border-teal-400 hover:bg-teal-50`}
      >
        <span>{emoji}</span>
        <span>{label}</span>
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="opacity-60">
          <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
          <path d="M7 11V7a5 5 0 0 1 10 0v4" />
        </svg>
      </button>
    );
  }

  // Upgrade required
  if (reason === 'upgrade_required') {
    if (fallback) return fallback;
    return (
      <button
        onClick={showUpgrade}
        className={`${inline ? 'inline-flex' : 'flex'} items-center gap-2 px-3 py-1.5 border-[1.5px] border-dashed border-purple-300 rounded-full text-[13px] font-medium text-purple-600 bg-purple-50/50 cursor-pointer transition-all duration-200 hover:border-purple-400 hover:bg-purple-50`}
      >
        <span>{emoji}</span>
        <span>{label}</span>
        <span className="text-[10px] font-bold bg-purple-100 text-purple-700 px-1.5 py-0.5 rounded-full">PRO</span>
      </button>
    );
  }

  return null;
}

/**
 * useGatedAction — hook for "intercept" mode.
 * Wraps an action so it checks feature access first.
 * If access is denied, shows the appropriate modal instead.
 */
export function useGatedAction(featureKey) {
  const { allowed, reason, showSignIn, showUpgrade } = useFeature(featureKey);

  return {
    allowed,
    reason,
    /** Wrap your action — calls it if allowed, shows modal if not */
    gate: (action) => {
      if (allowed) {
        action();
      } else if (reason === 'login_required') {
        showSignIn();
      } else if (reason === 'upgrade_required') {
        showUpgrade();
      }
      // coming_soon, hidden, disabled — do nothing
    },
  };
}
