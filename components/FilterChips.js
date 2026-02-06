'use client';

import { CATEGORIES } from '@/lib/places';
import { trackEvent } from '@/lib/analytics';

const CATEGORY_KEYS = [
  'restaurant',
  'cafe',
  'park',
  'activity',
  'fuel',
  'hotel',
  'kids',
];

export default function FilterChips({ activeFilters, onToggle }) {
  const handleToggle = (key) => {
    const isActive = activeFilters.includes(key);
    const cat = CATEGORIES[key];
    
    // Track filter toggle
    trackEvent('filter_toggle', {
      filter_name: key,
      filter_label: cat.chipLabel,
      filter_action: isActive ? 'off' : 'on',
    });
    
    onToggle(key);
  };

  return (
    <div className="mb-3">
      <span className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
        Show nearby:
      </span>
      <div className="flex flex-wrap gap-1.5">
        {CATEGORY_KEYS.map((key) => {
          const cat = CATEGORIES[key];
          const isActive = activeFilters.includes(key);

          return (
            <button
              key={key}
              onClick={() => handleToggle(key)}
              className={`px-3 py-1.5 border-[1.5px] rounded-full text-[13px] font-medium cursor-pointer transition-all duration-200 whitespace-nowrap ${
                isActive
                  ? 'bg-teal-600 border-teal-600 text-white'
                  : 'bg-white border-gray-200 text-gray-600 hover:border-teal-300 hover:bg-teal-50'
              }`}
            >
              {cat.chipLabel}
            </button>
          );
        })}
      </div>
    </div>
  );
}
