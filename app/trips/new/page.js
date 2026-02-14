'use client';

/**
 * /trips/new — Multi-step trip creation wizard.
 *
 * Steps:
 *   1. Name & Description
 *   2. Build Guest List (email/name entries)
 *   3. Date Preferences (range or specific dates)
 *   4. Location Criteria (4 modes)
 *   5. Review & Create
 */

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/components/AuthProvider';
import { createTrip, addGuest, updateTrip, proposeDate, getMyMembership } from '@/lib/trips';
import { DayPicker } from 'react-day-picker';
import { format } from 'date-fns';
import 'react-day-picker/style.css';
import LocationInput from '@/components/LocationInput';
import Link from 'next/link';

const STEPS = [
  { id: 'details', label: 'Trip Details' },
  { id: 'guests', label: 'Guest List' },
  { id: 'dates', label: 'Dates' },
  { id: 'location', label: 'Location' },
  { id: 'review', label: 'Review' },
];

const LOCATION_MODES = [
  {
    id: 'fairest_all',
    icon: '🎯',
    title: 'Fairest for Everyone',
    desc: 'Auto-calculate the best meeting point based on all members\' locations.',
  },
  {
    id: 'fairest_selected',
    icon: '👥',
    title: 'Fairest for Selected',
    desc: 'Calculate midpoint for specific people you choose.',
  },
  {
    id: 'fairest_custom',
    icon: '📍',
    title: 'Between Two Points',
    desc: 'Find the midpoint between two specific places.',
  },
  {
    id: 'specific',
    icon: '🏖️',
    title: 'Specific Destination',
    desc: 'You already know where you\'re going — skip the midpoint.',
  },
];

export default function NewTripPage() {
  const { user, profile, isLoggedIn, loading: authLoading } = useAuth();
  const router = useRouter();

  const [step, setStep] = useState(0);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState(null);

  // Step 1: Details
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');

  // Step 2: Guests
  const [guests, setGuests] = useState([]);
  const [guestEmail, setGuestEmail] = useState('');
  const [guestName, setGuestName] = useState('');

  // Step 3: Dates
  const [dateMode, setDateMode] = useState('specific'); // 'specific' | 'range'
  const [selectedDates, setSelectedDates] = useState([]);
  const [dateRange, setDateRange] = useState({ from: null, to: null });

  // Step 4: Location
  const [locationMode, setLocationMode] = useState('fairest_all');
  const [customEndpoints, setCustomEndpoints] = useState([null, null]);
  const [endpointSearches, setEndpointSearches] = useState(['', '']);

  // Auth loading
  if (authLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-8 text-center animate-pulse">
          <div className="w-16 h-16 bg-gray-200 rounded-full mx-auto mb-4" />
          <div className="h-5 w-48 bg-gray-200 rounded mx-auto mb-2" />
          <div className="h-4 w-32 bg-gray-100 rounded mx-auto" />
        </div>
      </div>
    );
  }

  if (!isLoggedIn) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-8 text-center max-w-md">
          <div className="text-4xl mb-3">🗺️</div>
          <h2 className="text-xl font-bold text-gray-900 mb-2">Sign in to create a trip</h2>
          <p className="text-sm text-gray-500">You need to be signed in to create a collaborative trip.</p>
        </div>
      </div>
    );
  }

  // Guest helpers
  const handleAddGuest = (e) => {
    e.preventDefault();
    if (!guestEmail.trim() && !guestName.trim()) return;
    setGuests(prev => [...prev, {
      id: Date.now(),
      email: guestEmail.trim() || null,
      displayName: guestName.trim() || guestEmail.split('@')[0] || 'Guest',
    }]);
    setGuestEmail('');
    setGuestName('');
  };

  const handleRemoveGuest = (id) => {
    setGuests(prev => prev.filter(g => g.id !== id));
  };

  // Date helpers
  const handleDateSelect = (date) => {
    if (!date) return;
    const dateStr = format(date, 'yyyy-MM-dd');
    setSelectedDates(prev => {
      if (prev.includes(dateStr)) return prev.filter(d => d !== dateStr);
      return [...prev, dateStr];
    });
  };

  // Location endpoint helpers
  const handleEndpointSelect = (index, place) => {
    if (!place?.lat) return;
    setCustomEndpoints(prev => {
      const next = [...prev];
      next[index] = { lat: place.lat, lng: place.lng || place.lon, name: place.formattedAddress || place.name };
      return next;
    });
  };

  // Final create
  const handleCreate = async () => {
    if (!title.trim()) return;
    setCreating(true);
    setError(null);

    try {
      // 1. Create the trip
      const trip = await createTrip({
        title: title.trim(),
        description: description.trim() || null,
        displayName: profile?.display_name || user?.email?.split('@')[0] || 'Creator',
        email: user?.email,
      });

      // 2. Update trip with location mode and criteria
      const updates = {
        location_mode: locationMode,
      };
      if (locationMode === 'fairest_custom' && customEndpoints[0] && customEndpoints[1]) {
        updates.location_criteria = { endpoints: customEndpoints };
      }
      await updateTrip(trip.id, updates);

      // 3. Add guests (as pending members)
      for (const guest of guests) {
        try {
          await addGuest(trip.id, { email: guest.email, displayName: guest.displayName });
        } catch (err) {
          console.warn('Failed to add guest:', guest.email, err);
        }
      }

      // 4. Propose initial dates (if any were selected in the wizard)
      // We need the creator's membership to propose dates
      const membership = await getMyMembership(trip.id);
      if (membership) {
        if (dateMode === 'range' && dateRange.from && dateRange.to) {
          try {
            await proposeDate(trip.id, membership.id, {
              dateStart: format(dateRange.from, 'yyyy-MM-dd'),
              dateEnd: format(dateRange.to, 'yyyy-MM-dd'),
            });
          } catch (err) {
            console.warn('Failed to propose date range:', err);
          }
        } else if (dateMode === 'specific' && selectedDates.length > 0) {
          for (const dateStr of selectedDates) {
            try {
              await proposeDate(trip.id, membership.id, { dateStart: dateStr });
            } catch (err) {
              console.warn('Failed to propose date:', dateStr, err);
            }
          }
        }
      }

      // Navigate to the trip
      router.push(`/trips/${trip.id}`);
    } catch (err) {
      console.error('Failed to create trip:', err);
      setError(err.message || 'Something went wrong. Please try again.');
      setCreating(false);
    }
  };

  const canNext = () => {
    switch (step) {
      case 0: return title.trim().length > 0;
      case 1: return true; // guests are optional
      case 2: return true; // dates are optional at creation time
      case 3:
        // fairest_custom requires both endpoints
        if (locationMode === 'fairest_custom') {
          return !!customEndpoints[0] && !!customEndpoints[1];
        }
        return true;
      case 4: return true;
      default: return false;
    }
  };

  const currentStep = STEPS[step];

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-2xl mx-auto px-5 py-4 flex items-center gap-3">
          <Link href="/trips" className="text-gray-400 hover:text-gray-600 transition no-underline">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M15 18l-6-6 6-6" />
            </svg>
          </Link>
          <h1 className="text-xl font-bold text-gray-900">Create a Trip</h1>
        </div>
      </header>

      {/* Progress bar */}
      <div className="max-w-2xl mx-auto px-5 pt-6 pb-2">
        <div className="flex items-center gap-1">
          {STEPS.map((s, i) => (
            <div key={s.id} className="flex-1 flex items-center gap-1">
              <div className={`h-1.5 flex-1 rounded-full transition ${i <= step ? 'bg-teal-500' : 'bg-gray-200'}`} />
            </div>
          ))}
        </div>
        <div className="flex justify-between mt-2">
          {STEPS.map((s, i) => (
            <span
              key={s.id}
              className={`text-[10px] font-medium ${i <= step ? 'text-teal-600' : 'text-gray-400'}`}
            >
              {s.label}
            </span>
          ))}
        </div>
      </div>

      {/* Step content */}
      <main className="max-w-2xl mx-auto px-5 py-6">
        <div className="bg-white rounded-2xl border border-gray-200 p-6">
          {/* Step 1: Details */}
          {step === 0 && (
            <div className="space-y-5">
              <div>
                <h2 className="text-lg font-bold text-gray-900 mb-1">Trip Details</h2>
                <p className="text-sm text-gray-500">Give your trip a name and optional description.</p>
              </div>
              <div>
                <label htmlFor="title" className="block text-sm font-semibold text-gray-900 mb-1.5">
                  Trip Name <span className="text-red-400">*</span>
                </label>
                <input
                  id="title"
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. Spring Weekend Getaway"
                  maxLength={100}
                  className="w-full px-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                  autoFocus
                />
              </div>
              <div>
                <label htmlFor="description" className="block text-sm font-semibold text-gray-900 mb-1.5">
                  Description <span className="text-gray-400 font-normal">(optional)</span>
                </label>
                <textarea
                  id="description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="What's this trip about?"
                  rows={3}
                  maxLength={500}
                  className="w-full px-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent resize-none"
                />
              </div>
            </div>
          )}

          {/* Step 2: Guests */}
          {step === 1 && (
            <div className="space-y-5">
              <div>
                <h2 className="text-lg font-bold text-gray-900 mb-1">Build Your Guest List</h2>
                <p className="text-sm text-gray-500">Add people you want to invite. You can send invites later.</p>
              </div>
              <form onSubmit={handleAddGuest} className="flex gap-2">
                <input
                  type="text"
                  value={guestName}
                  onChange={(e) => setGuestName(e.target.value)}
                  placeholder="Name"
                  className="flex-1 px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
                />
                <input
                  type="email"
                  value={guestEmail}
                  onChange={(e) => setGuestEmail(e.target.value)}
                  placeholder="Email (optional)"
                  className="flex-1 px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
                />
                <button
                  type="submit"
                  disabled={!guestEmail.trim() && !guestName.trim()}
                  className="px-4 py-2 bg-teal-600 text-white text-sm font-semibold rounded-lg hover:bg-teal-700 transition disabled:opacity-50"
                >
                  Add
                </button>
              </form>
              {guests.length > 0 ? (
                <div className="space-y-2">
                  {guests.map(g => (
                    <div key={g.id} className="flex items-center gap-3 py-2 px-3 bg-gray-50 rounded-lg">
                      <div className="w-7 h-7 rounded-full bg-teal-100 text-teal-700 flex items-center justify-center text-xs font-bold">
                        {(g.displayName || '?')[0]?.toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900 truncate">{g.displayName}</p>
                        {g.email && <p className="text-xs text-gray-400 truncate">{g.email}</p>}
                      </div>
                      <button onClick={() => handleRemoveGuest(g.id)} className="text-gray-300 hover:text-red-500 transition">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                        </svg>
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-gray-400 text-sm">
                  No guests added yet. You can also add guests after creating the trip.
                </div>
              )}
            </div>
          )}

          {/* Step 3: Dates */}
          {step === 2 && (
            <div className="space-y-5">
              <div>
                <h2 className="text-lg font-bold text-gray-900 mb-1">Date Preferences</h2>
                <p className="text-sm text-gray-500">Optionally set initial dates. Members can propose more later.</p>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => setDateMode('specific')}
                  className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium border transition ${
                    dateMode === 'specific'
                      ? 'bg-teal-50 border-teal-300 text-teal-700'
                      : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'
                  }`}
                >
                  Specific Dates
                </button>
                <button
                  onClick={() => setDateMode('range')}
                  className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium border transition ${
                    dateMode === 'range'
                      ? 'bg-teal-50 border-teal-300 text-teal-700'
                      : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'
                  }`}
                >
                  Date Range
                </button>
              </div>
              <div className="flex justify-center">
                {dateMode === 'specific' ? (
                  <div>
                    <DayPicker
                      mode="multiple"
                      selected={selectedDates.map(d => new Date(d + 'T00:00:00'))}
                      onSelect={(dates) => {
                        setSelectedDates((dates || []).map(d => format(d, 'yyyy-MM-dd')));
                      }}
                      disabled={{ before: new Date() }}
                      className="text-sm"
                    />
                    {selectedDates.length > 0 && (
                      <p className="text-xs text-teal-600 text-center mt-1">
                        {selectedDates.length} date{selectedDates.length !== 1 ? 's' : ''} selected
                      </p>
                    )}
                  </div>
                ) : (
                  <div>
                    <DayPicker
                      mode="range"
                      selected={dateRange}
                      onSelect={(range) => setDateRange(range || { from: null, to: null })}
                      disabled={{ before: new Date() }}
                      className="text-sm"
                    />
                    {dateRange.from && dateRange.to && (
                      <p className="text-xs text-teal-600 text-center mt-1">
                        {format(dateRange.from, 'MMM d')} — {format(dateRange.to, 'MMM d, yyyy')}
                      </p>
                    )}
                  </div>
                )}
              </div>
              <p className="text-xs text-gray-400 text-center">
                This is optional. You and your guests can propose dates after the trip is created.
              </p>
            </div>
          )}

          {/* Step 4: Location */}
          {step === 3 && (
            <div className="space-y-5">
              <div>
                <h2 className="text-lg font-bold text-gray-900 mb-1">How Will You Choose a Location?</h2>
                <p className="text-sm text-gray-500">Select how the meeting location will be determined.</p>
              </div>
              <div className="grid gap-3">
                {LOCATION_MODES.map(mode => (
                  <button
                    key={mode.id}
                    onClick={() => setLocationMode(mode.id)}
                    className={`text-left p-4 rounded-xl border-2 transition ${
                      locationMode === mode.id
                        ? 'border-teal-500 bg-teal-50'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <span className="text-2xl">{mode.icon}</span>
                      <div>
                        <p className={`text-sm font-semibold ${locationMode === mode.id ? 'text-teal-800' : 'text-gray-900'}`}>
                          {mode.title}
                        </p>
                        <p className="text-xs text-gray-500 mt-0.5">{mode.desc}</p>
                      </div>
                    </div>
                  </button>
                ))}
              </div>

              {/* Custom endpoints input for fairest_custom mode */}
              {locationMode === 'fairest_custom' && (
                <div className="space-y-3 pt-2">
                  <p className="text-sm font-medium text-gray-700">Enter two locations:</p>
                  {[0, 1].map(i => (
                    <div key={i}>
                      <label className="text-xs text-gray-500 mb-1 block">
                        {i === 0 ? 'Point A' : 'Point B'}
                      </label>
                      <LocationInput
                        value={endpointSearches[i]}
                        onChange={(v) => setEndpointSearches(prev => {
                          const next = [...prev];
                          next[i] = v;
                          return next;
                        })}
                        onSelect={(place) => handleEndpointSelect(i, place)}
                        onClear={() => {
                          setEndpointSearches(prev => { const n = [...prev]; n[i] = ''; return n; });
                          setCustomEndpoints(prev => { const n = [...prev]; n[i] = null; return n; });
                        }}
                        placeholder={i === 0 ? 'First location...' : 'Second location...'}
                        variant="from"
                      />
                      {customEndpoints[i] && (
                        <p className="text-xs text-teal-600 mt-1">{customEndpoints[i].name}</p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Step 5: Review */}
          {step === 4 && (
            <div className="space-y-5">
              <div>
                <h2 className="text-lg font-bold text-gray-900 mb-1">Review Your Trip</h2>
                <p className="text-sm text-gray-500">Everything look good? You can always change these later.</p>
              </div>

              <div className="space-y-3">
                <ReviewRow label="Trip Name" value={title} />
                {description && <ReviewRow label="Description" value={description} />}
                <ReviewRow
                  label="Guests"
                  value={guests.length > 0
                    ? `${guests.length} guest${guests.length !== 1 ? 's' : ''}: ${guests.map(g => g.displayName).join(', ')}`
                    : 'None yet — you can add guests after creating'}
                />
                <ReviewRow
                  label="Dates"
                  value={
                    dateMode === 'range' && dateRange.from && dateRange.to
                      ? `Range: ${format(dateRange.from, 'MMM d')} — ${format(dateRange.to, 'MMM d, yyyy')}`
                      : selectedDates.length > 0
                        ? `${selectedDates.length} date${selectedDates.length !== 1 ? 's' : ''} pre-selected`
                        : 'To be decided by the group'
                  }
                />
                <ReviewRow
                  label="Location Mode"
                  value={LOCATION_MODES.find(m => m.id === locationMode)?.title || locationMode}
                />
              </div>

              {error && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">{error}</div>
              )}
            </div>
          )}
        </div>

        {/* Navigation buttons */}
        <div className="flex justify-between mt-6">
          <button
            onClick={() => setStep(s => s - 1)}
            disabled={step === 0}
            className="px-5 py-2.5 text-sm font-medium text-gray-600 hover:text-gray-900 transition disabled:opacity-30 disabled:cursor-not-allowed"
          >
            Back
          </button>

          {step < STEPS.length - 1 ? (
            <button
              onClick={() => setStep(s => s + 1)}
              disabled={!canNext()}
              className="px-6 py-2.5 bg-teal-600 text-white text-sm font-semibold rounded-lg hover:bg-teal-700 transition disabled:opacity-50"
            >
              Next
            </button>
          ) : (
            <button
              onClick={handleCreate}
              disabled={creating || !title.trim()}
              className="px-6 py-2.5 bg-teal-600 text-white text-sm font-semibold rounded-lg hover:bg-teal-700 transition disabled:opacity-50"
            >
              {creating ? (
                <span className="flex items-center gap-2">
                  <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  Creating...
                </span>
              ) : 'Create Trip'}
            </button>
          )}
        </div>
      </main>
    </div>
  );
}

function ReviewRow({ label, value }) {
  return (
    <div className="flex items-start gap-3 py-2 px-3 bg-gray-50 rounded-lg">
      <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide w-28 shrink-0 pt-0.5">{label}</span>
      <span className="text-sm text-gray-900">{value}</span>
    </div>
  );
}
