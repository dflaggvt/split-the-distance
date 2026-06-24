'use client';

import { CATEGORIES } from '@/lib/places';
import { trackEvent } from '@/lib/analytics';
import { useGatedAction } from './FeatureGate';

const CATEGORY_KEYS = ['restaurant', 'cafe', 'park', 'activity', 'fuel', 'hotel'];

export default function FloatingCategoryChips({
  show,
  activeFilters,
  onToggle,
  localOnly,
  onLocalOnlyToggle,
  className = 'hidden md:block absolute left-[620px] right-4 top-5 z-[50] pointer-events-none',
}) {
  const categoryGate = useGatedAction('category_filters');
  const localOnlyGate = useGatedAction('local_only');

  if (!show) return null;

  const handleToggle = (key) => {
    categoryGate.gate(() => {
      const isActive = activeFilters.includes(key);
      const cat = CATEGORIES[key];
      trackEvent('map_filter_chip_toggle', {
        filter_name: key,
        filter_label: cat.chipLabel,
        filter_action: isActive ? 'off' : 'on',
      });
      onToggle(key);
    });
  };

  const handleLocalOnly = () => {
    localOnlyGate.gate(() => {
      trackEvent('map_filter_chip_toggle', {
        filter_name: 'local_only',
        filter_label: 'Local Only',
        filter_action: localOnly ? 'off' : 'on',
      });
      onLocalOnlyToggle?.();
    });
  };

  return (
    <div className={className}>
      <div className="flex max-w-full gap-2 overflow-x-auto pb-2 pointer-events-auto">
        {CATEGORY_KEYS.map((key) => {
          const cat = CATEGORIES[key];
          const isActive = activeFilters.includes(key);
          return (
            <button
              key={key}
              type="button"
              onClick={() => handleToggle(key)}
              className={`shrink-0 rounded-full border px-4 py-2 text-sm font-bold shadow-md shadow-gray-900/10 transition ${
                isActive
                  ? 'border-teal-600 bg-teal-600 text-white'
                  : 'border-gray-200 bg-white text-gray-700 hover:border-teal-200 hover:bg-teal-50 hover:text-teal-700'
              }`}
            >
              {cat.chipLabel}
            </button>
          );
        })}
        <button
          type="button"
          onClick={handleLocalOnly}
          className={`shrink-0 rounded-full border px-4 py-2 text-sm font-bold shadow-md shadow-gray-900/10 transition ${
            localOnly
              ? 'border-amber-500 bg-amber-500 text-white'
              : 'border-gray-200 bg-white text-gray-700 hover:border-amber-200 hover:bg-amber-50 hover:text-amber-700'
          }`}
        >
          Local Only
        </button>
      </div>
    </div>
  );
}
