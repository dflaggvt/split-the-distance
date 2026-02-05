import { Inter } from 'next/font/google';
import './globals.css';

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
});

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
      <body className="font-sans text-gray-800 bg-gray-50 antialiased">
        {children}
      </body>
    </html>
  );
}
