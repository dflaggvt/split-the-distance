'use client';

import { useState, useRef, useCallback, useEffect } from 'react';

const API_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;

export default function LocationInput({
  value,
  onChange,
  onSelect,
  onClear,
  onError,
  placeholder,
  variant = 'from',
  onEnter,
  inputRef: externalRef,
}) {
  const [predictions, setPredictions] = useState([]);
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [highlightIndex, setHighlightIndex] = useState(-1);
  const [hasSelected, setHasSelected] = useState(false);
  const [isGeoLoading, setIsGeoLoading] = useState(false);
  const [geolocationSupported, setGeolocationSupported] = useState(false);

  const internalRef = useRef(null);
  const inputRef = externalRef || internalRef;
  const debounceTimer = useRef(null);

  // Check if geolocation is available (requires secure context)
  useEffect(() => {
    const isSecure =
      typeof window !== 'undefined' &&
      (window.location.protocol === 'https:' ||
        window.location.hostname === 'localhost' ||
        window.location.hostname === '127.0.0.1');
    setGeolocationSupported(isSecure && !!navigator?.geolocation);
  }, []);

  /**
   * Use the device GPS to get current location, then reverse geocode
   */
  const handleUseMyLocation = useCallback(async () => {
    if (isGeoLoading) return;
    setIsGeoLoading(true);

    try {
      // 1. Get coordinates
      const position = await new Promise((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 60000,
        });
      });

      const { latitude: lat, longitude: lng } = position.coords;

      // 2. Reverse geocode via Google Geocoding API
      const response = await fetch(
        `https://maps.googleapis.com/maps/api/geocode/json?latlng=${lat},${lng}&key=${API_KEY}`
      );

      if (!response.ok) {
        throw new Error('Geocoding request failed');
      }

      const data = await response.json();

      let formattedAddress = `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
      if (data.results && data.results.length > 0) {
        formattedAddress = data.results[0].formatted_address;
      }

      // 3. Update input and call onSelect
      setHasSelected(true);
      onChange(formattedAddress);
      setPredictions([]);
      setIsOpen(false);

      if (onSelect) {
        onSelect({
          name: formattedAddress,
          lat,
          lon: lng,
        });
      }
    } catch (err) {
      // Handle geolocation errors
      if (err?.code === 1) {
        onError?.('Location access denied. Please enable location in your browser settings.');
      } else if (err?.code === 2) {
        onError?.("Couldn't determine your location.");
      } else if (err?.code === 3) {
        onError?.('Location request timed out.');
      } else {
        onError?.("Couldn't determine your location.");
      }
    } finally {
      setIsGeoLoading(false);
    }
  }, [isGeoLoading, onChange, onSelect, onError]);

  /**
   * Fetch autocomplete predictions via Places API (New) REST endpoint
   */
  const fetchPredictions = useCallback(async (input) => {
    if (!input || input.length < 2) {
      setPredictions([]);
      setIsOpen(false);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setIsOpen(true);

    try {
      const response = await fetch(
        'https://places.googleapis.com/v1/places:autocomplete',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Goog-Api-Key': API_KEY,
          },
          body: JSON.stringify({ input }),
        }
      );

      if (!response.ok) {
        console.error('Autocomplete API error:', response.status);
        setPredictions([]);
        setIsOpen(false);
        setIsLoading(false);
        return;
      }

      const data = await response.json();
      const suggestions = (data.suggestions || [])
        .filter((s) => s.placePrediction)
        .map((s) => {
          const pp = s.placePrediction;
          return {
            placeId: pp.placeId,
            description: pp.text?.text || '',
            mainText: pp.structuredFormat?.mainText?.text || pp.text?.text || '',
            secondaryText: pp.structuredFormat?.secondaryText?.text || '',
          };
        });

      setPredictions(suggestions);
      setHighlightIndex(-1);
      if (suggestions.length === 0) setIsOpen(false);
    } catch (err) {
      console.error('Autocomplete fetch error:', err);
      setPredictions([]);
      setIsOpen(false);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const debouncedFetch = useCallback(
    (input) => {
      clearTimeout(debounceTimer.current);
      debounceTimer.current = setTimeout(() => fetchPredictions(input), 300);
    },
    [fetchPredictions]
  );

  /**
   * Get place details (lat/lng) via Places API (New) REST endpoint
   */
  const getPlaceDetails = useCallback(async (placeId) => {
    try {
      const response = await fetch(
        `https://places.googleapis.com/v1/places/${placeId}`,
        {
          method: 'GET',
          headers: {
            'X-Goog-Api-Key': API_KEY,
            'X-Goog-FieldMask': 'location,displayName,formattedAddress',
          },
        }
      );

      if (!response.ok) {
        console.error('Place details API error:', response.status);
        return null;
      }

      return await response.json();
    } catch (err) {
      console.error('Place details fetch error:', err);
      return null;
    }
  }, []);

  const selectPrediction = useCallback(
    async (prediction) => {
      if (!prediction) return;

      setHasSelected(true);
      onChange(prediction.description);
      setIsOpen(false);
      setPredictions([]);

      // Get place details for lat/lng
      const details = await getPlaceDetails(prediction.placeId);
      if (details?.location) {
        const result = {
          name: prediction.description,
          displayName: details.formattedAddress || prediction.description,
          lat: details.location.latitude,
          lon: details.location.longitude,
          placeId: prediction.placeId,
        };
        if (onSelect) onSelect(result);
      }
    },
    [onChange, onSelect, getPlaceDetails]
  );

  const handleInputChange = (e) => {
    const val = e.target.value;
    setHasSelected(false);
    onChange(val);
    debouncedFetch(val.trim());
  };

  const handleKeyDown = (e) => {
    if (isOpen && predictions.length > 0) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setHighlightIndex((prev) =>
          Math.min(prev + 1, predictions.length - 1)
        );
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setHighlightIndex((prev) => Math.max(prev - 1, 0));
      } else if (e.key === 'Enter') {
        e.preventDefault();
        if (highlightIndex >= 0) {
          selectPrediction(predictions[highlightIndex]);
        } else if (predictions.length > 0) {
          selectPrediction(predictions[0]);
        }
        return;
      } else if (e.key === 'Escape') {
        setIsOpen(false);
        return;
      }
    }

    if (e.key === 'Enter' && !isOpen && onEnter) {
      onEnter();
    }
  };

  const handleBlur = () => {
    setTimeout(() => setIsOpen(false), 200);
  };

  const handleFocus = () => {
    if (predictions.length > 0 && !hasSelected) {
      setIsOpen(true);
    }
  };

  const handleClear = () => {
    onChange('');
    setPredictions([]);
    setIsOpen(false);
    setHasSelected(false);
    if (onClear) onClear();
    inputRef.current?.focus();
  };

  // Support multiple variants: from (A), to (B), mid (C, D, E, F)
  const getIconStyle = () => {
    if (variant === 'from') return { bg: 'bg-teal-600', label: 'A' };
    if (variant === 'to') return { bg: 'bg-orange-500', label: 'B' };
    // For 'mid' or numbered variants
    if (typeof variant === 'number') {
      const labels = ['A', 'B', 'C', 'D', 'E', 'F'];
      return { bg: 'bg-purple-500', label: labels[variant] || String(variant + 1) };
    }
    return { bg: 'bg-purple-500', label: '•' };
  };
  const { bg: iconBg, label: iconLabel } = getIconStyle();

  return (
    <div className="relative w-full">
      {/* Icon */}
      <div
        className={`absolute left-3 top-1/2 -translate-y-1/2 w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-bold text-white z-[2] pointer-events-none ${iconBg}`}
      >
        {iconLabel}
      </div>

      {/* Input */}
      <input
        ref={inputRef}
        type="text"
        value={value}
        onChange={handleInputChange}
        onKeyDown={handleKeyDown}
        onBlur={handleBlur}
        onFocus={handleFocus}
        placeholder={placeholder}
        autoComplete="off"
        aria-label={
          variant === 'from' ? 'Starting location' : 'Destination'
        }
        className={`w-full h-12 border-2 border-gray-200 rounded-[10px] pl-[46px] text-[15px] text-gray-800 bg-white outline-none transition-all duration-200 focus:border-teal-400 focus:shadow-[0_0_0_3px_rgba(13,148,136,0.1)] placeholder:text-gray-400 ${
          value
            ? geolocationSupported
              ? 'pr-[4.25rem]'
              : 'pr-9'
            : geolocationSupported
              ? 'pr-10'
              : 'pr-9'
        }`}
      />

      {/* GPS / Use My Location button */}
      {geolocationSupported && (
        <button
          onClick={handleUseMyLocation}
          disabled={isGeoLoading}
          className={`absolute top-1/2 -translate-y-1/2 w-8 h-8 min-w-[44px] min-h-[44px] flex items-center justify-center rounded-full transition-all duration-200 ${
            value ? 'right-8' : 'right-1.5'
          } ${
            isGeoLoading
              ? 'text-teal-500 cursor-wait'
              : 'text-gray-400 cursor-pointer hover:bg-teal-50 hover:text-teal-600'
          }`}
          aria-label="Use my location"
          title="Use my location"
        >
          {isGeoLoading ? (
            <span className="inline-block w-[18px] h-[18px] border-[2.5px] border-gray-200 border-t-teal-500 rounded-full animate-spin" />
          ) : (
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <circle cx="12" cy="12" r="4" />
              <path d="M12 2v4M12 18v4M2 12h4M18 12h4" />
            </svg>
          )}
        </button>
      )}

      {/* Clear button */}
      {value && (
        <button
          onClick={handleClear}
          className="absolute right-2 top-1/2 -translate-y-1/2 w-7 h-7 flex items-center justify-center rounded-full text-gray-400 text-lg hover:bg-gray-100 hover:text-gray-600 transition-all duration-200"
          aria-label={`Clear ${variant === 'from' ? 'starting location' : 'destination'}`}
        >
          ×
        </button>
      )}

      {/* Dropdown */}
      {isOpen && (
        <div className="absolute top-[calc(100%+4px)] left-0 right-0 bg-white border border-gray-200 rounded-[10px] shadow-lg z-[500] overflow-hidden max-h-[260px] overflow-y-auto">
          {isLoading && predictions.length === 0 ? (
            <div className="flex items-center gap-2 px-3.5 py-3 text-[13px] text-gray-400">
              <span className="inline-block w-[18px] h-[18px] border-[2.5px] border-gray-200 border-t-teal-500 rounded-full animate-spin" />
              Searching...
            </div>
          ) : (
            predictions.map((prediction, i) => (
              <div
                key={prediction.placeId}
                onMouseDown={(e) => {
                  e.preventDefault();
                  selectPrediction(prediction);
                }}
                className={`flex items-start gap-2.5 px-3.5 py-2.5 cursor-pointer text-sm text-gray-700 border-b border-gray-100 last:border-b-0 transition-colors duration-200 ${
                  i === highlightIndex
                    ? 'bg-teal-50'
                    : 'hover:bg-teal-50'
                }`}
              >
                <span className="text-gray-400 text-sm mt-0.5 shrink-0">
                  📍
                </span>
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-gray-800 truncate">
                    {prediction.mainText || prediction.description}
                  </div>
                  {prediction.secondaryText && (
                    <div className="text-xs text-gray-400 truncate">
                      {prediction.secondaryText}
                    </div>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
