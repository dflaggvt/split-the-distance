'use client';

import { useSyncExternalStore } from 'react';

function isDevHost(hostname) {
  return (
    hostname === 'localhost' ||
    hostname === '127.0.0.1' ||
    hostname.endsWith('.vercel.app')
  ) && hostname !== 'www.splitthedistance.com' && hostname !== 'splitthedistance.com';
}

export default function DevEnvironmentBadge() {
  const showBadge = useSyncExternalStore(
    () => () => {},
    () => isDevHost(window.location.hostname),
    () => false
  );

  if (!showBadge) return null;

  return (
    <span className="ml-2 rounded border border-sky-300 bg-sky-50 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-sky-700">
      DEV
    </span>
  );
}
