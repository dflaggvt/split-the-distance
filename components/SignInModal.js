'use client';

import { useState, useEffect } from 'react';
import { useFeatures } from './FeatureProvider';
import { signInWithGoogle, signInWithEmail, signUpWithEmail } from '@/lib/auth';

/**
 * Detect if the user is in an embedded WebView (Reddit, Facebook, Instagram, etc.)
 * Google OAuth blocks sign-in from these environments.
 */
function isEmbeddedWebView() {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent || '';
  // Reddit, Facebook, Instagram, TikTok, Twitter, LinkedIn, Snapchat, etc.
  return /FBAN|FBAV|Instagram|Reddit|Twitter|LinkedInApp|Snapchat|TikTok|BytedanceWebview|Line\//i.test(ua)
    || (/wv\)/.test(ua) && /Android/.test(ua)); // Generic Android WebView
}

/**
 * SignInModal — unified sign-in / sign-up modal.
 * Opens in two contexts:
 *   1. Feature-gate: triggered by FeatureGate when an anonymous user taps a free-tier feature.
 *   2. General sign-in: triggered by the AuthButton "Sign In" button.
 * Offers email/password (with sign-in/sign-up toggle) and Google OAuth.
 */
export default function SignInModal() {
  const { signInModalFeature, signInOpen, features, closeSignInModal, closeSignIn } = useFeatures();
  const [mode, setMode] = useState('signin'); // 'signin' | 'signup'
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [inWebView, setInWebView] = useState(false);

  useEffect(() => {
    setInWebView(isEmbeddedWebView());
  }, []);

  const isFeatureGate = !!signInModalFeature;
  const isOpen = isFeatureGate || signInOpen;

  if (!isOpen) return null;

  const feature = isFeatureGate ? features[signInModalFeature] : null;

  // If it's a feature gate but the feature doesn't exist, bail
  if (isFeatureGate && !feature) return null;

  const handleClose = () => {
    setError('');
    setMessage('');
    setEmail('');
    setPassword('');
    setMode('signin');
    if (isFeatureGate) closeSignInModal();
    else closeSignIn();
  };

  const handleEmailSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setMessage('');
    setSubmitting(true);

    try {
      if (mode === 'signin') {
        const { error: err } = await signInWithEmail(email, password);
        if (err) {
          setError(err.message);
        }
        // On success, AuthProvider picks up the session automatically
      } else {
        const { data, error: err } = await signUpWithEmail(email, password);
        if (err) {
          setError(err.message);
        } else if (data?.user && !data.session) {
          // Email confirmation required
          setMessage('Check your email for a confirmation link.');
        }
      }
    } catch {
      setError('Something went wrong. Please try again.');
    }
    setSubmitting(false);
  };

  const handleGoogle = async () => {
    setGoogleLoading(true);
    setError('');
    try {
      const { error: err } = await signInWithGoogle();
      if (err) {
        setError(err.message);
        setGoogleLoading(false);
      }
      // On success, redirect happens automatically (OAuth flow)
    } catch {
      setGoogleLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
        onClick={handleClose}
      />

      {/* Modal */}
      <div className="relative bg-white rounded-2xl shadow-2xl max-w-sm w-full p-6 animate-fadeInUp">
        {/* Close button */}
        <button
          onClick={handleClose}
          className="absolute top-3 right-3 w-8 h-8 flex items-center justify-center rounded-full text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
            <path d="M18 6L6 18M6 6l12 12" />
          </svg>
        </button>

        {/* Header */}
        <div className="text-center mb-5">
          {feature ? (
            <>
              <div className="text-4xl mb-3">{feature.emoji}</div>
              <h3 className="text-lg font-bold text-gray-900 mb-1">
                Unlock {feature.label}
              </h3>
              <p className="text-sm text-gray-500">{feature.description}</p>
            </>
          ) : (
            <>
              <div className="text-4xl mb-3">👋</div>
              <h3 className="text-lg font-bold text-gray-900 mb-1">
                {mode === 'signin' ? 'Welcome back' : 'Create an account'}
              </h3>
              <p className="text-sm text-gray-500">
                {mode === 'signin' ? 'Sign in to your account' : 'Get started for free'}
              </p>
            </>
          )}
        </div>

        {/* Google button — hidden in embedded WebViews (Reddit, FB, etc.) */}
        {inWebView ? (
          <div className="bg-amber-50 border border-amber-200 rounded-lg px-4 py-3 mb-4">
            <p className="text-sm font-medium text-amber-800 mb-1">Open in your browser</p>
            <p className="text-xs text-amber-600">
              Google sign-in doesn&apos;t work in app browsers. Tap the menu (⋮) and choose &quot;Open in Chrome&quot; or &quot;Open in Safari&quot; to sign in with Google, or use email below.
            </p>
          </div>
        ) : (
          <>
            <button
              onClick={handleGoogle}
              disabled={googleLoading || submitting}
              className="flex items-center justify-center gap-3 w-full py-2.5 px-4 border border-gray-200 rounded-lg text-sm font-medium text-gray-700 bg-white cursor-pointer transition-all duration-200 hover:bg-gray-50 hover:border-gray-300 disabled:opacity-50 mb-4"
            >
              <svg width="18" height="18" viewBox="0 0 24 24">
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/>
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
              </svg>
              {googleLoading ? 'Redirecting...' : 'Continue with Google'}
            </button>

            {/* Divider */}
            <div className="flex items-center gap-3 mb-4">
              <div className="flex-1 h-px bg-gray-200" />
              <span className="text-xs text-gray-400 font-medium">or</span>
              <div className="flex-1 h-px bg-gray-200" />
            </div>
          </>
        )}

        {/* Email / Password form */}
        <form onSubmit={handleEmailSubmit} className="space-y-3 mb-4">
          <div>
            <input
              type="email"
              placeholder="Email address"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
              className="w-full px-3.5 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent transition placeholder:text-gray-400"
            />
          </div>
          <div>
            <input
              type="password"
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={6}
              autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
              className="w-full px-3.5 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent transition placeholder:text-gray-400"
            />
          </div>

          {error && (
            <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">{error}</p>
          )}
          {message && (
            <p className="text-sm text-teal-700 bg-teal-50 px-3 py-2 rounded-lg">{message}</p>
          )}

          <button
            type="submit"
            disabled={submitting || googleLoading}
            className="w-full py-2.5 px-4 bg-teal-600 text-white rounded-lg text-sm font-medium cursor-pointer transition-all duration-200 hover:bg-teal-700 disabled:opacity-50"
          >
            {submitting
              ? (mode === 'signin' ? 'Signing in...' : 'Creating account...')
              : (mode === 'signin' ? 'Sign In' : 'Create Account')
            }
          </button>
        </form>

        {/* Toggle sign-in / sign-up */}
        <p className="text-center text-sm text-gray-500">
          {mode === 'signin' ? (
            <>
              Don&apos;t have an account?{' '}
              <button
                type="button"
                onClick={() => { setMode('signup'); setError(''); setMessage(''); }}
                className="text-teal-600 font-medium hover:underline"
              >
                Sign Up
              </button>
            </>
          ) : (
            <>
              Already have an account?{' '}
              <button
                type="button"
                onClick={() => { setMode('signin'); setError(''); setMessage(''); }}
                className="text-teal-600 font-medium hover:underline"
              >
                Sign In
              </button>
            </>
          )}
        </p>

        {/* Reassurance */}
        <p className="text-center text-xs text-gray-400 mt-3">
          It&apos;s free — no credit card needed
        </p>
      </div>
    </div>
  );
}
