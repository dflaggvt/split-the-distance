/**
 * auth.js — Supabase Auth helpers
 * 
 * Provides sign-in (Google/Apple OAuth), sign-out, and auth state management.
 * Works with the existing Supabase client from ./supabase.js.
 */

import { supabase } from './supabase';

/**
 * Sign in with Google OAuth via Supabase Auth.
 * Redirects to Google's consent screen, then back to the app.
 */
export async function signInWithGoogle() {
  if (!supabase) {
    console.error('[Auth] No Supabase client available');
    return { error: { message: 'Authentication service unavailable' } };
  }

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: `${window.location.origin}${window.location.pathname}${window.location.search}`,
    },
  });

  return { data, error };
}

/**
 * Sign in with Apple OAuth via Supabase Auth.
 */
export async function signInWithApple() {
  if (!supabase) {
    console.error('[Auth] No Supabase client available');
    return { error: { message: 'Authentication service unavailable' } };
  }

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'apple',
    options: {
      redirectTo: `${window.location.origin}${window.location.pathname}${window.location.search}`,
    },
  });

  return { data, error };
}

/**
 * Sign out the current user.
 */
export async function signOut() {
  if (!supabase) return { error: null };
  const { error } = await supabase.auth.signOut();
  return { error };
}

/**
 * Get the current authenticated user (if any).
 */
export async function getCurrentUser() {
  if (!supabase) return null;
  const { data: { user } } = await supabase.auth.getUser();
  return user;
}

/**
 * Get the current session.
 */
export async function getSession() {
  if (!supabase) return null;
  const { data: { session } } = await supabase.auth.getSession();
  return session;
}

/**
 * Subscribe to auth state changes.
 * Returns an unsubscribe function.
 */
export function onAuthStateChange(callback) {
  if (!supabase) return () => {};
  const { data: { subscription } } = supabase.auth.onAuthStateChange(
    (event, session) => {
      callback(event, session);
    }
  );
  return () => subscription?.unsubscribe();
}

/**
 * Upsert a user profile row in user_profiles table.
 * Called on sign-in to ensure profile exists.
 */
export async function upsertUserProfile(user) {
  if (!supabase || !user) return null;

  const profile = {
    id: user.id,
    email: user.email,
    display_name: user.user_metadata?.full_name || user.user_metadata?.name || user.email?.split('@')[0] || 'User',
    avatar_url: user.user_metadata?.avatar_url || user.user_metadata?.picture || null,
  };

  const { data, error } = await supabase
    .from('user_profiles')
    .upsert(profile, { onConflict: 'id', ignoreDuplicates: false })
    .select()
    .single();

  if (error) {
    console.error('[Auth] Profile upsert error:', error);
    return null;
  }
  return data;
}

/**
 * Fetch the user's profile (including plan).
 */
export async function fetchUserProfile(userId) {
  if (!supabase || !userId) return null;

  const { data, error } = await supabase
    .from('user_profiles')
    .select('*')
    .eq('id', userId)
    .single();

  if (error) {
    console.error('[Auth] Profile fetch error:', error);
    return null;
  }
  return data;
}
