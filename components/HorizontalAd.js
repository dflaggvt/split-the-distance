'use client';

import { useEffect, useRef } from 'react';

export default function HorizontalAd() {
  const pushed = useRef(false);

  useEffect(() => {
    if (pushed.current) return;
    pushed.current = true;

    try {
      window.adsbygoogle = window.adsbygoogle || [];
      window.adsbygoogle.push({});
    } catch (error) {
      console.warn('AdSense horizontal slot failed to initialize', error);
    }
  }, []);

  return (
    <div className="border-b border-gray-200 bg-white px-5 py-6">
      <div className="max-w-5xl mx-auto min-h-[100px]">
        {/* horizontal-ad */}
        <ins
          className="adsbygoogle"
          style={{ display: 'block' }}
          data-ad-client="ca-pub-2872150626660502"
          data-ad-slot="3829468325"
          data-ad-format="auto"
          data-full-width-responsive="true"
        />
      </div>
    </div>
  );
}
