'use client';

import { trackEvent, logOutboundClick } from '@/lib/analytics';

export default function PlaceCard({ place, isActive, onClick }) {
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
    
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  return (
    <div
      onClick={() => onClick(place.id)}
      className={`flex items-start gap-3 p-3 rounded-md cursor-pointer transition-colors duration-200 ${
        isActive ? 'bg-teal-50' : 'hover:bg-gray-50'
      }`}
    >
      {/* Photo or emoji icon */}
      {photoUrl ? (
        <img
          src={photoUrl}
          alt={place.name}
          className="w-12 h-12 rounded-md object-cover shrink-0"
        />
      ) : (
        <div
          className={`w-9 h-9 rounded-md flex items-center justify-center text-lg shrink-0 ${
            isActive ? 'bg-teal-100' : 'bg-gray-100'
          }`}
        >
          {place.emoji}
        </div>
      )}

      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2">
          <div className="text-sm font-semibold text-gray-800 truncate">
            {place.name}
          </div>
          {/* Directions button */}
          <button
            onClick={handleDirectionsClick}
            title="Get directions"
            className="shrink-0 w-7 h-7 rounded-full bg-teal-50 text-teal-600 flex items-center justify-center hover:bg-teal-100 transition-colors"
          >
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M12 2L12 22M12 2L6 8M12 2L18 8" />
            </svg>
          </button>
        </div>

        <div className="flex items-center gap-2 mt-0.5 flex-wrap">
          <span className="text-xs text-gray-500">{place.categoryLabel}</span>
          <span className="text-xs text-teal-600 font-medium">
            {place.distanceFormatted}
          </span>
        </div>

        {/* Rating, price, open status */}
        <div className="flex items-center gap-2 mt-0.5 flex-wrap">
          {place.rating && (
            <span className="text-xs">
              <span className="text-amber-500">
                {'★'.repeat(Math.round(place.rating))}
              </span>{' '}
              <span className="text-gray-500">
                {place.rating.toFixed(1)}
              </span>
              {place.userRatingsTotal > 0 && (
                <span className="text-gray-400 ml-0.5">
                  ({place.userRatingsTotal})
                </span>
              )}
            </span>
          )}

          {place.priceLevel != null && place.priceLevel > 0 && (
            <span className="text-xs text-gray-500">
              {'$'.repeat(place.priceLevel)}
            </span>
          )}

          {place.openNow != null && (
            <span
              className={`text-xs font-medium ${
                place.openNow ? 'text-green-600' : 'text-red-500'
              }`}
            >
              {place.openNow ? 'Open' : 'Closed'}
            </span>
          )}
        </div>

        {place.address && (
          <div className="text-xs text-gray-400 truncate mt-0.5">
            {place.address}
          </div>
        )}
      </div>
    </div>
  );
}
