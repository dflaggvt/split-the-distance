'use client';

export default function PlaceCard({ place, isActive, onClick }) {
  return (
    <div
      onClick={() => onClick(place.id)}
      className={`flex items-start gap-3 p-3 rounded-md cursor-pointer transition-colors duration-200 ${
        isActive ? 'bg-teal-50' : 'hover:bg-gray-50'
      }`}
    >
      <div
        className={`w-9 h-9 rounded-md flex items-center justify-center text-lg shrink-0 ${
          isActive ? 'bg-teal-100' : 'bg-gray-100'
        }`}
      >
        {place.emoji}
      </div>

      <div className="flex-1 min-w-0">
        <div className="text-sm font-semibold text-gray-800 truncate">
          {place.name}
        </div>
        <div className="flex items-center gap-2 mt-0.5">
          <span className="text-xs text-gray-500">{place.categoryLabel}</span>
          <span className="text-xs text-teal-600 font-medium">
            {place.distanceFormatted}
          </span>
        </div>
        {place.cuisine && (
          <div className="flex items-center gap-2 mt-0.5">
            <span className="text-xs text-gray-500">{place.cuisine}</span>
          </div>
        )}
      </div>
    </div>
  );
}
