'use client';

import { useEffect, useRef } from 'react';

export default function MainPageAd() {
  const pushed = useRef(false);

  useEffect(() => {
    if (pushed.current) return;
    pushed.current = true;

    try {
      window.adsbygoogle = window.adsbygoogle || [];
      window.adsbygoogle.push({});
    } catch (error) {
      console.warn('AdSense slot failed to initialize', error);
    }
  }, []);

  return (
    <div className="mt-6 mb-6 border-t border-gray-100 pt-6 min-h-[120px] max-md:mt-4 max-md:mb-5 max-md:pt-4 max-md:min-h-[100px]">
      {/* main-page */}
      <ins
        className="adsbygoogle"
        style={{ display: 'block' }}
        data-ad-client="ca-pub-2872150626660502"
        data-ad-slot="4051119746"
        data-ad-format="auto"
        data-full-width-responsive="true"
      />
    </div>
  );
}
