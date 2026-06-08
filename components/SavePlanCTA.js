'use client';

export default function SavePlanCTA({
  isLoggedIn,
  canSave = true,
  status = 'idle',
  onSave,
}) {
  if (!canSave) return null;

  if (isLoggedIn) {
    if (status === 'idle') return null;

    const message = status === 'saving'
      ? 'Saving this route...'
      : status === 'error'
        ? 'Could not save this route. Try again.'
        : 'Saved. You can find it in Recent searches.';

    return (
      <div className={`mb-4 rounded-xl border px-4 py-3 text-sm ${
        status === 'error'
          ? 'border-red-100 bg-red-50 text-red-700'
          : 'border-teal-100 bg-teal-50 text-teal-800'
      }`}>
        <div className="flex items-center gap-2">
          <span className={`h-2 w-2 rounded-full ${
            status === 'saving' ? 'bg-teal-400 animate-pulse' : status === 'error' ? 'bg-red-400' : 'bg-teal-500'
          }`} />
          <span className="font-medium">{message}</span>
        </div>
      </div>
    );
  }

  return (
    <div className="mb-4 rounded-xl border border-teal-100 bg-teal-50/80 p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-bold text-gray-900">Save this halfway plan</h3>
          <p className="mt-1 text-sm leading-5 text-gray-600">
            Create a free account to keep this route and come back later.
          </p>
        </div>
        <button
          type="button"
          onClick={onSave}
          className="shrink-0 rounded-lg bg-teal-600 px-3.5 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-teal-700"
        >
          Save This Plan
        </button>
      </div>
    </div>
  );
}
