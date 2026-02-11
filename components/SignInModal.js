'use client';

import { useState } from 'react';
import { useFeatures } from './FeatureProvider';
import { signInWithGoogle, signInWithApple } from '@/lib/auth';

/**
 * SignInModal — contextual sign-in prompt triggered by FeatureGate.
 * Shows when an anonymous user tries to access a free-tier feature.
 * Displays: feature name + description, one-tap Google/Apple sign-in, reassurance text.
 */
export default function SignInModal() {
  const { signInModalFeature, features, closeSignInModal } = useFeatures();
  const [signingIn, setSigningIn] = useState(null); // 'google' | 'apple' | null

  if (!signInModalFeature) return null;

  const feature = features[signInModalFeature];
  if (!feature) return null;

  const handleGoogle = async () => {
    setSigningIn('google');
    try {
      const { error } = await signInWithGoogle();
      if (error) {
        console.error('[SignInModal] Google sign-in error:', error);
        setSigningIn(null);
      }
      // On success, redirect happens automatically (OAuth flow)
    } catch {
      setSigningIn(null);
    }
  };

  const handleApple = async () => {
    setSigningIn('apple');
    try {
      const { error } = await signInWithApple();
      if (error) {
        console.error('[SignInModal] Apple sign-in error:', error);
        setSigningIn(null);
      }
    } catch {
      setSigningIn(null);
    }
  };

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
        onClick={closeSignInModal}
      />

      {/* Modal */}
      <div className="relative bg-white rounded-2xl shadow-2xl max-w-sm w-full p-6 animate-fadeInUp">
        {/* Close button */}
        <button
          onClick={closeSignInModal}
          className="absolute top-3 right-3 w-8 h-8 flex items-center justify-center rounded-full text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
            <path d="M18 6L6 18M6 6l12 12" />
          </svg>
        </button>

        {/* Feature info */}
        <div className="text-center mb-6">
          <div className="text-4xl mb-3">{feature.emoji}</div>
          <h3 className="text-lg font-bold text-gray-900 mb-1">
            Unlock {feature.label}
          </h3>
          <p className="text-sm text-gray-500">
            {feature.description}
          </p>
        </div>

        {/* Sign-in buttons */}
        <div className="flex flex-col gap-3 mb-4">
          <button
            onClick={handleGoogle}
            disabled={!!signingIn}
            className="flex items-center justify-center gap-3 w-full py-2.5 px-4 border border-gray-200 rounded-lg text-sm font-medium text-gray-700 bg-white cursor-pointer transition-all duration-200 hover:bg-gray-50 hover:border-gray-300 disabled:opacity-50"
          >
            <svg width="18" height="18" viewBox="0 0 24 24">
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/>
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
            </svg>
            {signingIn === 'google' ? 'Redirecting...' : 'Continue with Google'}
          </button>

          <button
            onClick={handleApple}
            disabled={!!signingIn}
            className="flex items-center justify-center gap-3 w-full py-2.5 px-4 border border-gray-200 rounded-lg text-sm font-medium text-gray-700 bg-white cursor-pointer transition-all duration-200 hover:bg-gray-50 hover:border-gray-300 disabled:opacity-50"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
              <path d="M17.05 20.28c-.98.95-2.05.88-3.08.4-1.09-.5-2.08-.48-3.24 0-1.44.62-2.2.44-3.06-.4C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.54 4.09zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z"/>
            </svg>
            {signingIn === 'apple' ? 'Redirecting...' : 'Continue with Apple'}
          </button>
        </div>

        {/* Reassurance */}
        <p className="text-center text-xs text-gray-400">
          It&apos;s free — no credit card needed
        </p>
      </div>
    </div>
  );
}
