'use client';

/**
 * TripActivities — Unified suggestions + schedule for trip planning.
 *
 * Replaces the separate TripOptions and TripItinerary components with a
 * single two-view experience:
 *
 *   Suggestions — collaborative brainstorming board with voting
 *   Schedule    — day-by-day itinerary keyed to the confirmed date range
 *
 * Flow: Suggest places → Vote → Add to Schedule
 */

import { useState, useCallback } from 'react';
import { format, parseISO, addDays, differenceInDays } from 'date-fns';
import { useTripContext } from './TripProvider';
import LocationInput from './LocationInput';
import {
  addTripOption,
  deleteTripOption,
  voteTripOption,
  removeOptionVote,
  addTripStop,
  updateTripStop,
  deleteTripStop,
} from '@/lib/trips';
import { searchNearby, CATEGORIES as POI_CATEGORIES } from '@/lib/places';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const CATS = [
  { id: 'lodging', label: 'Stay', icon: '🏠', desc: 'Hotels, Airbnbs, campgrounds' },
  { id: 'poi', label: 'Do', icon: '🎯', desc: 'Attractions, activities, sights' },
  { id: 'food', label: 'Eat', icon: '🍽️', desc: 'Restaurants, bars, cafes' },
];

const CAT_MAP = Object.fromEntries(CATS.map(c => [c.id, c]));

const STOP_STATUS = {
  planned: { label: 'Planned', cls: 'bg-blue-100 text-blue-700' },
  confirmed: { label: 'Confirmed', cls: 'bg-green-100 text-green-700' },
  skipped: { label: 'Skipped', cls: 'bg-gray-100 text-gray-500' },
  completed: { label: 'Done', cls: 'bg-teal-100 text-teal-700' },
};

const POI_OPTS = Object.entries(POI_CATEGORIES).map(([key, val]) => ({
  key,
  label: val.chipLabel,
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Compute labelled trip days from confirmed date + matching date option range. */
function computeTripDays(trip, dateOptions) {
  if (!trip?.confirmed_date) return [];
  const startStr = trip.confirmed_date.split('T')[0];
  const start = parseISO(startStr);
  const match = dateOptions.find(o => o.date_start === startStr);
  const end =
    match?.date_end && match.date_end !== startStr
      ? parseISO(match.date_end)
      : start;
  const n = differenceInDays(end, start) + 1;
  return Array.from({ length: n }, (_, i) => ({
    number: i + 1,
    date: addDays(start, i),
    label: format(addDays(start, i), 'EEE, MMM d'),
  }));
}

/** Check if a suggestion has a matching stop in the schedule. */
function optionIsScheduled(option, stops) {
  return stops.some(
    (s) =>
      (s.place_id && s.place_id === option.place_id) ||
      (s.name === option.name &&
        s.lat != null &&
        option.lat != null &&
        Math.abs(s.lat - option.lat) < 0.001),
  );
}

// ===========================================================================
// Suggestions View
// ===========================================================================

function SuggestionsView({ tripDays, onSwitchToSchedule }) {
  const {
    trip,
    options,
    stops,
    members,
    locations,
    myMembership,
    permissions,
    tripId,
    refetchOptions,
    refetchStops,
  } = useTripContext();

  const [activeCat, setActiveCat] = useState('lodging');
  const [showAdd, setShowAdd] = useState(false);
  const [addMode, setAddMode] = useState('search');
  const [searchValue, setSearchValue] = useState('');
  const [manualName, setManualName] = useState('');
  const [notes, setNotes] = useState('');
  const [url, setUrl] = useState('');
  const [adding, setAdding] = useState(false);
  const [schedulingId, setSchedulingId] = useState(null);

  // POI discovery state
  const [showDiscover, setShowDiscover] = useState(false);
  const [poiCats, setPoiCats] = useState(['restaurant', 'cafe']);
  const [poiResults, setPoiResults] = useState([]);
  const [searchingPoi, setSearchingPoi] = useState(false);

  const isCreator = myMembership?.role === 'creator';
  const canAdd = permissions.canAddOptions;
  const canVote = permissions.canVote;
  const confirmedLoc = locations?.find(l => l.id === trip?.confirmed_location_id);

  const catOptions = options.filter(o => o.category === activeCat);

  // ---- Voting helpers ----
  const getMyVote = (opt) => {
    if (!myMembership) return null;
    return (opt.trip_option_votes || []).find(v => v.member_id === myMembership.id)?.vote || null;
  };

  const getScore = (opt) => {
    const votes = opt.trip_option_votes || [];
    return votes.filter(v => v.vote === 'up').length - votes.filter(v => v.vote === 'down').length;
  };

  const handleVote = async (optionId, vote) => {
    if (!myMembership) return;
    const opt = options.find(o => o.id === optionId);
    if (!opt) return;
    try {
      if (getMyVote(opt) === vote) {
        await removeOptionVote(optionId, myMembership.id);
      } else {
        await voteTripOption(optionId, myMembership.id, vote);
      }
      refetchOptions();
    } catch (err) {
      console.error('Vote failed:', err);
    }
  };

  // ---- Add suggestion ----
  const handleSearchSelect = async (place) => {
    if (!place?.lat || !myMembership) return;
    setAdding(true);
    try {
      await addTripOption(tripId, myMembership.id, {
        category: activeCat,
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
      console.error('Add failed:', err);
    }
    setAdding(false);
  };

  const handleManualAdd = async () => {
    if (!manualName.trim() || !myMembership) return;
    setAdding(true);
    try {
      await addTripOption(tripId, myMembership.id, {
        category: activeCat,
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
      console.error('Add failed:', err);
    }
    setAdding(false);
  };

  const handleDelete = async (id) => {
    try {
      await deleteTripOption(id);
      refetchOptions();
    } catch (err) {
      console.error('Delete failed:', err);
    }
  };

  // ---- Schedule a suggestion ----
  const handleSchedule = async (option, dayNumber) => {
    if (!myMembership) return;
    try {
      const dayStops = stops.filter(s => s.day_number === dayNumber);
      await addTripStop(tripId, myMembership.id, {
        name: option.name,
        address: option.address,
        lat: option.lat,
        lng: option.lng,
        placeId: option.place_id,
        category: option.category,
        notes: option.notes,
        dayNumber,
        sortOrder: dayStops.length,
      });
      setSchedulingId(null);
      refetchStops();
    } catch (err) {
      console.error('Schedule failed:', err);
    }
  };

  // ---- POI Discovery ----
  const handleDiscover = useCallback(async () => {
    if (!confirmedLoc) return;
    setSearchingPoi(true);
    try {
      const results = await searchNearby(
        { lat: confirmedLoc.lat, lon: confirmedLoc.lng },
        poiCats,
        8000,
      );
      setPoiResults(results);
    } catch (err) {
      console.error('Discovery failed:', err);
    }
    setSearchingPoi(false);
  }, [confirmedLoc, poiCats]);

  const handleAddPoi = async (poi) => {
    if (!myMembership) return;
    try {
      const cat = ['restaurant', 'cafe', 'fuel'].includes(poi.category)
        ? 'food'
        : poi.category === 'hotel'
          ? 'lodging'
          : 'poi';
      await addTripOption(tripId, myMembership.id, {
        category: cat,
        name: poi.name,
        address: poi.address,
        lat: poi.lat,
        lng: poi.lon,
        placeId: poi.placeId || null,
      });
      refetchOptions();
    } catch (err) {
      console.error('Add POI failed:', err);
    }
  };

  // ---- Day options for the schedule picker ----
  const dayChoices =
    tripDays.length > 0
      ? tripDays
      : [{ number: 1, date: null, label: 'Day 1' }];

  return (
    <div className="space-y-4">
      {/* Category tabs */}
      <div className="flex gap-2">
        {CATS.map(cat => (
          <button
            key={cat.id}
            onClick={() => {
              setActiveCat(cat.id);
              setShowAdd(false);
              setSchedulingId(null);
            }}
            className={`flex-1 py-2.5 px-3 rounded-xl text-sm font-medium border transition text-center ${
              activeCat === cat.id
                ? 'bg-teal-50 border-teal-300 text-teal-700'
                : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'
            }`}
          >
            <span className="block text-lg mb-0.5">{cat.icon}</span>
            <span className="block text-xs">{cat.label}</span>
          </button>
        ))}
      </div>

      {/* Add suggestion */}
      {canAdd && (
        <div>
          {!showAdd ? (
            <button
              onClick={() => setShowAdd(true)}
              className="w-full py-2.5 bg-white border-2 border-dashed border-gray-300 rounded-xl text-sm text-gray-500 hover:border-teal-400 hover:text-teal-600 transition"
            >
              + Add {CATS.find(c => c.id === activeCat)?.label || 'Suggestion'}
            </button>
          ) : (
            <div className="bg-white rounded-xl border border-gray-200 p-4 space-y-3">
              <div className="flex gap-2">
                <button
                  onClick={() => setAddMode('search')}
                  className={`flex-1 py-1.5 text-xs font-medium rounded-lg border transition ${
                    addMode === 'search'
                      ? 'bg-teal-50 border-teal-300 text-teal-700'
                      : 'border-gray-200 text-gray-500'
                  }`}
                >
                  Search Places
                </button>
                <button
                  onClick={() => setAddMode('manual')}
                  className={`flex-1 py-1.5 text-xs font-medium rounded-lg border transition ${
                    addMode === 'manual'
                      ? 'bg-teal-50 border-teal-300 text-teal-700'
                      : 'border-gray-200 text-gray-500'
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
                  placeholder={`Search for ${CATS.find(c => c.id === activeCat)?.desc || 'a place'}...`}
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
                  onClick={() => {
                    setShowAdd(false);
                    setManualName('');
                    setSearchValue('');
                    setNotes('');
                    setUrl('');
                  }}
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
          <p className="text-xs text-gray-500">Upgrade to Premium to add suggestions.</p>
        </div>
      )}

      {/* Suggestion cards */}
      <div className="space-y-3">
        {catOptions.length === 0 ? (
          <div className="bg-white rounded-xl border border-gray-200 p-8 text-center">
            <div className="text-3xl mb-2">
              {CATS.find(c => c.id === activeCat)?.icon}
            </div>
            <div className="text-gray-500 text-sm">
              No {CATS.find(c => c.id === activeCat)?.label?.toLowerCase()} suggestions yet.
              {canAdd && ' Add one above!'}
            </div>
          </div>
        ) : (
          catOptions.map(option => {
            const score = getScore(option);
            const myVote = getMyVote(option);
            const scheduled = optionIsScheduled(option, stops);
            const addedBy = members.find(m => m.id === option.added_by);
            const canDelete =
              isCreator || (myMembership && option.added_by === myMembership.id);
            const isScheduling = schedulingId === option.id;

            return (
              <div
                key={option.id}
                className={`bg-white rounded-xl border p-4 ${
                  scheduled ? 'border-green-200 bg-green-50/30' : 'border-gray-200'
                }`}
              >
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
                      <span
                        className={`text-xs font-bold ${
                          score > 0
                            ? 'text-green-600'
                            : score < 0
                              ? 'text-red-500'
                              : 'text-gray-400'
                        }`}
                      >
                        {score}
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
                        <div className="flex items-center gap-2">
                          <h4 className="font-semibold text-gray-900 text-sm">
                            {option.name}
                          </h4>
                          {scheduled && (
                            <span className="text-[10px] px-1.5 py-0.5 bg-green-100 text-green-700 rounded-full font-semibold">
                              Scheduled
                            </span>
                          )}
                        </div>
                        {option.address && option.address !== option.name && (
                          <p className="text-xs text-gray-400 mt-0.5">
                            {option.address}
                          </p>
                        )}
                      </div>
                      <div className="flex items-center gap-1 shrink-0 ml-2">
                        {/* Add to Schedule (host, not already scheduled) */}
                        {isCreator && !scheduled && (
                          <button
                            onClick={() =>
                              setSchedulingId(isScheduling ? null : option.id)
                            }
                            className={`px-2 py-1 text-xs font-medium rounded-lg transition ${
                              isScheduling
                                ? 'bg-teal-100 text-teal-700'
                                : 'bg-teal-50 text-teal-700 hover:bg-teal-100'
                            }`}
                          >
                            + Schedule
                          </button>
                        )}
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

                    {/* Day picker for scheduling */}
                    {isScheduling && (
                      <div className="mt-3 pt-3 border-t border-gray-100">
                        <p className="text-xs text-gray-500 mb-2 font-medium">
                          Which day?
                        </p>
                        <div className="flex flex-wrap gap-1.5">
                          {dayChoices.map(d => (
                            <button
                              key={d.number}
                              onClick={() => handleSchedule(option, d.number)}
                              className="px-2.5 py-1 text-xs font-medium bg-teal-600 text-white rounded-lg hover:bg-teal-700 transition"
                            >
                              {d.date ? d.label : `Day ${d.number}`}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* ---- Discover nearby ---- */}
      {confirmedLoc && canAdd && (
        <div>
          <button
            onClick={() => setShowDiscover(!showDiscover)}
            className="text-xs text-indigo-600 font-medium hover:text-indigo-700 transition"
          >
            {showDiscover ? '▼ Hide' : '▶ Discover'} near{' '}
            <strong>{confirmedLoc.name}</strong>
          </button>

          {showDiscover && (
            <div className="bg-white rounded-xl border border-gray-200 p-4 mt-2 space-y-3">
              <div className="flex flex-wrap gap-1.5">
                {POI_OPTS.map(cat => (
                  <button
                    key={cat.key}
                    onClick={() =>
                      setPoiCats(prev =>
                        prev.includes(cat.key)
                          ? prev.filter(c => c !== cat.key)
                          : [...prev, cat.key],
                      )
                    }
                    className={`px-2.5 py-1 text-xs font-medium rounded-full border transition ${
                      poiCats.includes(cat.key)
                        ? 'bg-teal-50 border-teal-300 text-teal-700'
                        : 'bg-gray-50 border-gray-200 text-gray-500 hover:bg-gray-100'
                    }`}
                  >
                    {cat.label}
                  </button>
                ))}
              </div>

              <button
                onClick={handleDiscover}
                disabled={searchingPoi || poiCats.length === 0}
                className="w-full py-2 bg-indigo-600 text-white text-xs font-semibold rounded-lg hover:bg-indigo-700 transition disabled:opacity-50"
              >
                {searchingPoi ? 'Searching...' : 'Search Nearby'}
              </button>

              {poiResults.length > 0 && (
                <div className="max-h-64 overflow-y-auto space-y-1.5">
                  {poiResults.map(poi => {
                    const alreadyAdded = options.some(
                      o =>
                        o.place_id === poi.placeId ||
                        (o.name === poi.name && o.lat === poi.lat),
                    );
                    return (
                      <div
                        key={poi.id}
                        className="flex items-center justify-between p-2 bg-gray-50 rounded-lg"
                      >
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5">
                            <span className="text-sm">{poi.emoji}</span>
                            <span className="text-xs font-medium text-gray-900 truncate">
                              {poi.name}
                            </span>
                          </div>
                          <div className="text-[11px] text-gray-400 truncate">
                            {poi.distanceFormatted} away
                            {poi.address && ` · ${poi.address}`}
                          </div>
                        </div>
                        <button
                          onClick={() => handleAddPoi(poi)}
                          disabled={alreadyAdded || !canAdd}
                          className={`shrink-0 ml-2 px-2.5 py-1 text-xs font-medium rounded-lg transition ${
                            alreadyAdded || !canAdd
                              ? 'bg-gray-100 text-gray-400 cursor-default'
                              : 'bg-teal-600 text-white hover:bg-teal-700'
                          }`}
                        >
                          {alreadyAdded ? 'Added' : '+ Add'}
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ===========================================================================
// Schedule View
// ===========================================================================

function ScheduleView({ tripDays, onSwitchToSuggestions }) {
  const {
    trip,
    stops,
    options,
    members,
    myMembership,
    permissions,
    tripId,
    refetchStops,
  } = useTripContext();

  const [selectedDay, setSelectedDay] = useState(1);
  const [searchValue, setSearchValue] = useState('');
  const [adding, setAdding] = useState(false);
  const [editingStop, setEditingStop] = useState(null);
  const [editNotes, setEditNotes] = useState('');

  const isCreator = myMembership?.role === 'creator';
  const canAddStops = permissions.canAddStops;
  const unscheduled = options.filter(o => !optionIsScheduled(o, stops));

  // Build day tabs
  const maxStopDay = stops.length > 0 ? Math.max(...stops.map(s => s.day_number)) : 0;
  const hasDateRange = tripDays.length > 0;

  let days;
  if (hasDateRange) {
    const maxDay = Math.max(tripDays.length, maxStopDay);
    days = Array.from({ length: maxDay }, (_, i) =>
      i < tripDays.length
        ? tripDays[i]
        : { number: i + 1, date: null, label: `Day ${i + 1}` },
    );
  } else {
    const numDays = Math.max(maxStopDay, selectedDay, 1);
    days = Array.from({ length: numDays }, (_, i) => ({
      number: i + 1,
      date: null,
      label: `Day ${i + 1}`,
    }));
  }

  const dayStops = stops
    .filter(s => s.day_number === selectedDay)
    .sort((a, b) => a.sort_order - b.sort_order);

  const selectedDayLabel = days.find(d => d.number === selectedDay)?.label || `Day ${selectedDay}`;

  // ---- Add stop ----
  const handleAddStop = async (place) => {
    if (!myMembership || !place?.lat) return;
    setAdding(true);
    try {
      await addTripStop(tripId, myMembership.id, {
        name: place.name || place.formattedAddress || 'Stop',
        address: place.formattedAddress || place.name,
        lat: place.lat,
        lng: place.lng || place.lon,
        placeId: place.placeId || null,
        dayNumber: selectedDay,
        sortOrder: dayStops.length,
      });
      setSearchValue('');
      refetchStops();
    } catch (err) {
      console.error('Add stop failed:', err);
    }
    setAdding(false);
  };

  const handleDelete = async (id) => {
    try {
      await deleteTripStop(id);
      refetchStops();
    } catch (err) {
      console.error('Delete failed:', err);
    }
  };

  const handleSaveNotes = async (stopId) => {
    try {
      await updateTripStop(stopId, { notes: editNotes.trim() || null });
      setEditingStop(null);
      setEditNotes('');
      refetchStops();
    } catch (err) {
      console.error('Update notes failed:', err);
    }
  };

  const handleStatus = async (stopId, status) => {
    try {
      await updateTripStop(stopId, { status });
      refetchStops();
    } catch (err) {
      console.error('Status update failed:', err);
    }
  };

  // No confirmed date and no stops -> prompt
  if (!trip?.confirmed_date && stops.length === 0) {
    return (
      <div className="space-y-4">
        <div className="bg-white rounded-xl border border-gray-200 p-8 text-center">
          <span className="text-3xl block mb-3">📅</span>
          <h3 className="font-semibold text-gray-900 mb-1">Confirm your dates first</h3>
          <p className="text-sm text-gray-500 max-w-sm mx-auto">
            Once dates are confirmed, your schedule will show day tabs labeled with the actual
            dates.
          </p>
        </div>

        {unscheduled.length > 0 && (
          <button
            onClick={onSwitchToSuggestions}
            className="w-full flex items-center gap-3 p-3 bg-amber-50 border border-amber-200 rounded-xl text-left hover:bg-amber-100 transition"
          >
            <span className="text-lg">💡</span>
            <span className="text-sm text-amber-800 flex-1">
              {unscheduled.length} suggestion{unscheduled.length !== 1 ? 's' : ''} waiting
            </span>
            <span className="text-xs font-semibold text-amber-600">View →</span>
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Unscheduled suggestions banner */}
      {unscheduled.length > 0 && (
        <button
          onClick={onSwitchToSuggestions}
          className="w-full flex items-center gap-3 p-3 bg-amber-50 border border-amber-200 rounded-xl text-left hover:bg-amber-100 transition"
        >
          <span className="text-lg">💡</span>
          <span className="text-sm text-amber-800 flex-1">
            {unscheduled.length} suggestion{unscheduled.length !== 1 ? 's' : ''} not yet
            scheduled
          </span>
          <span className="text-xs font-semibold text-amber-600">View →</span>
        </button>
      )}

      {/* Day tabs + add stop */}
      <div className="bg-white rounded-xl border border-gray-200 p-4">
        <div className="flex items-center gap-2 mb-3 overflow-x-auto pb-1">
          {days.map(d => (
            <button
              key={d.number}
              onClick={() => setSelectedDay(d.number)}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition whitespace-nowrap ${
                selectedDay === d.number
                  ? 'bg-teal-600 text-white'
                  : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
              }`}
            >
              {d.date ? d.label : `Day ${d.number}`}
            </button>
          ))}
          {/* Only allow adding days when no date range constrains us */}
          {!hasDateRange && (
            <button
              onClick={() => setSelectedDay(days.length + 1)}
              className="px-2 py-1.5 text-xs text-gray-400 hover:text-teal-600 transition whitespace-nowrap"
            >
              + Day
            </button>
          )}
        </div>

        {/* Search to add ad-hoc stop */}
        {canAddStops ? (
          <div className="relative">
            <LocationInput
              value={searchValue}
              onChange={setSearchValue}
              onSelect={handleAddStop}
              onClear={() => setSearchValue('')}
              placeholder={`Add a stop to ${selectedDayLabel}...`}
              variant="from"
            />
            {adding && (
              <div className="absolute right-3 top-1/2 -translate-y-1/2">
                <svg
                  className="animate-spin h-4 w-4 text-teal-600"
                  viewBox="0 0 24 24"
                >
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                    fill="none"
                  />
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                  />
                </svg>
              </div>
            )}
          </div>
        ) : (
          <div className="p-3 bg-gray-50 rounded-lg text-xs text-gray-500 text-center">
            Upgrade to Premium to add stops.
          </div>
        )}
      </div>

      {/* Stops for selected day */}
      {dayStops.length === 0 ? (
        <div className="bg-white rounded-xl border border-dashed border-gray-300 p-6 text-center">
          <p className="text-sm text-gray-400">
            No stops for {selectedDayLabel} yet. Search above or add from Suggestions.
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {dayStops.map((stop, idx) => {
            const badge = STOP_STATUS[stop.status] || STOP_STATUS.planned;
            const addedBy = members.find(m => m.id === stop.added_by);
            const catDef = stop.category ? CAT_MAP[stop.category] : null;
            const isEditing = editingStop === stop.id;
            const canDeleteStop =
              isCreator || (myMembership && stop.added_by === myMembership.id);

            return (
              <div key={stop.id} className="bg-white rounded-xl border border-gray-200 p-3">
                <div className="flex items-start gap-3">
                  {/* Number badge */}
                  <div className="w-7 h-7 rounded-full bg-teal-50 text-teal-700 flex items-center justify-center text-xs font-bold shrink-0 mt-0.5">
                    {idx + 1}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      {catDef && <span className="text-sm">{catDef.icon}</span>}
                      <span className="text-sm font-semibold text-gray-900 truncate">
                        {stop.name}
                      </span>
                      <span
                        className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full shrink-0 ${badge.cls}`}
                      >
                        {badge.label}
                      </span>
                    </div>
                    {stop.address && (
                      <div className="text-[11px] text-gray-400 truncate">{stop.address}</div>
                    )}
                    {stop.notes && !isEditing && (
                      <div className="text-xs text-gray-500 mt-1 italic">{stop.notes}</div>
                    )}
                    {stop.start_time && (
                      <div className="text-[11px] text-gray-400 mt-0.5">
                        {stop.start_time}
                        {stop.end_time ? ` – ${stop.end_time}` : ''}
                      </div>
                    )}
                    <div className="text-[11px] text-gray-300 mt-0.5">
                      Added by {addedBy?.display_name || 'Unknown'}
                    </div>

                    {/* Notes editor */}
                    {isEditing && (
                      <div className="mt-2 flex items-center gap-2">
                        <input
                          type="text"
                          value={editNotes}
                          onChange={(e) => setEditNotes(e.target.value)}
                          placeholder="Add a note..."
                          className="flex-1 px-2 py-1 text-xs border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-teal-500"
                          autoFocus
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') handleSaveNotes(stop.id);
                            if (e.key === 'Escape') {
                              setEditingStop(null);
                              setEditNotes('');
                            }
                          }}
                        />
                        <button
                          onClick={() => handleSaveNotes(stop.id)}
                          className="px-2 py-1 text-xs font-medium bg-teal-600 text-white rounded-lg hover:bg-teal-700"
                        >
                          Save
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-1 shrink-0">
                    <select
                      value={stop.status}
                      onChange={(e) => handleStatus(stop.id, e.target.value)}
                      className="text-[10px] px-1 py-0.5 bg-gray-50 border border-gray-200 rounded text-gray-600 cursor-pointer"
                    >
                      <option value="planned">Planned</option>
                      <option value="confirmed">Confirmed</option>
                      <option value="skipped">Skipped</option>
                      <option value="completed">Done</option>
                    </select>
                    <button
                      onClick={() => {
                        setEditingStop(isEditing ? null : stop.id);
                        setEditNotes(stop.notes || '');
                      }}
                      className="p-1 text-gray-400 hover:text-gray-600 transition"
                      title="Edit notes"
                    >
                      <svg
                        width="12"
                        height="12"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                        <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                      </svg>
                    </button>
                    {canDeleteStop && (
                      <button
                        onClick={() => handleDelete(stop.id)}
                        className="p-1 text-gray-400 hover:text-red-500 transition"
                        title="Remove stop"
                      >
                        ✕
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Global empty state when no stops at all */}
      {stops.length === 0 && trip?.confirmed_date && (
        <div className="bg-white rounded-xl border border-dashed border-gray-300 p-6 text-center">
          <div className="text-2xl mb-1">📋</div>
          <p className="text-sm text-gray-500 mb-1">
            No stops yet. Search above or head to Suggestions to browse and vote on places.
          </p>
        </div>
      )}
    </div>
  );
}

// ===========================================================================
// Main export
// ===========================================================================

export default function TripActivities() {
  const { trip, options, stops, dateOptions } = useTripContext();

  // Default to schedule if stops exist and no suggestions, otherwise suggestions
  const [view, setView] = useState(() =>
    stops.length > 0 && options.length === 0 ? 'schedule' : 'suggestions',
  );

  const tripDays = computeTripDays(trip, dateOptions);

  return (
    <div>
      {/* View toggle */}
      <div className="flex gap-2 mb-5">
        <button
          onClick={() => setView('suggestions')}
          className={`flex-1 py-2.5 text-sm font-semibold rounded-xl border transition ${
            view === 'suggestions'
              ? 'bg-teal-50 border-teal-300 text-teal-700'
              : 'bg-white border-gray-200 text-gray-500 hover:bg-gray-50'
          }`}
        >
          💡 Suggestions
          {options.length > 0 && (
            <span className="ml-1.5 text-xs font-normal">({options.length})</span>
          )}
        </button>
        <button
          onClick={() => setView('schedule')}
          className={`flex-1 py-2.5 text-sm font-semibold rounded-xl border transition ${
            view === 'schedule'
              ? 'bg-teal-50 border-teal-300 text-teal-700'
              : 'bg-white border-gray-200 text-gray-500 hover:bg-gray-50'
          }`}
        >
          📅 Schedule
          {stops.length > 0 && (
            <span className="ml-1.5 text-xs font-normal">({stops.length} stops)</span>
          )}
        </button>
      </div>

      {view === 'suggestions' ? (
        <SuggestionsView
          tripDays={tripDays}
          onSwitchToSchedule={() => setView('schedule')}
        />
      ) : (
        <ScheduleView
          tripDays={tripDays}
          onSwitchToSuggestions={() => setView('suggestions')}
        />
      )}
    </div>
  );
}
