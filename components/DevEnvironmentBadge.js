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
    <span className="ml-2 rounded border border-amber-500 bg-amber-300 px-2 py-0.5 text-[10px] font-black uppercase tracking-wide text-amber-950 shadow-sm">
      DEV
    </span>
  );
}
