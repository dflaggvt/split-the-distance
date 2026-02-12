'use client';

import { useState, useEffect } from 'react';
import { useAuth } from './AuthProvider';
import { useFeatures } from './FeatureProvider';
import { getSession, fetchSubscription } from '@/lib/auth';

/**
 * AccountModal — user account settings with plan info,
 * subscription management (Stripe Billing Portal), and account deletion.
 */
export default function AccountModal() {
  const { accountModalOpen, closeAccountModal, openPricingModal } = useFeatures();
  const { user, profile, plan, isLoggedIn, signOut } = useAuth();

  const [subscription, setSubscription] = useState(null);
  const [subLoading, setSubLoading] = useState(false);
  const [portalLoading, setPortalLoading] = useState(false);
  const [deleteStep, setDeleteStep] = useState('idle'); // 'idle' | 'confirm' | 'deleting'
  const [error, setError] = useState('');

  // Fetch subscription details when modal opens
  useEffect(() => {
    if (!accountModalOpen || !user) return;
    setSubLoading(true);
    setError('');
    setDeleteStep('idle');
    fetchSubscription(user.id)
      .then(setSubscription)
      .finally(() => setSubLoading(false));
  }, [accountModalOpen, user]);

  if (!accountModalOpen || !isLoggedIn) return null;

  const displayName = profile?.display_name || user?.email?.split('@')[0] || 'User';
  const email = user?.email || '';
  const avatarUrl = profile?.avatar_url;
  const initials = displayName.charAt(0).toUpperCase();

  // Format date for display
  const formatDate = (dateStr) => {
    if (!dateStr) return null;
    return new Date(dateStr).toLocaleDateString('en-US', {
      month: 'long',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const isPremium = plan === 'premium';
  const isActive = subscription && ['active', 'trialing'].includes(subscription.status);
  const cancelsPending = subscription?.cancel_at_period_end;
  const renewalDate = formatDate(subscription?.current_period_end);

  // Open Stripe Billing Portal
  const handleManageSubscription = async () => {
    setPortalLoading(true);
    setError('');
    try {
      const session = await getSession();
      if (!session?.access_token) {
        setError('Session expired. Please sign out and sign back in.');
        setPortalLoading(false);
        return;
      }

      const res = await fetch('/api/stripe/portal', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
      });

      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
      } else {
        setError(data.error || 'Could not open subscription manager. Please try again.');
        setPortalLoading(false);
      }
    } catch (err) {
      console.error('[Account] Portal error:', err);
      setError('Something went wrong. Please try again.');
      setPortalLoading(false);
    }
  };

  // Delete account
  const handleDeleteAccount = async () => {
    setDeleteStep('deleting');
    setError('');
    try {
      const session = await getSession();
      if (!session?.access_token) {
        setError('Session expired. Please sign out and sign back in.');
        setDeleteStep('confirm');
        return;
      }

      const res = await fetch('/api/account/delete', {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
        },
      });

      const data = await res.json();
      if (data.success) {
        closeAccountModal();
        await signOut();
      } else {
        setError(data.error || 'Failed to delete account. Please try again.');
        setDeleteStep('confirm');
      }
    } catch (err) {
      console.error('[Account] Delete error:', err);
      setError('Something went wrong. Please try again.');
      setDeleteStep('confirm');
    }
  };

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
        onClick={() => { if (deleteStep !== 'deleting') closeAccountModal(); }}
      />

      {/* Modal */}
      <div className="relative bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 max-h-[90vh] overflow-y-auto animate-fadeInUp">
        {/* Close button */}
        <button
          onClick={closeAccountModal}
          disabled={deleteStep === 'deleting'}
          className="absolute top-3 right-3 w-8 h-8 flex items-center justify-center rounded-full text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors disabled:opacity-30"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
            <path d="M18 6L6 18M6 6l12 12" />
          </svg>
        </button>

        {/* Header */}
        <div className="text-center mb-6">
          <h2 className="text-xl font-bold text-gray-900 mb-1">My Account</h2>
        </div>

        {/* Profile section */}
        <div className="flex items-center gap-3 mb-6 pb-5 border-b border-gray-100">
          {avatarUrl ? (
            <img src={avatarUrl} alt={displayName} className="w-12 h-12 rounded-full object-cover" />
          ) : (
            <div className="w-12 h-12 rounded-full bg-teal-100 text-teal-700 flex items-center justify-center text-lg font-bold">
              {initials}
            </div>
          )}
          <div className="flex-1 min-w-0">
            <div className="text-sm font-semibold text-gray-900 truncate">{displayName}</div>
            <div className="text-xs text-gray-500 truncate">{email}</div>
          </div>
          <span className={`shrink-0 text-[10px] font-bold px-2 py-0.5 rounded-full ${
            isPremium
              ? 'text-purple-700 bg-purple-100'
              : 'text-teal-700 bg-teal-100'
          }`}>
            {isPremium ? 'PRO' : 'FREE'}
          </span>
        </div>

        {/* Plan & Subscription section */}
        <div className="mb-6">
          <h3 className="text-sm font-bold text-gray-700 mb-3">Subscription</h3>

          {subLoading ? (
            <div className="flex items-center justify-center py-4">
              <span className="inline-block w-5 h-5 border-2 border-gray-300 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : isPremium && subscription ? (
            <div className="rounded-xl border border-purple-200 bg-purple-50/30 p-4 mb-3">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-semibold text-gray-900">Premium Plan</span>
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                  cancelsPending
                    ? 'text-amber-700 bg-amber-100'
                    : 'text-green-700 bg-green-100'
                }`}>
                  {cancelsPending ? 'CANCELS SOON' : 'ACTIVE'}
                </span>
              </div>

              {cancelsPending && renewalDate ? (
                <p className="text-xs text-amber-600 mb-3">
                  Your subscription will end on {renewalDate}. You&apos;ll keep premium access until then.
                </p>
              ) : renewalDate ? (
                <p className="text-xs text-gray-500 mb-3">
                  Next renewal: {renewalDate}
                </p>
              ) : null}

              <button
                onClick={handleManageSubscription}
                disabled={portalLoading}
                className="w-full py-2.5 px-4 text-sm font-semibold text-purple-700 bg-white border border-purple-200 rounded-lg cursor-pointer transition-all hover:bg-purple-50 hover:border-purple-300 disabled:opacity-50"
              >
                {portalLoading ? 'Opening...' : 'Manage Subscription'}
              </button>
              <p className="text-[11px] text-gray-400 mt-2 text-center">
                Update payment method, view invoices, or cancel
              </p>
            </div>
          ) : (
            <div className="rounded-xl border border-gray-200 bg-gray-50/50 p-4 mb-3">
              <p className="text-sm text-gray-600 mb-3">
                You&apos;re on the <span className="font-semibold">Free</span> plan.
                Upgrade to unlock premium features.
              </p>
              <button
                onClick={() => { closeAccountModal(); openPricingModal(); }}
                className="w-full py-2.5 px-4 text-sm font-semibold text-white bg-gradient-to-r from-purple-600 to-purple-700 rounded-lg cursor-pointer transition-all hover:from-purple-700 hover:to-purple-800 shadow-sm"
              >
                Upgrade to Premium
              </button>
            </div>
          )}
        </div>

        {/* Danger zone */}
        <div className="pt-5 border-t border-gray-100">
          <h3 className="text-sm font-bold text-gray-700 mb-3">Danger Zone</h3>

          {deleteStep === 'idle' && (
            <button
              onClick={() => setDeleteStep('confirm')}
              className="w-full py-2.5 px-4 text-sm font-medium text-red-600 bg-white border border-red-200 rounded-lg cursor-pointer transition-all hover:bg-red-50 hover:border-red-300"
            >
              Delete Account
            </button>
          )}

          {deleteStep === 'confirm' && (
            <div className="rounded-xl border border-red-200 bg-red-50 p-4">
              <p className="text-sm text-red-700 font-medium mb-1">Are you sure?</p>
              <p className="text-xs text-red-600 mb-4">
                This will permanently delete your account and all associated data.
                {isPremium && ' Your premium subscription will be cancelled immediately.'}
                {' '}This cannot be undone.
              </p>
              <div className="flex gap-2">
                <button
                  onClick={() => setDeleteStep('idle')}
                  className="flex-1 py-2 px-3 text-sm font-medium text-gray-700 bg-white border border-gray-200 rounded-lg cursor-pointer transition-colors hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  onClick={handleDeleteAccount}
                  className="flex-1 py-2 px-3 text-sm font-semibold text-white bg-red-600 rounded-lg cursor-pointer transition-colors hover:bg-red-700"
                >
                  Delete My Account
                </button>
              </div>
            </div>
          )}

          {deleteStep === 'deleting' && (
            <div className="flex items-center justify-center gap-2 py-4">
              <span className="inline-block w-4 h-4 border-2 border-red-400 border-t-transparent rounded-full animate-spin" />
              <span className="text-sm text-red-600">Deleting account...</span>
            </div>
          )}
        </div>

        {/* Error */}
        {error && (
          <p className="text-center text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg mt-4">
            {error}
          </p>
        )}
      </div>
    </div>
  );
}
