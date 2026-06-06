'use client';

import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { onAuthStateChange, upsertUserProfile, fetchUserProfile, signOut as authSignOut } from '@/lib/auth';
import { logUserEvent } from '@/lib/userEvents';
import { logSessionEvent, setTrackedSessionUserId } from '@/lib/sessionEvents';
import { associateCurrentSessionUser } from '@/lib/analytics';

const AuthContext = createContext({
  user: null,
  profile: null,
  plan: 'anonymous', // anonymous | free | premium | enterprise
  isLoggedIn: false,
  loading: true,
  signOut: async () => {},
  refreshProfile: async () => {},
});

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [accessToken, setAccessToken] = useState(null);
  const [loading, setLoading] = useState(true);

  // Derive plan from profile (or 'anonymous' if not logged in)
  const plan = user ? (profile?.plan || 'free') : 'anonymous';
  const isLoggedIn = !!user;

  useEffect(() => {
    // Listen to auth state changes
    const unsubscribe = onAuthStateChange(async (event, session) => {
      const currentUser = session?.user || null;
      setUser(currentUser);
      setAccessToken(session?.access_token || null);

      if (currentUser) {
        setTrackedSessionUserId(currentUser.id);
        associateCurrentSessionUser(currentUser.id, session?.access_token);

        // Upsert profile on sign in (ensures row exists, updates name/avatar)
        if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
          const upserted = await upsertUserProfile(currentUser);
          setProfile(upserted);
          // Track sign-in event (fire-and-forget, once per browser session)
          if (event === 'SIGNED_IN') {
            try {
              const alreadyLogged = sessionStorage.getItem('std_signin_logged');
              if (!alreadyLogged) {
                logUserEvent(currentUser.id, 'sign_in', {
                  method: currentUser.app_metadata?.provider || 'unknown',
                  email: currentUser.email,
                });
                logSessionEvent('sign_in', {
                  method: currentUser.app_metadata?.provider || 'unknown',
                  email: currentUser.email,
                }, { userId: currentUser.id });
                sessionStorage.setItem('std_signin_logged', '1');
              }
            } catch {}
          }
        } else {
          // Just fetch existing profile
          const existing = await fetchUserProfile(currentUser.id);
          setProfile(existing);
        }
      } else {
        setAccessToken(null);
        setTrackedSessionUserId(null);
        setProfile(null);
      }

      setLoading(false);
    });

    return unsubscribe;
  }, []);

  useEffect(() => {
    if (!user) return undefined;

    const handleSessionStarted = () => {
      associateCurrentSessionUser(user.id, accessToken);
    };

    window.addEventListener('std:session-started', handleSessionStarted);
    return () => window.removeEventListener('std:session-started', handleSessionStarted);
  }, [user, accessToken]);

  const handleSignOut = useCallback(async () => {
    await authSignOut();
    setUser(null);
    setProfile(null);
  }, []);

  // Re-fetch the profile from DB (e.g. after Stripe upgrade updates the plan)
  const refreshProfile = useCallback(async () => {
    if (!user) return;
    const updated = await fetchUserProfile(user.id);
    if (updated) setProfile(updated);
  }, [user]);

  return (
    <AuthContext.Provider
      value={{
        user,
        profile,
        plan,
        isLoggedIn,
        loading,
        signOut: handleSignOut,
        refreshProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
