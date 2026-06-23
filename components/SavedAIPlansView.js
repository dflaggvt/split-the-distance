'use client';

import { useEffect, useState } from 'react';
import { useAuth } from './AuthProvider';
import { buildPlanShareText, deleteAIPlan, fetchAIPlans, getAIVibeLabel } from '@/lib/aiPlans';

export default function SavedAIPlansView() {
  const { isLoggedIn } = useAuth();
  const [plans, setPlans] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [copiedId, setCopiedId] = useState(null);
  const [deletingId, setDeletingId] = useState(null);

  useEffect(() => {
    if (!isLoggedIn) {
      setPlans([]);
      setLoading(false);
      setError('');
      return undefined;
    }

    let cancelled = false;
    setLoading(true);
    setError('');

    fetchAIPlans()
      .then((data) => {
        if (!cancelled) setPlans(data.plans || []);
      })
      .catch((err) => {
        if (!cancelled) setError(err.message || 'Could not load AI plans.');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [isLoggedIn]);

  const handleCopy = async (plan) => {
    try {
      await navigator.clipboard.writeText(buildPlanShareText(plan));
      setCopiedId(plan.id);
      setTimeout(() => setCopiedId(null), 2500);
    } catch {
      setError('Could not copy the plan.');
    }
  };

  const handleShare = async (plan) => {
    const text = buildPlanShareText(plan);
    if (!navigator.share) {
      await handleCopy(plan);
      return;
    }

    try {
      await navigator.share({
        title: 'Split The Distance meetup plan',
        text,
      });
    } catch {}
  };

  const handleDelete = async (planId) => {
    setDeletingId(planId);
    setError('');
    try {
      await deleteAIPlan(planId);
      setPlans((prev) => prev.filter((plan) => plan.id !== planId));
    } catch (err) {
      setError(err.message || 'Could not delete the plan.');
    } finally {
      setDeletingId(null);
    }
  };

  if (!isLoggedIn) {
    return (
      <div className="rounded-xl border border-gray-200 bg-gray-50 p-5 text-center">
        <h3 className="mb-1 text-sm font-bold text-gray-900">Sign in to see AI plans</h3>
        <p className="text-sm text-gray-500">
          AI plans are saved to your account after you build them.
        </p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <span className="inline-block h-5 w-5 animate-spin rounded-full border-2 border-gray-300 border-t-transparent" />
      </div>
    );
  }

  if (error) {
    return <p className="rounded-lg bg-red-50 px-3 py-2 text-center text-sm text-red-600">{error}</p>;
  }

  if (plans.length === 0) {
    return (
      <div className="rounded-xl border border-gray-200 bg-gray-50 p-5 text-center">
        <h3 className="mb-1 text-sm font-bold text-gray-900">No AI plans yet</h3>
        <p className="text-sm text-gray-500">
          Run a midpoint search, select a nearby category, and build an AI plan from the results.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {plans.map((plan) => {
        const generated = plan.generated_plan || {};
        const firstPlan = generated.plans?.[0];

        return (
          <div key={plan.id} className="rounded-xl border border-gray-200 bg-white p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="mb-1 text-[11px] font-bold uppercase tracking-wide text-teal-700">
                  {getAIVibeLabel(plan.vibe)}
                </div>
                <h3 className="truncate text-sm font-bold text-gray-900">
                  {plan.from_name} &rarr; {plan.to_name}
                </h3>
                <p className="mt-1 text-xs text-gray-500">
                  {new Date(plan.created_at).toLocaleDateString([], {
                    month: 'short',
                    day: 'numeric',
                    year: 'numeric',
                  })}
                </p>
              </div>
              <button
                type="button"
                onClick={() => handleDelete(plan.id)}
                disabled={deletingId === plan.id}
                className="shrink-0 text-xs font-semibold text-red-600 hover:text-red-700 disabled:opacity-50"
              >
                {deletingId === plan.id ? 'Deleting...' : 'Delete'}
              </button>
            </div>

            {generated.summary && (
              <p className="mt-3 text-sm text-gray-700">{generated.summary}</p>
            )}

            {firstPlan && (
              <div className="mt-3 rounded-lg border border-teal-100 bg-teal-50/60 p-3">
                <p className="text-sm font-semibold text-gray-900">{firstPlan.title}</p>
                <p className="mt-1 text-sm text-teal-700">{firstPlan.primaryPlaceName}</p>
                <p className="mt-2 text-xs text-gray-600">{firstPlan.whyItWorks}</p>
              </div>
            )}

            <div className="mt-3 grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => handleCopy(plan)}
                className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50"
              >
                {copiedId === plan.id ? 'Copied' : 'Copy'}
              </button>
              <button
                type="button"
                onClick={() => handleShare(plan)}
                className="rounded-lg border border-teal-100 bg-teal-50 px-3 py-2 text-sm font-semibold text-teal-700 hover:bg-teal-100"
              >
                Share
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
