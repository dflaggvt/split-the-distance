'use client';

import { useFeatures } from './FeatureProvider';
import ComingSoonCard from './ComingSoonCard';

/**
 * ComingSoonSection — renders teaser cards for all coming_soon features.
 * Displayed in SearchPanel below results area.
 * Only shown when there are coming_soon features.
 */
export default function ComingSoonSection({ show = true }) {
  const { comingSoonFeatures } = useFeatures();

  if (!show || !comingSoonFeatures || comingSoonFeatures.length === 0) {
    return null;
  }

  return (
    <div className="mt-4 pt-4 border-t border-gray-100">
      <div className="flex items-center gap-2 mb-3">
        <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
          Coming Soon
        </span>
        <div className="flex-1 h-px bg-gray-100" />
      </div>

      <div className="flex flex-col gap-2">
        {comingSoonFeatures.map((feature) => (
          <ComingSoonCard
            key={feature.key}
            featureKey={feature.key}
            label={feature.label}
            description={feature.description}
            emoji={feature.emoji}
            tier={feature.tier}
          />
        ))}
      </div>
    </div>
  );
}
