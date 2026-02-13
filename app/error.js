'use client';

import { useEffect } from 'react';

export default function Error({ error, reset }) {
  useEffect(() => {
    console.error('[ErrorBoundary]', error);
  }, [error]);

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
      <div className="max-w-xl w-full bg-white rounded-xl shadow-lg border border-red-200 p-8">
        <h2 className="text-xl font-bold text-red-700 mb-2">Something went wrong</h2>
        <p className="text-sm text-gray-600 mb-4">
          Please share the error below so we can fix it:
        </p>
        <pre className="bg-red-50 border border-red-200 rounded-lg p-4 text-xs text-red-800 overflow-auto max-h-60 whitespace-pre-wrap break-words mb-4">
          {error?.message || 'Unknown error'}
          {'\n\n'}
          {error?.stack || ''}
        </pre>
        <button
          onClick={() => reset()}
          className="px-5 py-2.5 bg-teal-600 text-white rounded-lg font-medium hover:bg-teal-700 transition-colors"
        >
          Try Again
        </button>
      </div>
    </div>
  );
}
