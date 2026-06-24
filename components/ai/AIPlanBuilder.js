'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useAuth } from '@/components/AuthProvider';
import { useFeature, useFeatures } from '@/components/FeatureProvider';
import { AI_PLAN_VIBES, askAIPlanAssistant, buildPlanShareText, generateAIPlan, getAIVibeLabel } from '@/lib/aiPlans';
import { logSessionEvent } from '@/lib/sessionEvents';

const STARTER_PROMPTS = [
  {
    label: 'What can Ask Maps help me with today?',
    question: 'What can you help me decide about this midpoint?',
    action: 'ask',
  },
  {
    label: 'Create a practical meetup plan',
    vibe: 'coffee',
    action: 'generate',
  },
  {
    label: 'Which option is best overall?',
    action: 'ask',
  },
  {
    label: 'Find a safe public meetup spot',
    question: 'Find a safe public place to meet from these results.',
    action: 'ask',
  },
  {
    label: 'Good coffee shops near the midpoint',
    question: 'Which coffee shops near the midpoint are the best options?',
    action: 'ask',
  },
];

function getRouteDistanceMiles(route) {
  const meters = route?.legs?.[0]?.distance?.value || route?.distance?.value || route?.distanceMeters;
  if (!meters) return null;
  return Math.round((meters / 1609.344) * 10) / 10;
}

function getRouteDurationSeconds(route) {
  return route?.legs?.[0]?.duration?.value || route?.duration?.value || route?.durationSeconds || null;
}

function buildDirectionsUrl(place) {
  const destination = place?.lat && place?.lon
    ? `${place.lat},${place.lon}`
    : encodeURIComponent(place?.address || place?.name || '');
  return `https://www.google.com/maps/dir/?api=1&destination=${destination}`;
}

function MenuIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M4 7h16M4 12h16M4 17h16" strokeLinecap="round" />
    </svg>
  );
}

function HistoryIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M3 12a9 9 0 1 0 3-6.7" strokeLinecap="round" />
      <path d="M3 4v6h6M12 7v5l3 2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="m6 6 12 12M18 6 6 18" strokeLinecap="round" />
    </svg>
  );
}

function ArrowUpIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M12 19V5M5 12l7-7 7 7" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export default function AIPlanBuilder({
  route,
  midpoint,
  fromLocation,
  toLocation,
  places = [],
  activeFilters = [],
  travelMode,
  midpointMode,
  driftRadius,
  creditStatus,
  onClose,
  onViewSavedPlans,
}) {
  const { user, isLoggedIn } = useAuth();
  const { openSignIn, openPricingModal } = useFeatures();
  const feature = useFeature('ai_plan_builder');
  const [selectedVibe, setSelectedVibe] = useState('coffee');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [savedPlan, setSavedPlan] = useState(null);
  const [copied, setCopied] = useState(false);
  const [question, setQuestion] = useState('');
  const [messages, setMessages] = useState([]);
  const [answering, setAnswering] = useState(false);
  const viewedLoggedRef = useRef(false);

  const eligiblePlaces = useMemo(
    () => places
      .filter((place) => place?.id && place?.name)
      .slice(0, 18),
    [places]
  );

  const placeById = useMemo(() => {
    const map = new Map();
    for (const place of eligiblePlaces) {
      map.set(String(place.id), place);
    }
    return map;
  }, [eligiblePlaces]);

  const hasAccess = Boolean(creditStatus?.hasActiveSubscription || creditStatus?.credits > 0);
  const canGenerate = Boolean(route && midpoint && fromLocation && toLocation);

  useEffect(() => {
    if (!feature.enabled || feature.status === 'hidden' || !canGenerate || viewedLoggedRef.current) return;
    viewedLoggedRef.current = true;
    logSessionEvent('ai_plan_builder_viewed', {
      placeCount: eligiblePlaces.length,
      activeFilters,
      hasAccess,
    }, { userId: user?.id });
  }, [activeFilters, canGenerate, eligiblePlaces.length, feature.enabled, feature.status, hasAccess, user?.id]);

  if (!feature.enabled || feature.status === 'hidden' || !canGenerate) {
    return null;
  }

  const handleVibeSelect = (vibeId) => {
    setSelectedVibe(vibeId);
    logSessionEvent('ai_plan_vibe_selected', {
      vibe: vibeId,
      label: getAIVibeLabel(vibeId),
    }, { userId: user?.id });
  };

  const buildContextPayload = (extra = {}) => ({
    ...extra,
    route: {
      fromName: fromLocation.name,
      fromLat: fromLocation.lat,
      fromLng: fromLocation.lon,
      toName: toLocation.name,
      toLat: toLocation.lat,
      toLng: toLocation.lon,
      travelMode,
      midpointMode,
      distanceMiles: getRouteDistanceMiles(route),
      durationSeconds: getRouteDurationSeconds(route),
    },
    midpoint: {
      lat: midpoint.lat,
      lng: midpoint.lng || midpoint.lon,
    },
    driftRadius: driftRadius
      ? {
          minutes: driftRadius.minutes,
          radiusMiles: driftRadius.radiusMiles,
        }
      : null,
    places: eligiblePlaces.map((place) => ({
      id: place.id,
      name: place.name,
      category: place.category,
      categoryLabel: place.categoryLabel,
      address: place.address,
      rating: place.rating,
      userRatingsTotal: place.userRatingsTotal,
      openNow: place.openNow,
      closingTime: place.closingTime,
      distanceFormatted: place.distanceFormatted,
      priceLevel: place.priceLevel,
      lat: place.lat,
      lon: place.lon,
      brand: place.brand,
    })),
  });

  const requireAccess = () => {
    if (!isLoggedIn) {
      openSignIn({ mode: 'signup', context: 'ai_plan_builder' });
      return false;
    }

    if (!hasAccess) {
      openPricingModal({ context: 'ai_plan_builder' });
      return false;
    }

    return true;
  };

  const handleAsk = async (questionOverride = null) => {
    const nextQuestion = String(questionOverride ?? question).trim();
    if (!nextQuestion) return;

    setError('');
    setCopied(false);
    if (!requireAccess()) return;

    const userMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: nextQuestion,
    };
    const contextMessages = messages.map(({ role, content }) => ({ role, content }));
    setMessages((prev) => [...prev, userMessage]);
    setQuestion('');
    setAnswering(true);

    logSessionEvent('ai_plan_question_asked', {
      placeCount: eligiblePlaces.length,
      activeFilters,
    }, { userId: user?.id });

    try {
      const data = await askAIPlanAssistant(buildContextPayload({
        question: nextQuestion,
        messages: contextMessages,
      }));
      setMessages((prev) => [
        ...prev,
        {
          id: `assistant-${Date.now()}`,
          role: 'assistant',
          content: data.answer,
        },
      ]);
      logSessionEvent('ai_plan_question_answered', {
        placeCount: eligiblePlaces.length,
      }, { userId: user?.id });
    } catch (err) {
      if (err.status === 401) {
        openSignIn({ mode: 'signup', context: 'ai_plan_builder' });
        return;
      }
      if (err.status === 402 || err.reason === 'no_credits') {
        openPricingModal({ context: 'ai_plan_builder' });
        return;
      }
      setError(err.message || 'Could not answer that question. Please try again.');
      setMessages((prev) => prev.filter((message) => message.id !== userMessage.id));
      logSessionEvent('ai_plan_question_failed', {
        reason: err.reason || 'answer_failed',
        error: err.message,
      }, { userId: user?.id });
    } finally {
      setAnswering(false);
    }
  };

  const handleGenerate = async (vibeOverride = null) => {
    const nextVibe = typeof vibeOverride === 'string' ? vibeOverride : selectedVibe;

    if (nextVibe !== selectedVibe) {
      setSelectedVibe(nextVibe);
    }

    setError('');
    setCopied(false);

    logSessionEvent('ai_plan_generate_clicked', {
      vibe: nextVibe,
      placeCount: eligiblePlaces.length,
      activeFilters,
    }, { userId: user?.id });

    if (!requireAccess()) return;

    if (eligiblePlaces.length < 2) {
      setError('Select Food, Coffee, or another nearby category first so AI can build plans from real places.');
      return;
    }

    setLoading(true);
    try {
      const payload = buildContextPayload({
        vibe: nextVibe,
      });

      const data = await generateAIPlan(payload);
      setSavedPlan(data.plan);
      setMessages((prev) => [
        ...prev,
        {
          id: `assistant-plan-${Date.now()}`,
          role: 'assistant',
          content: `I built and saved a ${getAIVibeLabel(nextVibe).toLowerCase()} plan from the current midpoint results.`,
        },
      ]);
      logSessionEvent('ai_plan_generated', {
        vibe: nextVibe,
        planId: data.plan?.id,
        planCount: data.plan?.generated_plan?.plans?.length || 0,
      }, { userId: user?.id });
      logSessionEvent('ai_plan_saved', {
        vibe: nextVibe,
        planId: data.plan?.id,
      }, { userId: user?.id });
    } catch (err) {
      if (err.status === 401) {
        openSignIn({ mode: 'signup', context: 'ai_plan_builder' });
        return;
      }
      if (err.status === 402 || err.reason === 'no_credits') {
        openPricingModal({ context: 'ai_plan_builder' });
        return;
      }
      setError(err.message || 'Could not build an AI plan. Please try again.');
      logSessionEvent('ai_plan_failed', {
        vibe: nextVibe,
        reason: err.reason || 'generation_failed',
        error: err.message,
      }, { userId: user?.id });
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = async () => {
    if (!savedPlan) return;
    const text = buildPlanShareText(savedPlan);
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      logSessionEvent('ai_plan_copied', {
        planId: savedPlan.id,
        vibe: savedPlan.vibe,
      }, { userId: user?.id });
      setTimeout(() => setCopied(false), 2500);
    } catch {
      setError('Could not copy the plan.');
    }
  };

  const handleShare = async () => {
    if (!savedPlan) return;
    const text = buildPlanShareText(savedPlan);
    if (!navigator.share) {
      await handleCopy();
      return;
    }

    try {
      await navigator.share({
        title: 'Split The Distance meetup plan',
        text,
      });
      logSessionEvent('ai_plan_shared', {
        planId: savedPlan.id,
        vibe: savedPlan.vibe,
      }, { userId: user?.id });
    } catch {}
  };

  const generated = savedPlan?.generated_plan;
  const firstName = user?.user_metadata?.full_name?.split(' ')?.[0] || user?.email?.split('@')?.[0] || 'there';
  const hasConversation = messages.length > 0 || answering || Boolean(generated);

  return (
    <div className="flex h-full min-h-0 flex-col bg-[#f5fbfc] text-gray-900 max-md:min-h-[72vh]">
      <div className="shrink-0 px-5 pb-3 pt-5">
        <div className="flex items-center justify-between gap-4">
          <button
            type="button"
            className="flex h-11 w-11 items-center justify-center rounded-full text-gray-700 transition hover:bg-white"
            aria-label="AI menu"
          >
            <MenuIcon />
          </button>
          <h2 className="min-w-0 flex-1 text-center text-2xl font-medium tracking-normal text-gray-950">
            Ask Maps
          </h2>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onViewSavedPlans}
              className="flex h-11 w-11 items-center justify-center rounded-full text-gray-800 transition hover:bg-white"
              aria-label="View saved AI plans"
            >
              <HistoryIcon />
            </button>
            <button
              type="button"
              onClick={onClose}
              className="flex h-11 w-11 items-center justify-center rounded-full text-gray-800 transition hover:bg-white"
              aria-label="Close AI panel"
            >
              <CloseIcon />
            </button>
          </div>
        </div>
      </div>

      <div className={`min-h-0 flex-1 overflow-y-auto px-6 ${hasConversation ? 'pb-4 pt-2' : 'flex flex-col justify-center pb-8'}`}>
        {!hasConversation ? (
          <div className="-mt-8">
            <div className="text-center">
              <p className="text-3xl font-semibold tracking-normal text-blue-500">Hi, {firstName}</p>
              <p className="mt-2 text-2xl font-normal tracking-normal text-gray-700">
                Ask anything about this midpoint.
              </p>
            </div>
            <div className="mt-9 grid grid-cols-2 gap-3">
              {STARTER_PROMPTS.map((prompt, index) => (
                <button
                  key={prompt.label}
                  type="button"
                  onClick={() => {
                    if (prompt.action === 'generate') {
                      handleGenerate(prompt.vibe);
                      return;
                    }
                    handleAsk(prompt.question || prompt.label);
                  }}
                  className={`min-h-[78px] rounded-3xl bg-[#e9eef0] px-5 py-4 text-left text-base leading-snug text-gray-950 transition hover:bg-[#dde6e9] ${
                    index === STARTER_PROMPTS.length - 1 ? 'col-span-2 min-h-[64px]' : ''
                  }`}
                >
                  {prompt.label}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="space-y-4 pb-2">
            {messages.map((message) => (
              <div
                key={message.id}
                className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-[86%] rounded-3xl px-4 py-3 text-sm leading-relaxed shadow-sm ${
                    message.role === 'user'
                      ? 'bg-blue-500 text-white'
                      : 'bg-white text-gray-800'
                  }`}
                >
                  <p className="whitespace-pre-line">{message.content}</p>
                </div>
              </div>
            ))}
            {answering && (
              <div className="flex justify-start">
                <div className="rounded-3xl bg-white px-4 py-3 text-sm text-gray-500 shadow-sm">
                  Thinking...
                </div>
              </div>
            )}
            {error && (
              <div className="rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-600">
                {error}
              </div>
            )}
            {generated && (
              <div className="space-y-3 rounded-3xl bg-white p-4 shadow-sm">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="text-[11px] font-bold uppercase tracking-wide text-teal-700">
                      Saved AI plan
                    </div>
                    <p className="mt-1 text-sm text-gray-700">{generated.summary}</p>
                  </div>
                  {savedPlan && (
                    <span className="shrink-0 rounded-full border border-teal-100 bg-teal-50 px-2 py-1 text-[11px] font-semibold text-teal-700">
                      Saved
                    </span>
                  )}
                </div>
                {generated.plans.map((plan) => {
                  const place = placeById.get(plan.primaryPlaceId);
                  return (
                    <div key={`${savedPlan.id}-${plan.title}`} className="rounded-2xl border border-gray-100 bg-gray-50 p-3">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <h4 className="text-sm font-bold text-gray-900">{plan.title}</h4>
                          <p className="mt-1 text-sm font-semibold text-teal-700">{plan.primaryPlaceName}</p>
                        </div>
                        {place && (
                          <a
                            href={buildDirectionsUrl(place)}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="shrink-0 rounded-full border border-gray-200 bg-white px-3 py-1.5 text-[11px] font-semibold text-gray-600 hover:bg-gray-50"
                          >
                            Maps
                          </a>
                        )}
                      </div>
                      <p className="mt-2 text-xs text-gray-600">{plan.whyItWorks}</p>
                      <p className="mt-2 text-xs text-gray-500">{plan.driveFairnessNote}</p>
                      <p className="mt-1 text-xs text-gray-500">{plan.safetyOrPracticalNote}</p>
                      {plan.optionalSecondStopPlaceName && (
                        <p className="mt-2 text-xs text-gray-500">
                          Optional add-on: <span className="font-semibold text-gray-700">{plan.optionalSecondStopPlaceName}</span>
                        </p>
                      )}
                    </div>
                  );
                })}

                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={handleCopy}
                    className="rounded-full border border-gray-200 bg-white px-3 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50"
                  >
                    {copied ? 'Copied' : 'Copy Plan'}
                  </button>
                  <button
                    type="button"
                    onClick={handleShare}
                    className="rounded-full border border-teal-100 bg-teal-50 px-3 py-2 text-sm font-semibold text-teal-700 hover:bg-teal-100"
                  >
                    Share Plan
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {hasConversation && (
        <div className="shrink-0 px-5 pb-2">
          <div className="flex gap-2 overflow-x-auto pb-2">
            {AI_PLAN_VIBES.slice(0, 5).map((vibe) => (
              <button
                key={vibe.id}
                type="button"
                onClick={() => handleVibeSelect(vibe.id)}
                className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-semibold transition ${
                  selectedVibe === vibe.id
                    ? 'bg-blue-500 text-white'
                    : 'bg-white text-gray-600 shadow-sm hover:text-blue-600'
                }`}
              >
                {vibe.label}
              </button>
            ))}
            <button
              type="button"
              onClick={() => handleGenerate(selectedVibe)}
              disabled={loading}
              className="shrink-0 rounded-full bg-gray-900 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-gray-800 disabled:opacity-50"
            >
              {loading ? 'Creating...' : 'Create plan'}
            </button>
          </div>
        </div>
      )}

      <div className="shrink-0 px-5 pb-5 pt-2">
        {!hasConversation && error && (
          <div className="mb-3 rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-600">
            {error}
          </div>
        )}
        <form
          className="flex min-h-[92px] items-center gap-3 rounded-[2rem] border border-gray-100 bg-white px-5 py-4 shadow-[0_8px_24px_rgba(15,23,42,0.18)]"
          onSubmit={(event) => {
            event.preventDefault();
            handleAsk();
          }}
        >
          <input
            type="text"
            value={question}
            onChange={(event) => setQuestion(event.target.value)}
            placeholder="Ask a question"
            className="min-w-0 flex-1 border-0 bg-transparent text-lg text-gray-900 outline-none placeholder:text-gray-500"
          />
          <button
            type="submit"
            disabled={answering || loading || !question.trim()}
            className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-gray-200 text-gray-500 transition hover:bg-gray-300 hover:text-gray-700 disabled:cursor-not-allowed disabled:opacity-60"
            aria-label="Ask AI"
          >
            <ArrowUpIcon />
          </button>
        </form>
      </div>
    </div>
  );
}
