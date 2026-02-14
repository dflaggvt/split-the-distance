'use client';

/**
 * /trips — My Trips list page.
 * Shows all trips the current user belongs to, with status badges and quick actions.
 */

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/components/AuthProvider';
import { fetchMyTrips } from '@/lib/trips';
import Link from 'next/link';

const STATUS_BADGE = {
  planning: { label: 'Planning', className: 'bg-blue-100 text-blue-700' },
  confirmed: { label: 'Confirmed', className: 'bg-green-100 text-green-700' },
  active: { label: 'Active', className: 'bg-amber-100 text-amber-700' },
  completed: { label: 'Completed', className: 'bg-gray-100 text-gray-600' },
  canceled: { label: 'Canceled', className: 'bg-red-100 text-red-600' },
};

export default function TripsPage() {
  const { user, isLoggedIn } = useAuth();
  const router = useRouter();
  const [trips, setTrips] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isLoggedIn) return;
    setLoading(true);
    fetchMyTrips()
      .then(setTrips)
      .catch((err) => console.error('Failed to load trips:', err))
      .finally(() => setLoading(false));
  }, [isLoggedIn]);

  // Redirect unauthenticated users
  if (!isLoggedIn) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-8 text-center max-w-md">
          <div className="text-4xl mb-3">🗺️</div>
          <h2 className="text-xl font-bold text-gray-900 mb-2">Sign in to see your trips</h2>
          <p className="text-sm text-gray-500">
            Create and join collaborative group trips with friends and family.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-3xl mx-auto px-5 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/" className="text-gray-400 hover:text-gray-600 transition no-underline">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M15 18l-6-6 6-6" />
              </svg>
            </Link>
            <h1 className="text-xl font-bold text-gray-900">My Trips</h1>
          </div>
          <Link
            href="/trips/new"
            className="flex items-center gap-1.5 px-4 py-2 bg-teal-600 text-white text-sm font-medium rounded-lg hover:bg-teal-700 transition no-underline"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
            New Trip
          </Link>
        </div>
      </header>

      {/* Content */}
      <main className="max-w-3xl mx-auto px-5 py-6">
        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="bg-white rounded-xl border border-gray-200 p-5 animate-pulse">
                <div className="h-5 w-48 bg-gray-200 rounded mb-2" />
                <div className="h-4 w-32 bg-gray-100 rounded" />
              </div>
            ))}
          </div>
        ) : trips.length === 0 ? (
          <div className="bg-white rounded-2xl border border-gray-200 p-12 text-center">
            <div className="text-5xl mb-4">🗺️</div>
            <h2 className="text-lg font-bold text-gray-900 mb-2">No trips yet</h2>
            <p className="text-sm text-gray-500 mb-6 max-w-sm mx-auto">
              Plan your first trip! Invite friends, vote on dates, and find the perfect meeting point.
            </p>
            <Link
              href="/trips/new"
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-teal-600 text-white text-sm font-medium rounded-lg hover:bg-teal-700 transition no-underline"
            >
              Create Your First Trip
            </Link>
          </div>
        ) : (
          <div className="space-y-3">
            {trips.map((trip) => {
              const badge = STATUS_BADGE[trip.status] || STATUS_BADGE.planning;
              const memberCount = trip.trip_members?.filter(m => m.status === 'joined').length || 0;

              return (
                <Link
                  key={trip.id}
                  href={`/trips/${trip.id}`}
                  className="block bg-white rounded-xl border border-gray-200 p-5 hover:border-teal-300 hover:shadow-sm transition-all no-underline group"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="font-semibold text-gray-900 truncate group-hover:text-teal-700 transition-colors">
                          {trip.title}
                        </h3>
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0 ${badge.className}`}>
                          {badge.label}
                        </span>
                      </div>
                      {trip.description && (
                        <p className="text-sm text-gray-500 truncate mb-2">{trip.description}</p>
                      )}
                      <div className="flex items-center gap-3 text-xs text-gray-400">
                        <span className="flex items-center gap-1">
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                            <circle cx="12" cy="7" r="4" />
                          </svg>
                          {memberCount} member{memberCount !== 1 ? 's' : ''}
                        </span>
                        {trip.confirmed_date && (
                          <span className="flex items-center gap-1 text-green-600">
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                              <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                              <line x1="16" y1="2" x2="16" y2="6" />
                              <line x1="8" y1="2" x2="8" y2="6" />
                              <line x1="3" y1="10" x2="21" y2="10" />
                            </svg>
                            {new Date(trip.confirmed_date).toLocaleDateString()}
                          </span>
                        )}
                      </div>
                    </div>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-gray-300 group-hover:text-teal-500 transition-colors shrink-0 ml-3 mt-1">
                      <path d="M9 18l6-6-6-6" />
                    </svg>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}
