'use client';

import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { onAuthStateChange, upsertUserProfile, fetchUserProfile, signOut as authSignOut } from '@/lib/auth';

const AuthContext = createContext({
  user: null,
  profile: null,
  plan: 'anonymous', // anonymous | free | premium | enterprise
  isLoggedIn: false,
  loading: true,
  signOut: async () => {},
});

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  // Derive plan from profile (or 'anonymous' if not logged in)
  const plan = user ? (profile?.plan || 'free') : 'anonymous';
  const isLoggedIn = !!user;

  useEffect(() => {
    // Listen to auth state changes
    const unsubscribe = onAuthStateChange(async (event, session) => {
      const currentUser = session?.user || null;
      setUser(currentUser);

      if (currentUser) {
        // Upsert profile on sign in (ensures row exists, updates name/avatar)
        if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
          const upserted = await upsertUserProfile(currentUser);
          setProfile(upserted);
        } else {
          // Just fetch existing profile
          const existing = await fetchUserProfile(currentUser.id);
          setProfile(existing);
        }
      } else {
        setProfile(null);
      }

      setLoading(false);
    });

    return unsubscribe;
  }, []);

  const handleSignOut = useCallback(async () => {
    await authSignOut();
    setUser(null);
    setProfile(null);
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        profile,
        plan,
        isLoggedIn,
        loading,
        signOut: handleSignOut,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
