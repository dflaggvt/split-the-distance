import { getSession } from './auth';

export async function fetchCreditStatus() {
  const session = await getSession();
  if (!session?.access_token) {
    return {
      credits: 0,
      lifetimePurchased: 0,
      lifetimeUsed: 0,
      hasActiveSubscription: false,
      authenticated: false,
    };
  }

  const res = await fetch('/api/credits/status', {
    headers: {
      Authorization: `Bearer ${session.access_token}`,
    },
  });

  if (!res.ok) {
    throw new Error('Could not load credit balance.');
  }

  return res.json();
}

export async function consumeSearchCredit(metadata = {}) {
  const session = await getSession();
  if (!session?.access_token) {
    return { allowed: false, credits: 0, reason: 'auth_required' };
  }

  const res = await fetch('/api/credits/consume', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${session.access_token}`,
    },
    body: JSON.stringify({ metadata }),
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok && data.reason !== 'no_credits') {
    throw new Error(data.error || 'Could not use a search credit.');
  }

  return data;
}
