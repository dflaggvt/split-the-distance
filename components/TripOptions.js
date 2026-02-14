'use client';

/**
 * TripOptions — Categorized trip options board (Lodging, POI, Food).
 * Members save places, vote on them, and the host can confirm options
 * to move them into the itinerary.
 */

import { useState } from 'react';
import { useTripContext } from './TripProvider';
import LocationInput from './LocationInput';
import {
  addTripOption,
  deleteTripOption,
  voteTripOption,
  removeOptionVote,
  addTripStop,
} from '@/lib/trips';

const CATEGORIES = [
  { id: 'lodging', label: 'Lodging', icon: '🏨', desc: 'Hotels, Airbnbs, campgrounds' },
  { id: 'poi', label: 'Points of Interest', icon: '🎡', desc: 'Attractions, activities, sights' },
  { id: 'food', label: 'Food & Drink', icon: '🍽️', desc: 'Restaurants, bars, cafes' },
];

export default function TripOptions() {
  const { trip, options, members, myMembership, permissions, tripId, refetchOptions, refetchStops } = useTripContext();
  const [activeCategory, setActiveCategory] = useState('lodging');
  const [showAdd, setShowAdd] = useState(false);
  const [searchValue, setSearchValue] = useState('');
  const [manualName, setManualName] = useState('');
  const [notes, setNotes] = useState('');
  const [url, setUrl] = useState('');
  const [adding, setAdding] = useState(false);
  const [addMode, setAddMode] = useState('search'); // 'search' | 'manual'

  const isCreator = myMembership?.role === 'creator';
  const canAdd = permissions.canAddOptions;
  const canVote = permissions.canVote;

  // Filter options by active category
  const categoryOptions = options.filter(o => o.category === activeCategory);

  // Get vote counts for an option
  const getVoteCounts = (option) => {
    const votes = option.trip_option_votes || [];
    return {
      up: votes.filter(v => v.vote === 'up').length,
      down: votes.filter(v => v.vote === 'down').length,
    };
  };

  // Get my vote for an option
  const getMyVote = (option) => {
    if (!myMembership) return null;
    const votes = option.trip_option_votes || [];
    return votes.find(v => v.member_id === myMembership.id)?.vote || null;
  };

  // Handle adding an option from search
  const handleSearchSelect = async (place) => {
    if (!place?.lat || !myMembership) return;
    setAdding(true);
    try {
      await addTripOption(tripId, myMembership.id, {
        category: activeCategory,
        name: place.name || place.formattedAddress || 'Unnamed',
        address: place.formattedAddress || place.name,
        lat: place.lat,
        lng: place.lng || place.lon,
        placeId: place.placeId || null,
        notes: notes.trim() || null,
        url: url.trim() || null,
      });
      setSearchValue('');
      setNotes('');
      setUrl('');
      setShowAdd(false);
      refetchOptions();
    } catch (err) {
      console.error('Failed to add option:', err);
    }
    setAdding(false);
  };

  // Handle adding a manual entry
  const handleManualAdd = async () => {
    if (!manualName.trim() || !myMembership) return;
    setAdding(true);
    try {
      await addTripOption(tripId, myMembership.id, {
        category: activeCategory,
        name: manualName.trim(),
        notes: notes.trim() || null,
        url: url.trim() || null,
      });
      setManualName('');
      setNotes('');
      setUrl('');
      setShowAdd(false);
      refetchOptions();
    } catch (err) {
      console.error('Failed to add option:', err);
    }
    setAdding(false);
  };

  // Handle voting
  const handleVote = async (optionId, vote) => {
    if (!myMembership) return;
    const option = options.find(o => o.id === optionId);
    if (!option) return;
    const myVote = getMyVote(option);
    try {
      if (myVote === vote) {
        await removeOptionVote(optionId, myMembership.id);
      } else {
        await voteTripOption(optionId, myMembership.id, vote);
      }
      refetchOptions();
    } catch (err) {
      console.error('Failed to vote:', err);
    }
  };

  // Handle delete
  const handleDelete = async (optionId) => {
    try {
      await deleteTripOption(optionId);
      refetchOptions();
    } catch (err) {
      console.error('Failed to delete option:', err);
    }
  };

  // Confirm option → add to itinerary
  const handleConfirmToItinerary = async (option) => {
    if (!myMembership) return;
    try {
      await addTripStop(tripId, myMembership.id, {
        name: option.name,
        address: option.address,
        lat: option.lat,
        lng: option.lng,
        placeId: option.place_id,
        category: option.category,
        notes: option.notes,
        dayNumber: 1,
        sortOrder: 999,
      });
      refetchStops();
    } catch (err) {
      console.error('Failed to add to itinerary:', err);
    }
  };

  return (
    <div className="space-y-4">
      {/* Category tabs */}
      <div className="flex gap-2">
        {CATEGORIES.map(cat => (
          <button
            key={cat.id}
            onClick={() => { setActiveCategory(cat.id); setShowAdd(false); }}
            className={`flex-1 py-2.5 px-3 rounded-xl text-sm font-medium border transition text-center ${
              activeCategory === cat.id
                ? 'bg-teal-50 border-teal-300 text-teal-700'
                : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'
            }`}
          >
            <span className="block text-lg mb-0.5">{cat.icon}</span>
            <span className="block text-xs">{cat.label}</span>
          </button>
        ))}
      </div>

      {/* Add option section */}
      {canAdd && (
        <div>
          {!showAdd ? (
            <button
              onClick={() => setShowAdd(true)}
              className="w-full py-2.5 bg-white border-2 border-dashed border-gray-300 rounded-xl text-sm text-gray-500 hover:border-teal-400 hover:text-teal-600 transition"
            >
              + Add {CATEGORIES.find(c => c.id === activeCategory)?.label || 'Option'}
            </button>
          ) : (
            <div className="bg-white rounded-xl border border-gray-200 p-4 space-y-3">
              {/* Toggle search vs manual */}
              <div className="flex gap-2">
                <button
                  onClick={() => setAddMode('search')}
                  className={`flex-1 py-1.5 text-xs font-medium rounded-lg border transition ${
                    addMode === 'search' ? 'bg-teal-50 border-teal-300 text-teal-700' : 'border-gray-200 text-gray-500'
                  }`}
                >
                  Search Places
                </button>
                <button
                  onClick={() => setAddMode('manual')}
                  className={`flex-1 py-1.5 text-xs font-medium rounded-lg border transition ${
                    addMode === 'manual' ? 'bg-teal-50 border-teal-300 text-teal-700' : 'border-gray-200 text-gray-500'
                  }`}
                >
                  Manual Entry
                </button>
              </div>

              {addMode === 'search' ? (
                <LocationInput
                  value={searchValue}
                  onChange={setSearchValue}
                  onSelect={handleSearchSelect}
                  onClear={() => setSearchValue('')}
                  placeholder={`Search for ${CATEGORIES.find(c => c.id === activeCategory)?.desc || 'a place'}...`}
                  variant="from"
                />
              ) : (
                <input
                  type="text"
                  value={manualName}
                  onChange={(e) => setManualName(e.target.value)}
                  placeholder="Name (e.g. Beach House on Airbnb)"
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
                />
              )}

              <input
                type="url"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="Link (optional — booking page, menu, etc.)"
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
              />

              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Notes (optional)"
                rows={2}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 resize-none"
              />

              <div className="flex gap-2">
                <button
                  onClick={() => { setShowAdd(false); setManualName(''); setSearchValue(''); setNotes(''); setUrl(''); }}
                  className="flex-1 py-2 text-sm text-gray-500 hover:text-gray-700 transition"
                >
                  Cancel
                </button>
                {addMode === 'manual' && (
                  <button
                    onClick={handleManualAdd}
                    disabled={adding || !manualName.trim()}
                    className="flex-1 py-2 bg-teal-600 text-white text-sm font-semibold rounded-lg hover:bg-teal-700 transition disabled:opacity-50"
                  >
                    {adding ? 'Adding...' : 'Add'}
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Upgrade prompt for free users */}
      {!canAdd && myMembership && (
        <div className="bg-gray-50 rounded-xl border border-gray-200 p-4 text-center">
          <p className="text-xs text-gray-500">Upgrade to Premium to add options.</p>
        </div>
      )}

      {/* Options list */}
      <div className="space-y-3">
        {categoryOptions.length === 0 ? (
          <div className="bg-white rounded-xl border border-gray-200 p-8 text-center">
            <div className="text-3xl mb-2">{CATEGORIES.find(c => c.id === activeCategory)?.icon}</div>
            <div className="text-gray-500 text-sm">
              No {CATEGORIES.find(c => c.id === activeCategory)?.label?.toLowerCase()} options yet.
              {canAdd && ' Add one above!'}
            </div>
          </div>
        ) : (
          categoryOptions.map(option => {
            const counts = getVoteCounts(option);
            const myVote = getMyVote(option);
            const addedBy = members.find(m => m.id === option.added_by);
            const canDelete = isCreator || (myMembership && option.added_by === myMembership.id);

            return (
              <div key={option.id} className="bg-white rounded-xl border border-gray-200 p-4">
                <div className="flex items-start gap-3">
                  {/* Vote buttons */}
                  {canVote && (
                    <div className="flex flex-col items-center gap-1 shrink-0">
                      <button
                        onClick={() => handleVote(option.id, 'up')}
                        className={`w-8 h-8 rounded-lg flex items-center justify-center text-sm transition ${
                          myVote === 'up'
                            ? 'bg-green-100 text-green-700'
                            : 'bg-gray-50 text-gray-400 hover:bg-green-50 hover:text-green-600'
                        }`}
                      >
                        ▲
                      </button>
                      <span className={`text-xs font-bold ${counts.up - counts.down > 0 ? 'text-green-600' : counts.up - counts.down < 0 ? 'text-red-500' : 'text-gray-400'}`}>
                        {counts.up - counts.down}
                      </span>
                      <button
                        onClick={() => handleVote(option.id, 'down')}
                        className={`w-8 h-8 rounded-lg flex items-center justify-center text-sm transition ${
                          myVote === 'down'
                            ? 'bg-red-100 text-red-700'
                            : 'bg-gray-50 text-gray-400 hover:bg-red-50 hover:text-red-600'
                        }`}
                      >
                        ▼
                      </button>
                    </div>
                  )}

                  {/* Option details */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between">
                      <div>
                        <h4 className="font-semibold text-gray-900 text-sm">{option.name}</h4>
                        {option.address && option.address !== option.name && (
                          <p className="text-xs text-gray-400 mt-0.5">{option.address}</p>
                        )}
                      </div>
                      <div className="flex items-center gap-1 shrink-0 ml-2">
                        {/* Add to itinerary (host only) */}
                        {isCreator && (
                          <button
                            onClick={() => handleConfirmToItinerary(option)}
                            className="px-2 py-1 text-xs bg-green-50 text-green-700 rounded-lg hover:bg-green-100 transition"
                            title="Add to itinerary"
                          >
                            + Itinerary
                          </button>
                        )}
                        {/* Delete */}
                        {canDelete && (
                          <button
                            onClick={() => handleDelete(option.id)}
                            className="px-1.5 py-1 text-xs text-gray-400 hover:text-red-500 transition"
                          >
                            ✕
                          </button>
                        )}
                      </div>
                    </div>

                    {option.notes && (
                      <p className="text-xs text-gray-500 mt-1">{option.notes}</p>
                    )}
                    {option.url && (
                      <a
                        href={option.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-teal-600 hover:text-teal-700 mt-1 inline-block"
                      >
                        View link →
                      </a>
                    )}
                    <p className="text-[10px] text-gray-300 mt-1.5">
                      Added by {addedBy?.display_name || 'Unknown'}
                    </p>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
