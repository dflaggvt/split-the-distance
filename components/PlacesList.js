'use client';

import { useEffect, useRef } from 'react';
import PlaceCard from './PlaceCard';

export default function PlacesList({
  places,
  loading,
  activePlaceId,
  onPlaceClick,
  activeFilters = [],
}) {
  const listRef = useRef(null);

  // Scroll active card into view
  useEffect(() => {
    if (activePlaceId && listRef.current) {
      const activeCard = listRef.current.querySelector(
        `[data-place-id="${activePlaceId}"]`
      );
      if (activeCard) {
        activeCard.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }
    }
  }, [activePlaceId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center gap-2.5 py-8 px-4 text-sm text-gray-500">
        <span className="inline-block w-[18px] h-[18px] border-[2.5px] border-gray-200 border-t-teal-500 rounded-full animate-spin" />
        <span>Finding places near the midpoint...</span>
      </div>
    );
  }

  if (places.length === 0) {
    // Different message based on whether user has selected any categories
    if (activeFilters.length === 0) {
      return (
        <div className="py-8 px-4 text-center">
          <div className="text-3xl mb-2">👆</div>
          <div className="text-sm font-medium text-gray-600 mb-1">
            Select a category above
          </div>
          <div className="text-xs text-gray-400">
            Click on Food, Coffee, or other chips to see places near the midpoint
          </div>
        </div>
      );
    }
    return (
      <div className="py-6 px-4 text-center text-sm text-gray-400">
        No places found for the selected filters. Try a different category.
      </div>
    );
  }

  return (
    <div ref={listRef} className="flex flex-col gap-0.5">
      {places.map((place) => (
        <div key={place.id} data-place-id={place.id}>
          <PlaceCard
            place={place}
            isActive={place.id === activePlaceId}
            onClick={onPlaceClick}
          />
        </div>
      ))}
    </div>
  );
}
