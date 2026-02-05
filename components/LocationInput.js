'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import { searchLocations } from '@/lib/geocoding';
import { debounce } from '@/lib/utils';

export default function LocationInput({
  value,
  onChange,
  onSelect,
  onClear,
  placeholder,
  variant = 'from', // 'from' or 'to'
  onEnter,
  inputRef: externalRef,
}) {
  const [results, setResults] = useState([]);
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [highlightIndex, setHighlightIndex] = useState(-1);
  const [hasSelected, setHasSelected] = useState(false);
  const internalRef = useRef(null);
  const dropdownRef = useRef(null);
  const inputRef = externalRef || internalRef;

  // Debounced search
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const debouncedSearch = useCallback(
    debounce(async (query) => {
      if (query.length < 3) {
        setResults([]);
        setIsOpen(false);
        setIsLoading(false);
        return;
      }

      try {
        setIsLoading(true);
        setIsOpen(true);
        const data = await searchLocations(query);
        setResults(data);
        setHighlightIndex(-1);
        if (data.length === 0) {
          setIsOpen(false);
        }
      } catch (err) {
        console.error('Autocomplete error:', err);
        setResults([]);
        setIsOpen(false);
      } finally {
        setIsLoading(false);
      }
    }, 400),
    []
  );

  const handleInputChange = (e) => {
    const val = e.target.value;
    setHasSelected(false);
    onChange(val);
    debouncedSearch(val.trim());
  };

  const selectResult = (index) => {
    if (index < 0 || index >= results.length) return;
    const result = results[index];
    setHasSelected(true);
    onChange(result.name);
    setIsOpen(false);
    setResults([]);
    if (onSelect) onSelect(result);
  };

  const handleKeyDown = (e) => {
    if (isOpen && results.length > 0) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setHighlightIndex((prev) =>
          Math.min(prev + 1, results.length - 1)
        );
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setHighlightIndex((prev) => Math.max(prev - 1, 0));
      } else if (e.key === 'Enter') {
        e.preventDefault();
        if (highlightIndex >= 0) {
          selectResult(highlightIndex);
        } else if (results.length > 0) {
          selectResult(0);
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
    // Delay to allow click on dropdown items
    setTimeout(() => setIsOpen(false), 200);
  };

  const handleFocus = () => {
    if (results.length > 0 && !hasSelected) {
      setIsOpen(true);
    }
  };

  const handleClear = () => {
    onChange('');
    setResults([]);
    setIsOpen(false);
    setHasSelected(false);
    if (onClear) onClear();
    inputRef.current?.focus();
  };

  const iconBg =
    variant === 'from'
      ? 'bg-teal-600'
      : 'bg-orange-500';
  const iconLabel = variant === 'from' ? 'A' : 'B';

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
        aria-label={variant === 'from' ? 'Starting location' : 'Destination'}
        className="w-full h-12 border-2 border-gray-200 rounded-[10px] pl-[46px] pr-9 text-[15px] text-gray-800 bg-white outline-none transition-all duration-200 focus:border-teal-400 focus:shadow-[0_0_0_3px_rgba(13,148,136,0.1)] placeholder:text-gray-400"
      />

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
        <div
          ref={dropdownRef}
          className="absolute top-[calc(100%+4px)] left-0 right-0 bg-white border border-gray-200 rounded-[10px] shadow-lg z-[500] overflow-hidden max-h-[260px] overflow-y-auto"
        >
          {isLoading && results.length === 0 ? (
            <div className="flex items-center gap-2 px-3.5 py-3 text-[13px] text-gray-400">
              <span className="inline-block w-[18px] h-[18px] border-[2.5px] border-gray-200 border-t-teal-500 rounded-full animate-spin" />
              Searching...
            </div>
          ) : (
            results.map((result, i) => (
              <div
                key={`${result.lat}-${result.lon}-${i}`}
                onMouseDown={(e) => {
                  e.preventDefault();
                  selectResult(i);
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
                    {result.name}
                  </div>
                  {result.detail && (
                    <div className="text-xs text-gray-400 truncate">
                      {result.detail}
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
