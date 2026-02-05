import { Suspense } from 'react';
import AppClient from '@/components/AppClient';

export default function Page() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center h-screen bg-gray-50">
          <div className="text-gray-400 text-sm">Loading...</div>
        </div>
      }
    >
      <AppClient />
    </Suspense>
  );
}
