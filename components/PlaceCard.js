'use client';

import { trackEvent, logOutboundClick } from '@/lib/analytics';
import { useAuth } from './AuthProvider';
import { logUserEvent } from '@/lib/userEvents';

export default function PlaceCard({ place, isActive, onClick }) {
  const { user } = useAuth();
  const photoUrl = place.photoUrl || null;

  const handleDirectionsClick = (e) => {
    e.stopPropagation(); // Don't trigger card click
    
    // Open Google Maps directions — use lat/lng for precise location
    const destination = place.lat && place.lon
      ? `${place.lat},${place.lon}`
      : encodeURIComponent(place.address || place.name);
    const url = `https://www.google.com/maps/dir/?api=1&destination=${destination}`;
    
    // Log outbound click to Supabase
    logOutboundClick({
      clickType: 'place_directions',
      placeName: place.name,
      placeCategory: place.category,
      destinationUrl: url,
    });
    // Per-user event
    if (user?.id) {
      logUserEvent(user.id, 'outbound_click', {
        type: 'place_directions',
        placeName: place.name,
        category: place.category,
      });
    }
    
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  return (
    <div
      onClick={() => onClick(place.id)}
      className={`flex items-center gap-3 px-3.5 py-3 rounded-lg border cursor-pointer transition-all duration-200 ${
        isActive
          ? 'border-teal-300 bg-teal-50 shadow-sm'
          : 'border-gray-200 bg-white hover:border-gray-300 hover:shadow-sm'
      }`}
    >
      {/* Icon / Photo */}
      {photoUrl ? (
        <img
          src={photoUrl}
          alt={place.name}
          className="w-12 h-12 rounded-lg object-cover shrink-0"
        />
      ) : (
        <div
          className={`w-12 h-12 rounded-lg flex items-center justify-center text-2xl shrink-0 ${
            isActive ? 'bg-teal-100' : 'bg-gray-100'
          }`}
        >
          {place.emoji}
        </div>
      )}

      {/* Name + Category */}
      <div className="flex-1 min-w-0">
        <div className="text-[15px] font-bold text-gray-900 truncate leading-tight">
          {place.name}
        </div>
        <div className="text-[13px] text-gray-500 mt-0.5 truncate">
          {place.categoryLabel}
        </div>
      </div>

      {/* Right side: Open badge OR distance */}
      <div className="shrink-0 flex flex-col items-end gap-1">
        {place.openNow != null && (
          <span
            className={`text-xs font-semibold px-2 py-0.5 rounded ${
              place.openNow
                ? 'bg-green-600 text-white'
                : 'bg-red-100 text-red-600'
            }`}
          >
            {place.openNow ? 'Open' : 'Closed'}
          </span>
        )}
        {place.distanceFormatted && (
          <span className="text-[13px] text-gray-400 font-medium">
            {place.distanceFormatted}
          </span>
        )}
      </div>
    </div>
  );
}
