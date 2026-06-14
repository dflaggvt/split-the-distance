export function isDevelopmentEnvironment() {
  if (process.env.VERCEL_ENV) {
    return process.env.VERCEL_ENV !== 'production';
  }

  return process.env.NODE_ENV === 'development';
}

export default function EnvironmentMarker() {
  if (!isDevelopmentEnvironment()) return null;

  return (
    <div
      aria-label="Development environment"
      className="pointer-events-none fixed right-3 top-16 z-[10000] rounded-md border border-sky-300 bg-sky-50 px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide text-sky-800 shadow-sm"
    >
      DEV
    </div>
  );
}
