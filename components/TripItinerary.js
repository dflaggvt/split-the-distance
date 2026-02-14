'use client';

/**
 * TripItinerary — Multi-stop itinerary builder with POI search and day-by-day view.
 * Phase 3 of Collaborative Group Trips.
 */

import { useState, useCallback } from 'react';
import { useTripContext } from './TripProvider';
import LocationInput from './LocationInput';
import {
  addTripStop,
  updateTripStop,
  deleteTripStop,
  sendSystemMessage,
} from '@/lib/trips';
import { searchNearby, CATEGORIES } from '@/lib/places';

const STATUS_BADGE = {
  planned: { label: 'Planned', className: 'bg-blue-100 text-blue-700' },
  confirmed: { label: 'Confirmed', className: 'bg-green-100 text-green-700' },
  skipped: { label: 'Skipped', className: 'bg-gray-100 text-gray-500 line-through' },
  completed: { label: 'Done', className: 'bg-teal-100 text-teal-700' },
};

const CATEGORY_OPTIONS = Object.entries(CATEGORIES).map(([key, val]) => ({
  key,
  label: val.chipLabel,
  emoji: val.emoji,
}));

export default function TripItinerary() {
  const { trip, stops, members, myMembership, tripId } = useTripContext();
  const [searchValue, setSearchValue] = useState('');
  const [adding, setAdding] = useState(false);
  const [selectedDay, setSelectedDay] = useState(1);
  const [showPoiSearch, setShowPoiSearch] = useState(false);
  const [poiResults, setPoiResults] = useState([]);
  const [searchingPoi, setSearchingPoi] = useState(false);
  const [selectedCategories, setSelectedCategories] = useState(['restaurant', 'cafe']);
  const [editingStop, setEditingStop] = useState(null);
  const [editNotes, setEditNotes] = useState('');

  const isCreator = myMembership?.role === 'creator';
  const confirmedLocation = trip?.confirmed_location_id
    ? { lat: trip.midpoint_lat, lng: trip.midpoint_lng }
    : null;

  // Group stops by day
  const maxDay = stops.length > 0 ? Math.max(...stops.map(s => s.day_number)) : 1;
  const days = Array.from({ length: Math.max(maxDay, selectedDay) }, (_, i) => i + 1);

  const stopsByDay = {};
  days.forEach(d => { stopsByDay[d] = stops.filter(s => s.day_number === d); });

  // ---- Add a stop from location search ----
  const handleAddFromSearch = async (place) => {
    if (!myMembership || !place?.lat) return;
    setAdding(true);
    try {
      const dayStops = stops.filter(s => s.day_number === selectedDay);
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
    } catch (err) {
      console.error('Failed to add stop:', err);
    }
    setAdding(false);
  };

  // ---- Add a stop from POI results ----
  const handleAddPoi = async (poi) => {
    if (!myMembership) return;
    try {
      const dayStops = stops.filter(s => s.day_number === selectedDay);
      await addTripStop(tripId, myMembership.id, {
        name: poi.name,
        address: poi.address,
        lat: poi.lat,
        lng: poi.lon,
        placeId: poi.placeId || null,
        category: poi.category,
        dayNumber: selectedDay,
        sortOrder: dayStops.length,
      });
    } catch (err) {
      console.error('Failed to add POI stop:', err);
    }
  };

  // ---- POI Search near confirmed location ----
  const handlePoiSearch = useCallback(async () => {
    if (!confirmedLocation && stops.length === 0) return;

    setSearchingPoi(true);
    try {
      // Use the confirmed trip location, or the first stop, or the trip midpoint
      const center = confirmedLocation
        || (stops[0]?.lat ? { lat: stops[0].lat, lon: stops[0].lng } : null)
        || (trip?.midpoint_lat ? { lat: trip.midpoint_lat, lon: trip.midpoint_lng } : null);

      if (!center) {
        setSearchingPoi(false);
        return;
      }

      const results = await searchNearby(
        { lat: center.lat, lon: center.lng || center.lon },
        selectedCategories,
        8000
      );
      setPoiResults(results);
    } catch (err) {
      console.error('Failed to search POIs:', err);
    }
    setSearchingPoi(false);
  }, [confirmedLocation, stops, trip, selectedCategories]);

  // ---- Delete a stop ----
  const handleDelete = async (stopId) => {
    try {
      await deleteTripStop(stopId);
    } catch (err) {
      console.error('Failed to delete stop:', err);
    }
  };

  // ---- Update stop notes ----
  const handleSaveNotes = async (stopId) => {
    try {
      await updateTripStop(stopId, { notes: editNotes.trim() || null });
      setEditingStop(null);
      setEditNotes('');
    } catch (err) {
      console.error('Failed to update notes:', err);
    }
  };

  // ---- Update stop status ----
  const handleStatusChange = async (stopId, status) => {
    try {
      await updateTripStop(stopId, { status });
    } catch (err) {
      console.error('Failed to update status:', err);
    }
  };

  // ---- Toggle category for POI search ----
  const toggleCategory = (key) => {
    setSelectedCategories(prev =>
      prev.includes(key) ? prev.filter(c => c !== key) : [...prev, key]
    );
  };

  return (
    <div>
      {/* Day selector + Add stop */}
      <div className="bg-white rounded-xl border border-gray-200 p-4 mb-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-semibold text-gray-900 text-sm">Itinerary</h3>
          <div className="flex items-center gap-2">
            {/* Day tabs */}
            {days.map(d => (
              <button
                key={d}
                onClick={() => setSelectedDay(d)}
                className={`px-3 py-1 text-xs font-semibold rounded-lg transition ${
                  selectedDay === d
                    ? 'bg-teal-600 text-white'
                    : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                }`}
              >
                Day {d}
              </button>
            ))}
            <button
              onClick={() => setSelectedDay(maxDay + 1)}
              className="px-2 py-1 text-xs text-gray-400 hover:text-teal-600 transition"
              title="Add a day"
            >
              + Day
            </button>
          </div>
        </div>

        {/* Add stop via search */}
        <div className="relative">
          <LocationInput
            value={searchValue}
            onChange={setSearchValue}
            onSelect={handleAddFromSearch}
            onClear={() => setSearchValue('')}
            placeholder={`Add a stop to Day ${selectedDay}...`}
            variant="from"
          />
          {adding && (
            <div className="absolute right-3 top-1/2 -translate-y-1/2">
              <svg className="animate-spin h-4 w-4 text-teal-600" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
            </div>
          )}
        </div>

        {/* POI Search toggle */}
        <button
          onClick={() => setShowPoiSearch(!showPoiSearch)}
          className="mt-2 text-xs text-indigo-600 font-medium hover:text-indigo-700 transition"
        >
          {showPoiSearch ? '▼ Hide nearby places' : '▶ Find nearby places'}
        </button>
      </div>

      {/* POI Search panel */}
      {showPoiSearch && (
        <div className="bg-white rounded-xl border border-gray-200 p-4 mb-4">
          <div className="flex flex-wrap gap-1.5 mb-3">
            {CATEGORY_OPTIONS.map(cat => (
              <button
                key={cat.key}
                onClick={() => toggleCategory(cat.key)}
                className={`px-2.5 py-1 text-xs font-medium rounded-full border transition ${
                  selectedCategories.includes(cat.key)
                    ? 'bg-teal-50 border-teal-300 text-teal-700'
                    : 'bg-gray-50 border-gray-200 text-gray-500 hover:bg-gray-100'
                }`}
              >
                {cat.label}
              </button>
            ))}
          </div>
          <button
            onClick={handlePoiSearch}
            disabled={searchingPoi || selectedCategories.length === 0}
            className="w-full py-2 bg-indigo-600 text-white text-xs font-semibold rounded-lg hover:bg-indigo-700 transition disabled:opacity-50"
          >
            {searchingPoi ? 'Searching...' : 'Search Nearby'}
          </button>

          {/* POI Results */}
          {poiResults.length > 0 && (
            <div className="mt-3 max-h-64 overflow-y-auto space-y-1.5">
              {poiResults.map(poi => {
                const alreadyAdded = stops.some(s => s.place_id === poi.placeId || (s.name === poi.name && s.lat === poi.lat));
                return (
                  <div key={poi.id} className="flex items-center justify-between p-2 bg-gray-50 rounded-lg">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="text-sm">{poi.emoji}</span>
                        <span className="text-xs font-medium text-gray-900 truncate">{poi.name}</span>
                      </div>
                      <div className="text-[11px] text-gray-400 truncate">
                        {poi.distanceFormatted} away
                        {poi.address && ` · ${poi.address}`}
                      </div>
                    </div>
                    <button
                      onClick={() => handleAddPoi(poi)}
                      disabled={alreadyAdded}
                      className={`shrink-0 ml-2 px-2.5 py-1 text-xs font-medium rounded-lg transition ${
                        alreadyAdded
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

      {/* Stops by day */}
      {days.map(day => {
        const dayStops = stopsByDay[day] || [];
        if (dayStops.length === 0 && day !== selectedDay) return null;

        return (
          <div key={day} className="mb-4">
            <div className="flex items-center gap-2 mb-2">
              <h3 className="text-sm font-semibold text-gray-700">Day {day}</h3>
              <span className="text-xs text-gray-400">{dayStops.length} stop{dayStops.length !== 1 ? 's' : ''}</span>
            </div>

            {dayStops.length === 0 ? (
              <div className="bg-white rounded-xl border border-dashed border-gray-300 p-6 text-center">
                <div className="text-2xl mb-1">📋</div>
                <p className="text-xs text-gray-400">No stops yet for Day {day}. Search or find nearby places above.</p>
              </div>
            ) : (
              <div className="space-y-2">
                {dayStops.map((stop, idx) => {
                  const badge = STATUS_BADGE[stop.status] || STATUS_BADGE.planned;
                  const addedBy = members.find(m => m.id === stop.added_by);
                  const catDef = stop.category ? CATEGORIES[stop.category] : null;
                  const isEditing = editingStop === stop.id;

                  return (
                    <div key={stop.id} className="bg-white rounded-xl border border-gray-200 p-3">
                      <div className="flex items-start gap-3">
                        {/* Number badge */}
                        <div className="w-7 h-7 rounded-full bg-teal-50 text-teal-700 flex items-center justify-center text-xs font-bold shrink-0 mt-0.5">
                          {idx + 1}
                        </div>

                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-0.5">
                            {catDef && <span className="text-sm">{catDef.emoji}</span>}
                            <span className="text-sm font-semibold text-gray-900 truncate">{stop.name}</span>
                            <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full shrink-0 ${badge.className}`}>
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
                              {stop.start_time}{stop.end_time ? ` – ${stop.end_time}` : ''}
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
                                  if (e.key === 'Escape') { setEditingStop(null); setEditNotes(''); }
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
                          {/* Status dropdown */}
                          <select
                            value={stop.status}
                            onChange={(e) => handleStatusChange(stop.id, e.target.value)}
                            className="text-[10px] px-1 py-0.5 bg-gray-50 border border-gray-200 rounded text-gray-600 cursor-pointer"
                          >
                            <option value="planned">Planned</option>
                            <option value="confirmed">Confirmed</option>
                            <option value="skipped">Skipped</option>
                            <option value="completed">Done</option>
                          </select>

                          {/* Edit notes */}
                          <button
                            onClick={() => {
                              setEditingStop(isEditing ? null : stop.id);
                              setEditNotes(stop.notes || '');
                            }}
                            className="p-1 text-gray-400 hover:text-gray-600 transition"
                            title="Edit notes"
                          >
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                            </svg>
                          </button>

                          {/* Delete */}
                          {(isCreator || (myMembership && stop.added_by === myMembership.id)) && (
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
          </div>
        );
      })}

      {stops.length === 0 && (
        <div className="bg-white rounded-xl border border-gray-200 p-8 text-center">
          <div className="text-3xl mb-2">📋</div>
          <div className="text-gray-500 text-sm mb-1">No stops in the itinerary yet.</div>
          <div className="text-gray-400 text-xs">
            Search for places or browse nearby POIs to build your trip itinerary.
          </div>
        </div>
      )}
    </div>
  );
}
