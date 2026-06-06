import Image from 'next/image';
import Link from 'next/link';

const reasons = [
  'Roads rarely follow a straight line',
  'Traffic can change what feels fair',
  'Bridges, highways, and local roads matter',
  'Two nearby addresses can have very different routes',
  'A useful midpoint should have places nearby',
  'Driving time is often better than map distance',
];

const faqs = [
  {
    question: 'What is the halfway point between two locations?',
    answer:
      'The halfway point is the place between two locations where the trip is split as fairly as possible. For real plans, driving time is often more useful than the geographic center.',
  },
  {
    question: 'How do I calculate the halfway point?',
    answer:
      'Enter both locations into Split The Distance. The calculator finds a practical midpoint and helps you choose nearby places to meet.',
  },
  {
    question: 'Is the halfway point always exactly in the middle on a map?',
    answer:
      'No. The visual center of a map may not be fair because roads, traffic, and route options can make one person travel much longer.',
  },
  {
    question: 'Can I find the halfway point between two addresses?',
    answer:
      'Yes. You can enter exact addresses, cities, landmarks, or place names. Exact addresses usually give the most precise result.',
  },
  {
    question: 'Can I find places near the halfway point?',
    answer:
      'Yes. After finding the midpoint, you can look for restaurants, coffee shops, parks, bars, and other places nearby.',
  },
];

export const metadata = {
  title: 'What Is the Halfway Point Between Two Locations?',
  description:
    'Learn what the halfway point between two locations means, why driving time matters, and calculate a fair place to meet.',
  alternates: {
    canonical: '/what-is-the-halfway-point-between',
  },
  openGraph: {
    title: 'What Is the Halfway Point Between Two Locations?',
    description:
      'Find a practical midpoint between two locations and discover nearby places to meet.',
    url: '/what-is-the-halfway-point-between',
    images: ['/og-image.png'],
  },
};

export default function WhatIsHalfwayPointPage() {
  const faqJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: faqs.map((faq) => ({
      '@type': 'Question',
      name: faq.question,
      acceptedAnswer: {
        '@type': 'Answer',
        text: faq.answer,
      },
    })),
  };

  return (
    <div className="min-h-screen bg-white text-gray-900">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }}
      />

      <header className="border-b border-gray-200 bg-white">
        <div className="max-w-6xl mx-auto px-5 py-4 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2 text-gray-900 font-semibold text-lg hover:opacity-80 transition">
            <Image src="/logo.png" alt="Split The Distance" width={28} height={28} priority />
            Split The Distance
          </Link>
          <nav className="flex items-center gap-5 text-sm text-gray-500">
            <Link href="/halfway-point-calculator" className="hover:text-gray-900 transition">Calculator</Link>
            <Link href="/meet-halfway" className="hover:text-gray-900 transition">Meet Halfway</Link>
            <Link href="/about" className="hover:text-gray-900 transition">About Us</Link>
          </nav>
        </div>
      </header>

      <main>
        <section className="bg-white px-5 py-12 lg:py-16">
          <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-[1.02fr_0.98fr] gap-10 items-center">
            <div>
              <p className="text-sm font-semibold uppercase tracking-wide text-teal-700 mb-4">
                Halfway Point Explained
              </p>
              <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold leading-tight tracking-tight text-gray-950 mb-5">
                What is the halfway point between two locations?
              </h1>
              <p className="text-lg sm:text-xl leading-8 text-gray-600 mb-8">
                It is the place that splits a trip as fairly as possible. The best midpoint is usually based on real
                travel, not just the visual center of a map.
              </p>

              <form action="/" method="get" className="rounded-lg border border-gray-200 bg-gray-50 p-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <label className="block">
                    <span className="sr-only">First location</span>
                    <input
                      name="from"
                      type="text"
                      required
                      placeholder="First location"
                      className="w-full h-12 rounded-md border border-gray-300 bg-white px-4 text-base text-gray-950 outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-100"
                    />
                  </label>
                  <label className="block">
                    <span className="sr-only">Second location</span>
                    <input
                      name="to"
                      type="text"
                      required
                      placeholder="Second location"
                      className="w-full h-12 rounded-md border border-gray-300 bg-white px-4 text-base text-gray-950 outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-100"
                    />
                  </label>
                </div>
                <button
                  type="submit"
                  className="mt-3 w-full h-12 rounded-md bg-teal-600 px-5 text-base font-bold text-white hover:bg-teal-700 transition"
                >
                  Calculate the Halfway Point
                </button>
              </form>
            </div>

            <div className="relative overflow-hidden rounded-lg border border-teal-900/10 bg-teal-900 aspect-[4/3] shadow-sm">
              <Image
                src="/og-image.png"
                alt="Split The Distance halfway point graphic"
                fill
                sizes="(min-width: 1024px) 45vw, 100vw"
                className="object-contain"
                priority
              />
            </div>
          </div>
        </section>

        <section className="border-y border-gray-200 bg-gray-50 px-5 py-14">
          <div className="max-w-4xl mx-auto">
            <h2 className="text-3xl font-extrabold tracking-tight text-gray-950 mb-4">
              The halfway point is not always the map center
            </h2>
            <p className="text-lg leading-8 text-gray-600 mb-5">
              If you draw a straight line between two places, the center point may look fair. But real trips happen on
              roads. Highways, bridges, traffic, and local route options can make one side of the trip much longer.
            </p>
            <p className="text-lg leading-8 text-gray-600">
              That is why a useful halfway point calculator should help you think about travel time and nearby meeting
              spots, not just latitude and longitude.
            </p>
          </div>
        </section>

        <section className="bg-white px-5 py-14">
          <div className="max-w-5xl mx-auto">
            <h2 className="text-3xl font-extrabold tracking-tight text-gray-950 mb-8 text-center">
              Why real travel changes the answer
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {reasons.map((reason) => (
                <div key={reason} className="min-h-16 rounded-md border border-gray-200 bg-gray-50 px-4 py-4 text-sm font-semibold leading-6 text-gray-700">
                  {reason}
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="bg-gray-50 px-5 py-14">
          <div className="max-w-4xl mx-auto">
            <h2 className="text-3xl font-extrabold tracking-tight text-gray-950 mb-8">
              Frequently asked questions
            </h2>
            <div className="divide-y divide-gray-200 border-y border-gray-200">
              {faqs.map((faq) => (
                <div key={faq.question} className="py-6">
                  <h3 className="text-lg font-bold text-gray-950 mb-2">{faq.question}</h3>
                  <p className="text-base leading-7 text-gray-600">{faq.answer}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="bg-white px-5 py-14">
          <div className="max-w-4xl mx-auto text-center">
            <h2 className="text-3xl font-extrabold tracking-tight text-gray-950 mb-4">
              Find the halfway point now
            </h2>
            <p className="text-lg leading-8 text-gray-600 mb-7">
              Enter two places and choose a meeting spot that works in the real world.
            </p>
            <Link
              href="/halfway-point-calculator"
              className="inline-flex h-12 items-center justify-center rounded-md bg-orange-500 px-6 text-base font-bold text-white hover:bg-orange-600 transition"
            >
              Open the Calculator
            </Link>
          </div>
        </section>
      </main>

      <footer className="border-t border-gray-200 bg-gray-50">
        <div className="max-w-4xl mx-auto px-5 py-8 text-center text-sm text-gray-500">
          <div className="flex items-center justify-center gap-4 mb-2 flex-wrap">
            <Link href="/about" className="hover:text-gray-700 transition">About Us</Link>
            <span>&middot;</span>
            <Link href="/legal/terms" className="hover:text-gray-700 transition">Terms</Link>
            <span>&middot;</span>
            <Link href="/legal/privacy" className="hover:text-gray-700 transition">Privacy</Link>
          </div>
          <p>Split The Distance &copy; {new Date().getFullYear()}</p>
        </div>
      </footer>
    </div>
  );
}
