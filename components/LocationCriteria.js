'use client';

/**
 * LocationCriteria — Host selects HOW the location will be determined.
 * 4 modes: fairest_all, fairest_selected, fairest_custom, specific.
 * Rendered before LocationVoting when trip.location_mode is not yet configured.
 */

import { useState } from 'react';
import { useTripContext } from './TripProvider';
import { updateTrip } from '@/lib/trips';
import LocationInput from './LocationInput';

const MODES = [
  {
    id: 'fairest_all',
    icon: '🎯',
    title: 'Fairest for Everyone',
    desc: 'Auto-calculate the optimal meeting point based on all members\' starting locations.',
    detail: 'Uses driving distance to find the most central point for the whole group.',
  },
  {
    id: 'fairest_selected',
    icon: '👥',
    title: 'Fairest for Selected Members',
    desc: 'Calculate the midpoint for specific members you choose.',
    detail: 'Useful when only some members\' locations matter for the meeting point.',
  },
  {
    id: 'fairest_custom',
    icon: '📍',
    title: 'Between Two Points',
    desc: 'Find the midpoint between two specific places.',
    detail: 'Great for meeting between two cities or points of interest.',
  },
  {
    id: 'specific',
    icon: '🏖️',
    title: 'Specific Destination',
    desc: 'You already know where you\'re going.',
    detail: 'Skip the midpoint — propose and vote on a known location. You still get routes, stops, and planning tools.',
  },
];

export default function LocationCriteria() {
  const { trip, members, myMembership, permissions, tripId, refetchTrip } = useTripContext();
  const [selected, setSelected] = useState(trip?.location_mode || 'fairest_all');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  // fairest_selected state
  const [selectedMemberIds, setSelectedMemberIds] = useState(
    trip?.location_criteria?.member_ids || []
  );

  // fairest_custom state
  const [endpoints, setEndpoints] = useState(
    trip?.location_criteria?.endpoints || [null, null]
  );
  const [endpointSearches, setEndpointSearches] = useState(['', '']);

  const nonCreatorMembers = members.filter(m => m.role !== 'creator' || m.id === myMembership?.id);

  const toggleMember = (memberId) => {
    setSelectedMemberIds(prev =>
      prev.includes(memberId)
        ? prev.filter(id => id !== memberId)
        : [...prev, memberId]
    );
  };

  const handleEndpointSelect = (index, place) => {
    if (!place?.lat) return;
    setEndpoints(prev => {
      const next = [...prev];
      next[index] = { lat: place.lat, lng: place.lng || place.lon, name: place.formattedAddress || place.name };
      return next;
    });
  };

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    try {
      const updates = { location_mode: selected };

      if (selected === 'fairest_selected') {
        if (selectedMemberIds.length < 2) {
          setError('Select at least 2 members.');
          setSaving(false);
          return;
        }
        updates.location_criteria = { member_ids: selectedMemberIds };
      } else if (selected === 'fairest_custom') {
        if (!endpoints[0] || !endpoints[1]) {
          setError('Enter both locations.');
          setSaving(false);
          return;
        }
        updates.location_criteria = { endpoints };
      } else {
        updates.location_criteria = null;
      }

      await updateTrip(tripId, updates);
      refetchTrip();
    } catch (err) {
      console.error('Failed to save location criteria:', err);
      setError(err.message || 'Failed to save');
    }
    setSaving(false);
  };

  if (!permissions.isHost) {
    // Non-hosts see a read-only summary
    const mode = MODES.find(m => m.id === trip?.location_mode) || MODES[0];
    return (
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <h3 className="font-semibold text-gray-900 mb-2">Location Strategy</h3>
        <div className="flex items-start gap-3">
          <span className="text-2xl">{mode.icon}</span>
          <div>
            <p className="text-sm font-medium text-gray-900">{mode.title}</p>
            <p className="text-xs text-gray-500 mt-0.5">{mode.detail}</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <h3 className="font-semibold text-gray-900 mb-1">Location Strategy</h3>
        <p className="text-sm text-gray-500 mb-4">How should the meeting location be determined?</p>

        <div className="grid gap-3">
          {MODES.map(mode => (
            <button
              key={mode.id}
              onClick={() => setSelected(mode.id)}
              className={`text-left p-4 rounded-xl border-2 transition ${
                selected === mode.id
                  ? 'border-teal-500 bg-teal-50'
                  : 'border-gray-200 hover:border-gray-300'
              }`}
            >
              <div className="flex items-start gap-3">
                <span className="text-2xl">{mode.icon}</span>
                <div>
                  <p className={`text-sm font-semibold ${selected === mode.id ? 'text-teal-800' : 'text-gray-900'}`}>
                    {mode.title}
                  </p>
                  <p className="text-xs text-gray-500 mt-0.5">{mode.desc}</p>
                </div>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Config panel for fairest_selected */}
      {selected === 'fairest_selected' && (
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h4 className="text-sm font-semibold text-gray-900 mb-3">Select Members to Include</h4>
          <div className="space-y-2">
            {members.filter(m => m.status === 'joined' || m.status === 'pending').map(m => (
              <label key={m.id} className="flex items-center gap-3 py-2 px-3 rounded-lg hover:bg-gray-50 cursor-pointer">
                <input
                  type="checkbox"
                  checked={selectedMemberIds.includes(m.id)}
                  onChange={() => toggleMember(m.id)}
                  className="w-4 h-4 rounded border-gray-300 text-teal-600 focus:ring-teal-500"
                />
                <span className="text-sm text-gray-700">{m.display_name}</span>
                {m.origin_name && (
                  <span className="text-xs text-gray-400 ml-auto">{m.origin_name}</span>
                )}
              </label>
            ))}
          </div>
          {selectedMemberIds.length > 0 && (
            <p className="text-xs text-teal-600 mt-2">{selectedMemberIds.length} selected</p>
          )}
        </div>
      )}

      {/* Config panel for fairest_custom */}
      {selected === 'fairest_custom' && (
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h4 className="text-sm font-semibold text-gray-900 mb-3">Enter Two Locations</h4>
          <div className="space-y-4">
            {[0, 1].map(i => (
              <div key={i}>
                <label className="text-xs text-gray-500 mb-1 block">
                  {i === 0 ? 'Point A' : 'Point B'}
                </label>
                <LocationInput
                  value={endpointSearches[i]}
                  onChange={(v) => setEndpointSearches(prev => {
                    const next = [...prev]; next[i] = v; return next;
                  })}
                  onSelect={(place) => handleEndpointSelect(i, place)}
                  onClear={() => {
                    setEndpointSearches(prev => { const n = [...prev]; n[i] = ''; return n; });
                    setEndpoints(prev => { const n = [...prev]; n[i] = null; return n; });
                  }}
                  placeholder={i === 0 ? 'First location...' : 'Second location...'}
                  variant="from"
                />
                {endpoints[i] && (
                  <p className="text-xs text-teal-600 mt-1">{endpoints[i].name}</p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {error && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">{error}</div>
      )}

      <button
        onClick={handleSave}
        disabled={saving}
        className="w-full py-2.5 bg-teal-600 text-white text-sm font-semibold rounded-lg hover:bg-teal-700 transition disabled:opacity-50"
      >
        {saving ? 'Saving...' : 'Save Location Strategy'}
      </button>
    </div>
  );
}
