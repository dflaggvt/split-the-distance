'use client';

import { useState } from 'react';

const SIGNUP_SLIDES = [
  {
    emoji: '🎉',
    title: 'Welcome to Split The Distance!',
    subtitle: 'Your account is ready. Here\'s what you can do now.',
    features: [
      { emoji: '👥', text: 'Search for 3 people — find the fairest meeting point for a group' },
      { emoji: '🎲', text: 'Midpoint Roulette — can\'t decide? Let us pick a random spot' },
      { emoji: '🕐', text: 'Search History — your last 10 searches saved automatically' },
      { emoji: '⭐', text: 'Local Only — filter out chains and discover local gems' },
    ],
  },
  {
    emoji: '🚀',
    title: 'Want even more?',
    subtitle: 'Premium unlocks the full experience for $4.99/mo.',
    features: [
      { emoji: '🎯', text: 'Drift Radius — see a fairness zone, not just a point' },
      { emoji: '👥', text: 'Group Search for 4-5 people' },
      { emoji: '🛣️', text: 'Road Trip Stops — plan stops along any route' },
      { emoji: '🎰', text: 'Unlimited Roulette and Search History' },
    ],
    cta: 'upgrade',
  },
];

const UPGRADE_SLIDES = [
  {
    emoji: '🎉',
    title: 'Welcome to Premium!',
    subtitle: 'You\'ve unlocked the full Split The Distance experience.',
    features: [
      { emoji: '🎯', text: 'Drift Radius — toggle it on next to the midpoint card to see your fairness zone' },
      { emoji: '👥', text: 'Group Search (4-5) — click "+ Add person" to add up to 5 locations' },
      { emoji: '🛣️', text: 'Road Trip Stops — look for "Plan Stops Along Route" on long routes (2+ hours)' },
    ],
  },
  {
    emoji: '💡',
    title: 'Tips & Tricks',
    subtitle: 'Get the most out of your premium features.',
    features: [
      { emoji: '🎰', text: 'Unlimited Roulette — roll as many times as you want, no daily limits' },
      { emoji: '📚', text: 'Unlimited History — all your searches are saved forever' },
      { emoji: '🔄', text: 'Combine features — use Drift Radius with Group Search for the ultimate fairness' },
    ],
  },
];

export default function WelcomeModal({ type = 'signup', onClose, onUpgrade }) {
  const [slideIndex, setSlideIndex] = useState(0);
  const slides = type === 'upgrade' ? UPGRADE_SLIDES : SIGNUP_SLIDES;
  const slide = slides[slideIndex];
  const isLast = slideIndex === slides.length - 1;

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />

      {/* Modal */}
      <div className="relative bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden animate-fadeInUp">
        {/* Colored top bar */}
        <div className={`h-1.5 ${type === 'upgrade' ? 'bg-gradient-to-r from-purple-500 to-purple-600' : 'bg-gradient-to-r from-teal-500 to-teal-600'}`} />

        <div className="p-6">
          {/* Close button */}
          <button
            onClick={onClose}
            className="absolute top-4 right-4 w-7 h-7 flex items-center justify-center rounded-full text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>

          {/* Header */}
          <div className="text-center mb-5">
            <span className="text-4xl">{slide.emoji}</span>
            <h2 className="text-lg font-bold text-gray-900 mt-2">{slide.title}</h2>
            <p className="text-sm text-gray-500 mt-1">{slide.subtitle}</p>
          </div>

          {/* Feature list */}
          <div className="space-y-3 mb-6">
            {slide.features.map((f, i) => (
              <div key={i} className="flex items-start gap-3 px-3 py-2.5 rounded-lg bg-gray-50">
                <span className="text-lg shrink-0">{f.emoji}</span>
                <p className="text-sm text-gray-700 leading-snug">{f.text}</p>
              </div>
            ))}
          </div>

          {/* Slide dots */}
          {slides.length > 1 && (
            <div className="flex items-center justify-center gap-1.5 mb-4">
              {slides.map((_, i) => (
                <button
                  key={i}
                  onClick={() => setSlideIndex(i)}
                  className={`w-2 h-2 rounded-full transition-all ${
                    i === slideIndex
                      ? (type === 'upgrade' ? 'bg-purple-500 w-5' : 'bg-teal-500 w-5')
                      : 'bg-gray-200'
                  }`}
                />
              ))}
            </div>
          )}

          {/* Actions */}
          <div className="flex flex-col gap-2">
            {isLast ? (
              <>
                {slide.cta === 'upgrade' && onUpgrade && (
                  <button
                    onClick={() => { onClose(); onUpgrade(); }}
                    className="w-full py-2.5 px-4 text-sm font-semibold text-white bg-gradient-to-r from-purple-600 to-purple-700 rounded-lg cursor-pointer transition-all hover:from-purple-700 hover:to-purple-800 shadow-sm"
                  >
                    See Premium Plans
                  </button>
                )}
                <button
                  onClick={onClose}
                  className={`w-full py-2.5 px-4 text-sm font-semibold rounded-lg cursor-pointer transition-colors ${
                    slide.cta === 'upgrade'
                      ? 'text-gray-500 bg-gray-100 hover:bg-gray-200'
                      : type === 'upgrade'
                        ? 'text-white bg-gradient-to-r from-purple-600 to-purple-700 hover:from-purple-700 hover:to-purple-800 shadow-sm'
                        : 'text-white bg-teal-600 hover:bg-teal-700 shadow-sm'
                  }`}
                >
                  {slide.cta === 'upgrade' ? 'Maybe Later' : 'Start Exploring'}
                </button>
              </>
            ) : (
              <button
                onClick={() => setSlideIndex(slideIndex + 1)}
                className={`w-full py-2.5 px-4 text-sm font-semibold text-white rounded-lg cursor-pointer transition-all shadow-sm ${
                  type === 'upgrade'
                    ? 'bg-gradient-to-r from-purple-600 to-purple-700 hover:from-purple-700 hover:to-purple-800'
                    : 'bg-teal-600 hover:bg-teal-700'
                }`}
              >
                Next
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
