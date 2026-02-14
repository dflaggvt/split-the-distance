import { Inter } from 'next/font/google';
import Script from 'next/script';
import './globals.css';
import { AuthProvider } from '@/components/AuthProvider';
import { FeatureProvider } from '@/components/FeatureProvider';

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
  metadataBase: new URL('https://splitthedistance.com'),
  title: 'Split The Distance — Find Your Halfway Point',
  description:
    'Find the perfect meeting point between two locations based on actual drive time. Discover restaurants, cafes, parks, and more at the midpoint.',
  openGraph: {
    title: 'Split The Distance — Find Your Halfway Point',
    description:
      'Find the perfect halfway point between two locations. Discover restaurants, cafes, and more at the midpoint.',
    url: 'https://splitthedistance.com',
    type: 'website',
    siteName: 'Split The Distance',
    locale: 'en_US',
    images: [
      {
        url: '/og-image.png',
        width: 1200,
        height: 630,
        alt: 'Split The Distance — Find the perfect meeting point between two locations',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Split The Distance — Find Your Halfway Point',
    description:
      'Find the perfect halfway point between two locations based on drive time.',
    images: ['/og-image.png'],
  },
  icons: {
    icon: '/logo.svg',
    apple: '/logo.png',
  },
};

// JSON-LD structured data for SEO
const jsonLd = {
  '@context': 'https://schema.org',
  '@graph': [
    {
      '@type': 'WebApplication',
      name: 'Split The Distance',
      url: 'https://splitthedistance.com',
      description:
        'Find the perfect meeting point between two locations based on actual drive time. Discover restaurants, cafes, parks, and more at the midpoint.',
      applicationCategory: 'TravelApplication',
      operatingSystem: 'Any',
      browserRequirements: 'Requires a modern web browser',
      offers: {
        '@type': 'Offer',
        price: '0',
        priceCurrency: 'USD',
      },
    },
    {
      '@type': 'Organization',
      name: 'Split The Distance',
      url: 'https://splitthedistance.com',
      logo: 'https://splitthedistance.com/logo.png',
      contactPoint: {
        '@type': 'ContactPoint',
        email: 'support@splitthedistance.com',
        contactType: 'customer support',
      },
    },
  ],
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" className={inter.variable}>
      <head>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
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
        <AuthProvider>
          <FeatureProvider>
            {children}
          </FeatureProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
