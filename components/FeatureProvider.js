'use client';

import { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import { fetchFeatureFlags, checkAccess, getComingSoonFeatures, getFeaturesByTier, DEFAULT_FEATURES } from '@/lib/features';
import { useAuth } from './AuthProvider';

const FeatureContext = createContext({
  features: DEFAULT_FEATURES,
  loading: true,
  // Modal state
  signInModalFeature: null,
  pricingModalOpen: false,
  openSignInModal: () => {},
  closeSignInModal: () => {},
  openPricingModal: () => {},
  closePricingModal: () => {},
});

export function FeatureProvider({ children }) {
  const [features, setFeatures] = useState(DEFAULT_FEATURES);
  const [loading, setLoading] = useState(true);
  const [signInModalFeature, setSignInModalFeature] = useState(null); // feature key or null
  const [pricingModalOpen, setPricingModalOpen] = useState(false);
  const auth = useAuth();

  // Fetch feature flags on mount and when tab becomes visible (picks up dashboard changes)
  useEffect(() => {
    let cancelled = false;
    async function load(forceRefresh = false) {
      const flags = await fetchFeatureFlags(forceRefresh);
      if (!cancelled) {
        setFeatures(flags);
        setLoading(false);
      }
    }
    load();

    // Re-fetch when user returns to this tab (e.g., after editing in dashboard)
    function onVisibilityChange() {
      if (document.visibilityState === 'visible') {
        load(true); // force refresh, bypass cache
      }
    }
    document.addEventListener('visibilitychange', onVisibilityChange);
    return () => {
      cancelled = true;
      document.removeEventListener('visibilitychange', onVisibilityChange);
    };
  }, []);

  const openSignInModal = useCallback((featureKey) => {
    setSignInModalFeature(featureKey);
  }, []);

  const closeSignInModal = useCallback(() => {
    setSignInModalFeature(null);
  }, []);

  const openPricingModal = useCallback(() => {
    setPricingModalOpen(true);
  }, []);

  const closePricingModal = useCallback(() => {
    setPricingModalOpen(false);
  }, []);

  // Close sign-in modal when user successfully logs in
  useEffect(() => {
    if (auth.isLoggedIn && signInModalFeature) {
      setSignInModalFeature(null);
    }
  }, [auth.isLoggedIn, signInModalFeature]);

  const value = useMemo(() => ({
    features,
    loading,
    signInModalFeature,
    pricingModalOpen,
    openSignInModal,
    closeSignInModal,
    openPricingModal,
    closePricingModal,
  }), [features, loading, signInModalFeature, pricingModalOpen, openSignInModal, closeSignInModal, openPricingModal, closePricingModal]);

  return (
    <FeatureContext.Provider value={value}>
      {children}
    </FeatureContext.Provider>
  );
}

/**
 * useFeature(key) — check access for a specific feature.
 * Returns: { allowed, tier, status, enabled, reason, label, description, emoji, showSignIn, showUpgrade }
 */
export function useFeature(featureKey) {
  const { features, openSignInModal, openPricingModal } = useContext(FeatureContext);
  const auth = useAuth();

  return useMemo(() => {
    const feature = features[featureKey];
    if (!feature) {
      return {
        allowed: false,
        tier: 'anonymous',
        status: 'hidden',
        enabled: false,
        reason: 'hidden',
        label: '',
        description: '',
        emoji: '',
        showSignIn: () => openSignInModal(featureKey),
        showUpgrade: () => openPricingModal(),
      };
    }

    const reason = checkAccess(feature, {
      isLoggedIn: auth.isLoggedIn,
      plan: auth.plan,
    });

    return {
      allowed: reason === 'allowed',
      tier: feature.tier,
      status: feature.status,
      enabled: feature.enabled,
      reason,
      label: feature.label,
      description: feature.description,
      emoji: feature.emoji,
      showSignIn: () => openSignInModal(featureKey),
      showUpgrade: () => openPricingModal(),
    };
  }, [featureKey, features, auth.isLoggedIn, auth.plan, openSignInModal, openPricingModal]);
}

/**
 * useFeatures() — access the full feature context (for ComingSoonSection, PricingModal, etc.)
 */
export function useFeatures() {
  const ctx = useContext(FeatureContext);
  const auth = useAuth();

  return useMemo(() => ({
    ...ctx,
    comingSoonFeatures: getComingSoonFeatures(ctx.features),
    featuresByTier: getFeaturesByTier(ctx.features),
    userPlan: auth.plan,
    isLoggedIn: auth.isLoggedIn,
  }), [ctx, auth.plan, auth.isLoggedIn]);
}
