'use client';

/**
 * TripInvite — Modal for sharing the trip invite link.
 * Shows the link, copy button, and share options.
 */

import { useState, useEffect } from 'react';

export default function TripInvite({ inviteCode, tripTitle, onClose }) {
  const [copied, setCopied] = useState(false);

  const inviteUrl = typeof window !== 'undefined'
    ? `${window.location.origin}/trips/join/${inviteCode}`
    : `https://splitthedistance.com/trips/join/${inviteCode}`;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(inviteUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback for older browsers
      const input = document.createElement('input');
      input.value = inviteUrl;
      document.body.appendChild(input);
      input.select();
      document.execCommand('copy');
      document.body.removeChild(input);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: `Join "${tripTitle}" on Split The Distance`,
          text: `Join my trip "${tripTitle}" and help plan our meetup!`,
          url: inviteUrl,
        });
      } catch {
        // User cancelled share
      }
    }
  };

  // Close on escape
  useEffect(() => {
    const handleEsc = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-[2000] flex items-center justify-center px-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />

      {/* Modal */}
      <div className="relative bg-white rounded-2xl shadow-xl border border-gray-200 p-6 max-w-md w-full animate-fadeInUp">
        <button
          onClick={onClose}
          className="absolute top-3 right-3 text-gray-400 hover:text-gray-600 transition"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>

        <div className="text-center mb-5">
          <div className="text-3xl mb-2">🔗</div>
          <h2 className="text-lg font-bold text-gray-900">Invite People</h2>
          <p className="text-sm text-gray-500 mt-1">Share this link so others can join your trip.</p>
        </div>

        {/* Invite URL */}
        <div className="flex items-center gap-2 mb-4">
          <div className="flex-1 px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-lg text-sm text-gray-700 truncate font-mono">
            {inviteUrl}
          </div>
          <button
            onClick={handleCopy}
            className={`shrink-0 px-4 py-2.5 rounded-lg text-sm font-semibold transition ${
              copied
                ? 'bg-green-100 text-green-700 border border-green-200'
                : 'bg-teal-600 text-white hover:bg-teal-700'
            }`}
          >
            {copied ? '✓ Copied' : 'Copy'}
          </button>
        </div>

        {/* Share button (Web Share API) */}
        {typeof navigator !== 'undefined' && navigator.share && (
          <button
            onClick={handleShare}
            className="w-full py-2.5 bg-gray-50 border border-gray-200 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-100 transition flex items-center justify-center gap-2"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="18" cy="5" r="3" />
              <circle cx="6" cy="12" r="3" />
              <circle cx="18" cy="19" r="3" />
              <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" />
              <line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
            </svg>
            Share via...
          </button>
        )}

        <p className="text-xs text-gray-400 text-center mt-4">
          Anyone with this link can join the trip.
        </p>
      </div>
    </div>
  );
}
