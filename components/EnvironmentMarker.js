export function isDevelopmentEnvironment() {
  if (process.env.VERCEL_ENV) {
    return process.env.VERCEL_ENV !== 'production';
  }

  return process.env.NODE_ENV === 'development';
}

export default function EnvironmentMarker() {
  if (!isDevelopmentEnvironment()) return null;

  return (
    <>
      <div
        aria-label="Development environment"
        className="pointer-events-none fixed left-0 right-0 top-0 z-[10000] border-b border-amber-500 bg-amber-300 px-3 py-1 text-center text-[11px] font-black uppercase tracking-wide text-amber-950 shadow-sm"
      >
        Development Environment
      </div>
      <div
        aria-hidden="true"
        className="pointer-events-none fixed inset-0 z-[9999] border-[5px] border-amber-400"
      />
    </>
  );
}
