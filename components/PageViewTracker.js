'use client';

import { useEffect, useRef } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';
import { logPageView } from '@/lib/analytics';
import { logSessionEvent } from '@/lib/sessionEvents';
import { useAuth } from './AuthProvider';

const EXCLUDED_PREFIXES = ['/d4shb0ard-7x9k'];

export default function PageViewTracker() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { user } = useAuth();
  const lastTrackedRef = useRef(null);

  useEffect(() => {
    if (!pathname) return;
    if (EXCLUDED_PREFIXES.some((prefix) => pathname.startsWith(prefix))) return;

    const search = searchParams?.toString() || '';
    const pageKey = `${pathname}?${search}`;
    if (lastTrackedRef.current === pageKey) return;
    lastTrackedRef.current = pageKey;

    logPageView(pathname, { userId: user?.id });
    logSessionEvent('page_viewed', {
      path: pathname,
      search: search ? `?${search}` : null,
    }, { userId: user?.id });
  }, [pathname, searchParams, user?.id]);

  return null;
}
