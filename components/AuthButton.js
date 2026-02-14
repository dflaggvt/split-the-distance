'use client';

import { useState, useRef, useEffect } from 'react';
import { useAuth } from './AuthProvider';
import { useFeatures } from './FeatureProvider';

const PLAN_BADGES = {
  anonymous: null,
  free: { label: 'FREE', className: 'bg-gray-100 text-gray-600' },
  premium: { label: 'PRO', className: 'bg-purple-100 text-purple-700' },
  enterprise: { label: 'ENT', className: 'bg-blue-100 text-blue-700' },
};

export default function AuthButton() {
  const { user, profile, plan, isLoggedIn, signOut } = useAuth();
  const { openPricingModal, openSignIn, openAccountModal } = useFeatures();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef(null);

  // Close menu on outside click
  useEffect(() => {
    function handleClickOutside(e) {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setMenuOpen(false);
      }
    }
    if (menuOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [menuOpen]);

  // Signed out — show sign-in button that opens the sign-in modal
  if (!isLoggedIn) {
    return (
      <button
        onClick={openSignIn}
        className="flex items-center gap-1.5 px-3 py-1.5 text-[13px] font-medium text-gray-600 bg-white border border-gray-200 rounded-lg cursor-pointer transition-all duration-200 hover:border-teal-400 hover:text-teal-700 hover:bg-teal-50"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
          <circle cx="12" cy="7" r="4" />
        </svg>
        Sign In
      </button>
    );
  }

  // Signed in — show avatar + dropdown
  const displayName = profile?.display_name || user?.email?.split('@')[0] || 'User';
  const avatarUrl = profile?.avatar_url;
  const badge = PLAN_BADGES[plan];

  return (
    <div className="relative" ref={menuRef}>
      <button
        onClick={() => setMenuOpen(!menuOpen)}
        className="flex items-center gap-2 px-2 py-1 rounded-lg cursor-pointer transition-colors duration-200 hover:bg-gray-100"
      >
        {avatarUrl ? (
          <img
            src={avatarUrl}
            alt={`${displayName}'s avatar`}
            className="w-7 h-7 rounded-full object-cover"
            referrerPolicy="no-referrer"
          />
        ) : (
          <div className="w-7 h-7 rounded-full bg-teal-100 text-teal-700 flex items-center justify-center text-xs font-bold">
            {displayName[0]?.toUpperCase()}
          </div>
        )}
        <span className="hidden sm:block text-sm font-medium text-gray-700 max-w-[120px] truncate">
          {displayName}
        </span>
        {badge && (
          <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${badge.className}`}>
            {badge.label}
          </span>
        )}
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="text-gray-400">
          <path d="M6 9l6 6 6-6" />
        </svg>
      </button>

      {/* Dropdown menu */}
      {menuOpen && (
        <div className="absolute right-0 top-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-50 min-w-[200px] py-1 animate-fadeInUp">
          {/* User info */}
          <div className="px-3.5 py-2.5 border-b border-gray-100">
            <div className="text-sm font-medium text-gray-900 truncate">{displayName}</div>
            <div className="text-xs text-gray-500 truncate">{user?.email}</div>
          </div>

          {/* My Trips */}
          <a
            href="/trips"
            onClick={() => setMenuOpen(false)}
            className="w-full flex items-center gap-2 px-3.5 py-2.5 text-left text-[13px] text-gray-700 hover:bg-gray-50 transition-colors no-underline"
          >
            <span>🗺️</span>
            <span className="font-medium">My Trips</span>
          </a>

          {/* Account settings */}
          <button
            onClick={() => { setMenuOpen(false); openAccountModal(); }}
            className="w-full flex items-center justify-between px-3.5 py-2.5 text-left text-[13px] text-gray-700 hover:bg-gray-50 transition-colors"
          >
            <span className="font-medium">My Account</span>
            {badge && (
              <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${badge.className}`}>
                {badge.label}
              </span>
            )}
          </button>

          {plan !== 'premium' && (
            <button
              onClick={() => { setMenuOpen(false); openPricingModal(); }}
              className="w-full flex items-center gap-2 px-3.5 py-2.5 text-left text-[13px] font-medium text-purple-600 hover:bg-purple-50 transition-colors"
            >
              <span>✨</span>
              <span>Upgrade to Premium</span>
            </button>
          )}

          {/* Divider */}
          <div className="border-t border-gray-100 my-1" />

          {/* Sign out */}
          <button
            onClick={() => { setMenuOpen(false); signOut(); }}
            className="w-full flex items-center gap-2 px-3.5 py-2.5 text-left text-[13px] text-gray-600 hover:bg-gray-50 transition-colors"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
              <polyline points="16 17 21 12 16 7" />
              <line x1="21" y1="12" x2="9" y2="12" />
            </svg>
            <span>Sign Out</span>
          </button>
        </div>
      )}
    </div>
  );
}
