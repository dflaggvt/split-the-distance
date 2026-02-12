'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useAuth } from './AuthProvider';
import { useFeatures } from './FeatureProvider';
import { useGatedAction } from './FeatureGate';
import { searchNearby, CATEGORIES } from '@/lib/places';
import { trackEvent, logOutboundClick } from '@/lib/analytics';

const ALL_CATEGORY_KEYS = Object.keys(CATEGORIES);
const CATEGORY_EMOJIS = ALL_CATEGORY_KEYS.map(k => CATEGORIES[k].emoji);

// Shuffle interval speed (ms) for emoji cycling animation
const SHUFFLE_INTERVAL = 80;
const SHUFFLE_DURATION = 1500;

/**
 * Get daily roll count from localStorage (for logged-in free users).
 */
function getDailyRolls() {
  try {
    const stored = JSON.parse(localStorage.getItem('roulette_rolls') || '{}');
    const today = new Date().toISOString().split('T')[0];
    return stored.date === today ? stored.count : 0;
  } catch {
    return 0;
  }
}

/**
 * Increment daily roll count in localStorage.
 */
function incrementDailyRolls() {
  try {
    const today = new Date().toISOString().split('T')[0];
    const stored = JSON.parse(localStorage.getItem('roulette_rolls') || '{}');
    const count = stored.date === today ? stored.count + 1 : 1;
    localStorage.setItem('roulette_rolls', JSON.stringify({ date: today, count }));
    return count;
  } catch {
    return 1;
  }
}

export default function RouletteSection({ midpoint, onPlaceClick }) {
  const { isLoggedIn, plan } = useAuth();
  const { openSignIn, openPricingModal } = useFeatures();
  const unlimitedGate = useGatedAction('roulette_unlimited');
  const isUnlimited = unlimitedGate.allowed;

  // Determine max rolls
  const maxRolls = isUnlimited ? Infinity : (isLoggedIn ? 5 : 3);

  // State
  const [roulettePool, setRoulettePool] = useState([]); // non-chain places
  const [currentPick, setCurrentPick] = useState(null);
  const [previousPicks, setPreviousPicks] = useState(new Set());
  const [rollCount, setRollCount] = useState(() => (isLoggedIn ? getDailyRolls() : 0));
  const [phase, setPhase] = useState('idle'); // 'idle' | 'shuffling' | 'revealed'
  const [fetchingPool, setFetchingPool] = useState(false);
  const [shuffleEmoji, setShuffleEmoji] = useState(CATEGORY_EMOJIS[0]);
  const [error, setError] = useState(null);

  const shuffleTimerRef = useRef(null);
  const shuffleEndRef = useRef(null);
  const prevMidpointRef = useRef(null);

  // Reset when midpoint changes
  useEffect(() => {
    const mpKey = midpoint ? `${midpoint.lat.toFixed(4)},${midpoint.lon.toFixed(4)}` : null;
    if (mpKey !== prevMidpointRef.current) {
      prevMidpointRef.current = mpKey;
      setRoulettePool([]);
      setCurrentPick(null);
      setPreviousPicks(new Set());
      setPhase('idle');
      setError(null);
      // Only reset session roll count for anonymous users (their limit is per-search)
      if (!isLoggedIn) {
        setRollCount(0);
      }
    }
  }, [midpoint, isLoggedIn]);

  // Sync roll count from localStorage for logged-in users on mount
  useEffect(() => {
    if (isLoggedIn) {
      setRollCount(getDailyRolls());
    }
  }, [isLoggedIn]);

  // Cleanup timers
  useEffect(() => {
    return () => {
      if (shuffleTimerRef.current) clearInterval(shuffleTimerRef.current);
      if (shuffleEndRef.current) clearTimeout(shuffleEndRef.current);
    };
  }, []);

  // Fetch all categories for the roulette pool
  const fetchPool = useCallback(async () => {
    if (!midpoint) return [];
    setFetchingPool(true);
    setError(null);
    try {
      const allPlaces = await searchNearby(midpoint, ALL_CATEGORY_KEYS);
      // Filter out chains
      const localPlaces = allPlaces.filter(p => !p.brand);
      setRoulettePool(localPlaces);
      return localPlaces;
    } catch (err) {
      console.error('[Roulette] Fetch error:', err);
      setError('Could not load places. Try again.');
      return [];
    } finally {
      setFetchingPool(false);
    }
  }, [midpoint]);

  // Pick a random place from pool, avoiding previous picks
  const pickRandom = useCallback((pool) => {
    if (!pool || pool.length === 0) return null;

    // Filter out already-shown places
    let candidates = pool.filter(p => !previousPicks.has(p.id));

    // If all places have been shown, reset and allow re-picks
    if (candidates.length === 0) {
      setPreviousPicks(new Set());
      candidates = pool;
    }

    const idx = Math.floor(Math.random() * candidates.length);
    return candidates[idx];
  }, [previousPicks]);

  // Run the shuffle animation then reveal
  const startShuffle = useCallback((pool) => {
    setPhase('shuffling');

    // Start cycling emojis
    let emojiIdx = 0;
    shuffleTimerRef.current = setInterval(() => {
      emojiIdx = (emojiIdx + 1) % CATEGORY_EMOJIS.length;
      setShuffleEmoji(CATEGORY_EMOJIS[emojiIdx]);
    }, SHUFFLE_INTERVAL);

    // After SHUFFLE_DURATION, stop and reveal
    shuffleEndRef.current = setTimeout(() => {
      clearInterval(shuffleTimerRef.current);
      shuffleTimerRef.current = null;

      const pick = pickRandom(pool);
      if (!pick) {
        setPhase('idle');
        setError('No places found near this midpoint. Try a different route.');
        return;
      }

      setCurrentPick(pick);
      setPreviousPicks(prev => new Set(prev).add(pick.id));
      setPhase('revealed');

      // Highlight on map
      if (onPlaceClick) onPlaceClick(pick.id);

      // Track the roll
      trackEvent('roulette_spin', {
        place_name: pick.name,
        place_category: pick.category,
        roll_number: rollCount + 1,
      });
    }, SHUFFLE_DURATION);
  }, [pickRandom, onPlaceClick, rollCount]);

  // Handle "Surprise Me" or "Spin Again" tap
  const handleSpin = useCallback(async () => {
    // Check roll limit
    if (rollCount >= maxRolls) return;

    // Fetch pool if needed
    let pool = roulettePool;
    if (pool.length === 0) {
      pool = await fetchPool();
      if (!pool || pool.length === 0) {
        // fetchPool already sets error state for exceptions;
        // show a message when the pool is just empty (e.g. all chains or API issues)
        setError('No places found near this midpoint. Try a different route.');
        return;
      }
    }

    // Increment roll count only after we know we have places to show
    const newCount = rollCount + 1;
    setRollCount(newCount);
    if (isLoggedIn) {
      incrementDailyRolls();
    }

    startShuffle(pool);
  }, [rollCount, maxRolls, isLoggedIn, roulettePool, fetchPool, startShuffle]);

  // Directions click handler for revealed place
  const handleDirections = (e) => {
    e.stopPropagation();
    if (!currentPick) return;
    const destination = currentPick.lat && currentPick.lon
      ? `${currentPick.lat},${currentPick.lon}`
      : encodeURIComponent(currentPick.address || currentPick.name);
    const url = `https://www.google.com/maps/dir/?api=1&destination=${destination}`;
    logOutboundClick({
      clickType: 'roulette_directions',
      placeName: currentPick.name,
      placeCategory: currentPick.category,
      destinationUrl: url,
    });
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  const rollsRemaining = Math.max(0, maxRolls - rollCount);
  const isExhausted = rollCount >= maxRolls && !isUnlimited;

  // Don't render if no midpoint
  if (!midpoint) return null;

  return (
    <div className="mb-4">
      {/* ---- IDLE STATE: Surprise Me button ---- */}
      {phase === 'idle' && !currentPick && !fetchingPool && (
        <button
          onClick={handleSpin}
          className="w-full py-3.5 px-4 rounded-xl border-2 border-dashed border-amber-400 bg-amber-50/60 cursor-pointer transition-all duration-200 hover:border-amber-500 hover:bg-amber-100/60 hover:shadow-sm active:scale-[0.99] group"
        >
          <div className="flex items-center justify-center gap-2.5">
            <span className="text-xl group-hover:animate-bounce">🎲</span>
            <span className="text-[15px] font-bold text-gray-800">Can&apos;t decide? Surprise Me</span>
          </div>
        </button>
      )}

      {/* ---- SHUFFLING STATE: Emoji cycling animation ---- */}
      {phase === 'shuffling' && (
        <div className="w-full py-6 px-4 rounded-xl border-2 border-amber-300 bg-gradient-to-r from-amber-50 to-orange-50 text-center">
          <div className="text-5xl mb-2 animate-pulse">{shuffleEmoji}</div>
          <div className="text-sm font-semibold text-amber-700 animate-pulse">Finding your spot...</div>
        </div>
      )}

      {/* ---- REVEALED STATE: Place card + Spin Again ---- */}
      {phase === 'revealed' && currentPick && (
        <div className="rounded-xl border-2 border-amber-300 bg-gradient-to-r from-amber-50 to-orange-50 overflow-hidden">
          {/* Header */}
          <div className="px-4 pt-3 pb-1 flex items-center gap-2">
            <span className="text-lg">🎲</span>
            <span className="text-xs font-bold text-amber-700 uppercase tracking-wide">Your Spot</span>
            <span className="text-xs text-amber-500 ml-auto">Local spots only</span>
          </div>

          {/* Place info */}
          <div className="px-4 py-3">
            <div className="flex items-start gap-3">
              <div className="w-11 h-11 rounded-lg flex items-center justify-center text-xl bg-white shadow-sm shrink-0">
                {currentPick.emoji}
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-base font-bold text-gray-900 truncate">{currentPick.name}</div>
                <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                  <span className="text-xs text-gray-500">{currentPick.categoryLabel}</span>
                  <span className="text-xs text-teal-600 font-medium">{currentPick.distanceFormatted}</span>
                  {currentPick.openNow != null && (
                    <span className={`text-xs font-medium ${currentPick.openNow ? 'text-green-600' : 'text-red-500'}`}>
                      {currentPick.openNow ? 'Open' : 'Closed'}
                    </span>
                  )}
                </div>
                {currentPick.address && (
                  <div className="text-xs text-gray-400 truncate mt-1">{currentPick.address}</div>
                )}
              </div>
            </div>

            {/* Action buttons */}
            <div className="flex gap-2 mt-3">
              <button
                onClick={handleDirections}
                className="flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg text-sm font-medium bg-teal-600 text-white hover:bg-teal-700 transition-colors"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 2L12 22M12 2L6 8M12 2L18 8" />
                </svg>
                Directions
              </button>
              {currentPick.websiteUri && (
                <a
                  href={currentPick.websiteUri}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => logOutboundClick({ clickType: 'roulette_website', placeName: currentPick.name, destinationUrl: currentPick.websiteUri })}
                  className="flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg text-sm font-medium bg-white border border-gray-200 text-gray-700 hover:bg-gray-50 transition-colors"
                >
                  Website
                </a>
              )}
            </div>
          </div>

          {/* Spin Again / Exhausted */}
          <div className="px-4 pb-3 pt-1">
            {!isExhausted ? (
              <button
                onClick={handleSpin}
                className="w-full py-2.5 px-4 rounded-lg border border-amber-300 bg-white text-sm font-semibold text-amber-700 cursor-pointer transition-all hover:bg-amber-50 hover:border-amber-400 active:scale-[0.99]"
              >
                🎲 Spin Again
                {!isUnlimited && (
                  <span className="text-amber-500 font-normal ml-1.5">
                    ({rollsRemaining} {rollsRemaining === 1 ? 'roll' : 'rolls'} left)
                  </span>
                )}
              </button>
            ) : (
              <div className="text-center">
                {!isLoggedIn ? (
                  <button
                    onClick={() => openSignIn()}
                    className="w-full py-2.5 px-4 rounded-lg bg-teal-600 text-white text-sm font-semibold cursor-pointer transition-all hover:bg-teal-700"
                  >
                    Sign up for more rolls
                  </button>
                ) : (
                  <button
                    onClick={() => openPricingModal()}
                    className="w-full py-2.5 px-4 rounded-lg bg-gradient-to-r from-purple-600 to-purple-700 text-white text-sm font-semibold cursor-pointer transition-all hover:from-purple-500 hover:to-purple-600"
                  >
                    Upgrade for unlimited rolls
                  </button>
                )}
                <p className="text-[11px] text-gray-400 mt-1.5">
                  {!isLoggedIn
                    ? `${maxRolls} rolls per search. Sign up for ${5} per day.`
                    : `${maxRolls} rolls per day. Premium gets unlimited.`}
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ---- FETCHING OVERLAY ---- */}
      {fetchingPool && phase === 'idle' && (
        <div className="w-full py-4 px-4 rounded-xl border-2 border-amber-300 bg-gradient-to-r from-amber-50 to-orange-50 text-center">
          <span className="inline-block w-5 h-5 border-2 border-amber-400 border-t-transparent rounded-full animate-spin mb-1" />
          <div className="text-sm text-amber-700">Loading places...</div>
        </div>
      )}

      {/* ---- ERROR STATE ---- */}
      {error && phase === 'idle' && (
        <div className="w-full py-3 px-4 rounded-xl border border-red-200 bg-red-50 text-center">
          <p className="text-sm text-red-600">{error}</p>
          <button
            onClick={() => { setError(null); }}
            className="text-xs text-red-400 mt-1 hover:text-red-600 underline"
          >
            Dismiss
          </button>
        </div>
      )}
    </div>
  );
}
