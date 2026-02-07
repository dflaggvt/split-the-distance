import { Inter } from 'next/font/google';
import Script from 'next/script';
import './globals.css';

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
});

// Analytics IDs
const GA4_ID = 'G-3DME8BT47D';
const GTM_ID = 'GTM-W9DCSSKC';

export const viewport = {
  themeColor: '#0f766e',
};

export const metadata = {
  title: 'Split The Distance — Meet in the Middle',
  description:
    'Find the perfect meeting point between two locations based on actual drive time. Discover restaurants, cafes, parks, and more at the midpoint.',
  openGraph: {
    title: 'Split The Distance — Meet in the Middle',
    description:
      'Find the perfect meeting point between two locations based on actual drive time. Discover restaurants, cafes, parks, and more at the midpoint.',
    type: 'website',
    siteName: 'Split The Distance',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Split The Distance — Meet in the Middle',
    description:
      'Find the perfect meeting point between two locations based on actual drive time.',
  },
  icons: {
    icon: "data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='.9em' font-size='90'>📍</text></svg>",
  },
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" className={inter.variable}>
      <head>
        {/* Google Tag Manager - only on production */}
        <Script id="gtm-script" strategy="afterInteractive">
          {`(function(){
            var h = window.location.hostname;
            if (h !== 'splitthedistance.com' && h !== 'www.splitthedistance.com') {
              return;
            }
            (function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':
            new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],
            j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src=
            'https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);
            })(window,document,'script','dataLayer','${GTM_ID}');
          })();`}
        </Script>
        
        {/* Google Analytics 4 - only on production */}
        <Script id="ga4-script" strategy="afterInteractive">
          {`(function(){
            var h = window.location.hostname;
            if (h !== 'splitthedistance.com' && h !== 'www.splitthedistance.com') {
              window.gtag = function() {};
              return;
            }
            var s = document.createElement('script');
            s.src = 'https://www.googletagmanager.com/gtag/js?id=${GA4_ID}';
            s.async = true;
            document.head.appendChild(s);
            window.dataLayer = window.dataLayer || [];
            function gtag(){dataLayer.push(arguments);}
            window.gtag = gtag;
            gtag('js', new Date());
            gtag('config', '${GA4_ID}');
          })();`}
        </Script>
      </head>
      <body className="font-sans text-gray-800 bg-gray-50 antialiased">
        {/* Google Tag Manager (noscript) */}
        <noscript>
          <iframe
            src={`https://www.googletagmanager.com/ns.html?id=${GTM_ID}`}
            height="0"
            width="0"
            style={{ display: 'none', visibility: 'hidden' }}
          />
        </noscript>
        {children}
      </body>
    </html>
  );
}
