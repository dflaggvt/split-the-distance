export const DEFAULT_SITE_URL = 'https://www.splitthedistance.com';

export const CREDIT_PACKS = {
  credits_10: {
    label: 'Starter',
    credits: 10,
    envKey: 'STRIPE_PRICE_CREDITS_10',
  },
  credits_30: {
    label: 'Planner',
    credits: 30,
    envKey: 'STRIPE_PRICE_CREDITS_30',
  },
  credits_100: {
    label: 'Road Trip',
    credits: 100,
    envKey: 'STRIPE_PRICE_CREDITS_100',
  },
};

export function getCanonicalSiteUrl() {
  const configured =
    process.env.NEXT_PUBLIC_SITE_URL ||
    process.env.SITE_URL ||
    process.env.VERCEL_PROJECT_PRODUCTION_URL ||
    DEFAULT_SITE_URL;

  const withProtocol = configured.startsWith('http')
    ? configured
    : `https://${configured}`;

  try {
    return new URL(withProtocol).origin;
  } catch {
    return DEFAULT_SITE_URL;
  }
}

function firstHeaderValue(value) {
  return value?.split(',')?.[0]?.trim() || '';
}

function isAllowedCheckoutHost(hostname) {
  const host = hostname?.toLowerCase();

  return (
    host === 'splitthedistance.com' ||
    host === 'www.splitthedistance.com' ||
    host === 'localhost' ||
    host === '127.0.0.1' ||
    host === '::1' ||
    host?.endsWith('.vercel.app')
  );
}

function safeOriginFromUrl(value) {
  if (!value) return null;

  try {
    const url = new URL(value);
    if (!['http:', 'https:'].includes(url.protocol)) return null;
    if (!isAllowedCheckoutHost(url.hostname)) return null;
    return url.origin;
  } catch {
    return null;
  }
}

export function getCheckoutReturnOrigin(request) {
  const headers = request?.headers;
  const origin = safeOriginFromUrl(headers?.get('origin'));
  if (origin) return origin;

  const forwardedHost = firstHeaderValue(headers?.get('x-forwarded-host'));
  const host = forwardedHost || firstHeaderValue(headers?.get('host'));
  if (host) {
    const forwardedProto = firstHeaderValue(headers?.get('x-forwarded-proto'));
    const protocol = forwardedProto || (host.startsWith('localhost') || host.startsWith('127.0.0.1') ? 'http' : 'https');
    const forwardedOrigin = safeOriginFromUrl(`${protocol}://${host}`);
    if (forwardedOrigin) return forwardedOrigin;
  }

  return getCanonicalSiteUrl();
}

export function getMissingEnv(keys) {
  return keys.filter((key) => !process.env[key]);
}

export function throwIfMissingEnv(keys, label = 'Server misconfigured') {
  const missing = getMissingEnv(keys);
  if (missing.length > 0) {
    throw new Error(`${label}. Missing: ${missing.join(', ')}`);
  }
}

export async function expectSupabaseResult(query, label) {
  const { data, error } = await query;
  if (error) {
    throw new Error(`${label}: ${error.message}`);
  }
  return data;
}

export function isNoRowsError(error) {
  return error?.code === 'PGRST116';
}

export function getStripeId(value) {
  if (typeof value === 'string') return value;
  return value?.id || null;
}
