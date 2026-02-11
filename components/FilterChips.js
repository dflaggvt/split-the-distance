'use client';

import { CATEGORIES } from '@/lib/places';
import { trackEvent } from '@/lib/analytics';
import { useGatedAction } from './FeatureGate';

const CATEGORY_KEYS = [
  'restaurant',
  'cafe',
  'park',
  'activity',
  'fuel',
  'hotel',
];

export default function FilterChips({ activeFilters, onToggle, localOnly, onLocalOnlyToggle }) {
  const categoryGate = useGatedAction('category_filters');
  const localOnlyGate = useGatedAction('local_only');

  const handleToggle = (key) => {
    categoryGate.gate(() => {
      const isActive = activeFilters.includes(key);
      const cat = CATEGORIES[key];
      
      // Track filter toggle
      trackEvent('filter_toggle', {
        filter_name: key,
        filter_label: cat.chipLabel,
        filter_action: isActive ? 'off' : 'on',
      });
      
      onToggle(key);
    });
  };

  const handleLocalOnlyToggle = () => {
    localOnlyGate.gate(() => {
      trackEvent('filter_toggle', {
        filter_name: 'local_only',
        filter_label: 'Local Only',
        filter_action: localOnly ? 'off' : 'on',
      });
      onLocalOnlyToggle?.();
    });
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
              {!categoryGate.allowed && categoryGate.reason === 'login_required' && (
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="inline ml-1 opacity-50">
                  <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                  <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                </svg>
              )}
              {!categoryGate.allowed && categoryGate.reason === 'upgrade_required' && (
                <span className="ml-1 text-[9px] font-bold opacity-70">PRO</span>
              )}
            </button>
          );
        })}
        {/* Local Only Toggle — gated by feature flag (default: free tier, requires login) */}
        <button
          onClick={handleLocalOnlyToggle}
          className={`px-3 py-1.5 border-[1.5px] rounded-full text-[13px] font-medium cursor-pointer transition-all duration-200 whitespace-nowrap ${
            localOnly
              ? 'bg-amber-500 border-amber-500 text-white'
              : 'bg-white border-gray-200 text-gray-600 hover:border-amber-300 hover:bg-amber-50'
          }`}
        >
          ⭐ Local Only
          {!localOnlyGate.allowed && localOnlyGate.reason === 'login_required' && (
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="inline ml-1 opacity-50">
              <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
              <path d="M7 11V7a5 5 0 0 1 10 0v4" />
            </svg>
          )}
          {!localOnlyGate.allowed && localOnlyGate.reason === 'upgrade_required' && (
            <span className="ml-1 text-[9px] font-bold opacity-70">PRO</span>
          )}
        </button>
      </div>
    </div>
  );
}
