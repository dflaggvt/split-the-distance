export const DEFAULT_SITE_URL = 'https://www.splitthedistance.com';

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
