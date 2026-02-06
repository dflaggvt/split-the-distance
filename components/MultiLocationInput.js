'use client';

import { useRef } from 'react';
import LocationInput from './LocationInput';

const MAX_LOCATIONS = 6;
const MIN_LOCATIONS = 2;

export default function MultiLocationInput({
  locations,
  onLocationChange,
  onLocationSelect,
  onLocationClear,
  onAddLocation,
  onRemoveLocation,
  onError,
}) {
  const inputRefs = useRef([]);

  const canAdd = locations.length < MAX_LOCATIONS;
  const canRemove = locations.length > MIN_LOCATIONS;

  return (
    <div className="flex flex-col gap-2">
      {locations.map((loc, index) => (
        <div key={index} className="flex items-center gap-2">
          <div className="flex-1">
            <LocationInput
              value={loc.value}
              onChange={(val) => onLocationChange(index, val)}
              onSelect={(selected) => onLocationSelect(index, selected)}
              onClear={() => onLocationClear(index)}
              onError={onError}
              placeholder={`Location ${index + 1}...`}
              variant={index}
              inputRef={(el) => (inputRefs.current[index] = el)}
              onEnter={() => {
                if (index < locations.length - 1) {
                  inputRefs.current[index + 1]?.focus();
                }
              }}
            />
          </div>
          {canRemove && (
            <button
              onClick={() => onRemoveLocation(index)}
              className="w-8 h-8 flex items-center justify-center rounded-full text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors"
              title="Remove location"
            >
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
              >
                <path d="M18 6L6 18M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>
      ))}

      {canAdd && (
        <button
          onClick={onAddLocation}
          className="flex items-center justify-center gap-2 py-2.5 px-4 border-2 border-dashed border-gray-200 rounded-lg text-sm font-medium text-gray-500 hover:border-teal-400 hover:text-teal-600 hover:bg-teal-50 transition-colors"
        >
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
          >
            <path d="M12 5v14M5 12h14" />
          </svg>
          Add Another Person
        </button>
      )}

      {locations.length > 2 && (
        <p className="text-xs text-gray-400 text-center mt-1">
          {locations.length} locations · Finding the fairest meeting point
        </p>
      )}
    </div>
  );
}
