import { getSession } from './auth';

export const AI_PLAN_VIBES = [
  { id: 'coffee', label: 'Coffee' },
  { id: 'lunch', label: 'Lunch' },
  { id: 'kid_friendly', label: 'Kid-friendly' },
  { id: 'quiet_talk', label: 'Quiet place to talk' },
  { id: 'safe_public', label: 'Safe public meetup' },
  { id: 'dinner_activity', label: 'Dinner + activity' },
  { id: 'road_trip_break', label: 'Road trip break' },
  { id: 'quick_handoff', label: 'Quick handoff' },
];

export function getAIVibeLabel(vibeId) {
  return AI_PLAN_VIBES.find((vibe) => vibe.id === vibeId)?.label || vibeId;
}

async function authFetch(url, options = {}) {
  const session = await getSession();
  if (!session?.access_token) {
    const err = new Error('Please sign in first.');
    err.status = 401;
    throw err;
  }

  const res = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${session.access_token}`,
      ...(options.headers || {}),
    },
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(data.error || 'Request failed.');
    err.status = res.status;
    err.reason = data.reason;
    err.detail = data.detail;
    throw err;
  }

  return data;
}

export async function generateAIPlan(payload) {
  return authFetch('/api/ai/meetup-plan', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function fetchAIPlans() {
  return authFetch('/api/ai/meetup-plans');
}

export async function deleteAIPlan(id) {
  return authFetch(`/api/ai/meetup-plans/${id}`, {
    method: 'DELETE',
  });
}

export function buildPlanShareText(planRow) {
  const plan = planRow?.generated_plan || planRow;
  const plans = Array.isArray(plan?.plans) ? plan.plans : [];
  const lines = [];

  if (plan?.summary) {
    lines.push(plan.summary);
  }

  for (const item of plans) {
    lines.push('');
    lines.push(`${item.title}: ${item.primaryPlaceName}`);
    if (item.whyItWorks) lines.push(item.whyItWorks);
    if (item.shareText) lines.push(item.shareText);
  }

  return lines.filter(Boolean).join('\n');
}
