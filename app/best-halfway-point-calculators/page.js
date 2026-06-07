import Image from 'next/image';
import Link from 'next/link';

const tools = [
  {
    name: 'Split The Distance',
    url: '/',
    bestFor: 'Finding a fair midpoint and choosing real places nearby',
    strengths: [
      'Built around practical meeting spots',
      'Works with addresses, cities, and place names',
      'Helps you choose restaurants, cafes, parks, and other nearby places',
      'Simple modern interface for phone or desktop',
    ],
    whenToUse:
      'Use Split The Distance when you want to find a fair place to meet, stop, or split a drive and then pick somewhere nearby.',
  },
  {
    name: 'Travelmath',
    url: 'https://www.travelmath.com/halfway/',
    bestFor: 'Travel math, city midpoints, and road-trip calculations',
    strengths: [
      'Useful for travel distances and related trip calculations',
      'Good for city-to-city planning',
      'Includes road trip and stopping-point context',
    ],
    whenToUse:
      'Use Travelmath when you want a broader travel calculator with distance, driving time, and city-style trip information.',
  },
  {
    name: 'MeetWays',
    url: 'https://www.meetways.com/',
    bestFor: 'Classic meet-in-the-middle searches',
    strengths: [
      'Focused on meeting halfway between two places',
      'Can search around the halfway point for a point of interest',
      'Well-known option for simple midpoint searches',
    ],
    whenToUse:
      'Use MeetWays when you want a straightforward meet-in-the-middle search with a specific point-of-interest category.',
  },
  {
    name: 'Whatshalfway',
    url: 'https://www2.whatshalfway.com/',
    bestFor: 'Finding places to meet or stop halfway',
    strengths: [
      'Focused on meeting or stopping halfway',
      'Useful for road trip-style midpoint planning',
      'Can help explore places around the middle of a route',
    ],
    whenToUse:
      'Use Whatshalfway when you want to explore halfway places for a meetup or stop along a trip.',
  },
  {
    name: 'Map and midpoint tools',
    url: 'https://www.google.com/search?q=midpoint+finder',
    bestFor: 'Simple geographic midpoint checks',
    strengths: [
      'Helpful for quick map-based midpoint estimates',
      'Good for visualizing a center point',
      'Often useful for educational or geographic tasks',
    ],
    whenToUse:
      'Use a general midpoint tool when you only need the geographic center and do not need nearby meeting-place suggestions.',
  },
];

const comparisonRows = [
  ['Split The Distance', 'Fair meeting spots', 'Yes', 'Yes', 'Yes', 'Yes'],
  ['Travelmath', 'Travel calculations', 'Yes', 'Some', 'Yes', 'Some'],
  ['MeetWays', 'Meet-in-the-middle search', 'Yes', 'Yes', 'Some', 'Yes'],
  ['Whatshalfway', 'Meet or stop halfway', 'Yes', 'Yes', 'Yes', 'Yes'],
  ['Map midpoint tools', 'Geographic center points', 'Varies', 'Usually no', 'Usually no', 'Varies'],
];

const faqs = [
  {
    question: 'What is the best halfway point calculator?',
    answer:
      'The best calculator depends on what you need. Split The Distance is best when you want a practical midpoint and nearby places to actually meet. Travelmath is useful for broader travel calculations. MeetWays and Whatshalfway are classic meet-in-the-middle tools.',
  },
  {
    question: 'Can Google Maps find the halfway point between two places?',
    answer:
      'Google Maps can show routes and places, but it is not primarily designed as a halfway point calculator. A dedicated midpoint tool can make it easier to split the trip and search near the middle.',
  },
  {
    question: 'Should I use distance or driving time to meet halfway?',
    answer:
      'Driving time is usually more useful for real plans because roads, traffic, bridges, and highways can make a geographic midpoint feel unfair.',
  },
  {
    question: 'Can I find restaurants near the halfway point?',
    answer:
      'Yes. Split The Distance helps you find nearby restaurants, cafes, parks, bars, and other places around the midpoint.',
  },
  {
    question: 'Which halfway calculator is best for road trips?',
    answer:
      'For a road trip, look for a tool that finds a practical midpoint and helps you choose a useful stop nearby. Split The Distance works well for finding midpoint stops, while Travelmath and Whatshalfway also have road-trip-oriented use cases.',
  },
];

const toolLinkClass =
  'inline-flex h-10 items-center justify-center rounded-md border border-gray-300 px-4 text-sm font-bold text-gray-700 hover:bg-gray-50 transition';

export const metadata = {
  title: 'Best Halfway Point Calculators | Compare Midpoint Tools',
  description:
    'Compare the best halfway point calculators for meeting in the middle, finding midpoint stops, and choosing nearby restaurants, cafes, parks, and places.',
  alternates: {
    canonical: '/best-halfway-point-calculators',
  },
  openGraph: {
    title: 'Best Halfway Point Calculators',
    description:
      'Compare tools for finding a midpoint, meeting halfway, and choosing nearby places to stop or meet.',
    url: '/best-halfway-point-calculators',
    images: ['/og-image.png'],
  },
};

export default function BestHalfwayPointCalculatorsPage() {
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
            <Link href="/halfway-point-calculator" className="hover:text-gray-900 transition">Halfway Calculator</Link>
            <Link href="/meet-halfway" className="hover:text-gray-900 transition">Meet Halfway</Link>
            <Link href="/about" className="hover:text-gray-900 transition">About Us</Link>
          </nav>
        </div>
      </header>

      <main>
        <section className="bg-white px-5 py-12 lg:py-16">
          <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-[1.04fr_0.96fr] gap-10 items-center">
            <div>
              <p className="text-sm font-semibold uppercase tracking-wide text-teal-700 mb-4">
                Comparison Guide
              </p>
              <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold leading-tight tracking-tight text-gray-950 mb-5">
                Best halfway point calculators for meeting in the middle.
              </h1>
              <p className="text-lg sm:text-xl leading-8 text-gray-600 mb-8">
                Compare tools for finding the midpoint between two locations, choosing a fair meeting spot, and
                discovering restaurants, cafes, parks, or road trip stops nearby.
              </p>

              <div className="flex flex-col sm:flex-row gap-3">
                <Link
                  href="/"
                  className="inline-flex h-12 items-center justify-center rounded-md bg-teal-600 px-6 text-base font-bold text-white hover:bg-teal-700 transition"
                >
                  Try Split The Distance
                </Link>
                <Link
                  href="#comparison"
                  className="inline-flex h-12 items-center justify-center rounded-md border border-gray-300 bg-white px-6 text-base font-bold text-gray-800 hover:bg-gray-50 transition"
                >
                  Compare Tools
                </Link>
              </div>
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

        <section id="comparison" className="border-y border-gray-200 bg-gray-50 px-5 py-14">
          <div className="max-w-6xl mx-auto">
            <h2 className="text-3xl font-extrabold tracking-tight text-gray-950 mb-4 text-center">
              Quick comparison
            </h2>
            <p className="max-w-3xl mx-auto text-center text-lg leading-8 text-gray-600 mb-8">
              Different halfway tools are better for different jobs. The best choice depends on whether you need travel
              math, a simple midpoint, or a real place to meet.
            </p>

            <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white">
              <table className="w-full min-w-[760px] text-sm">
                <thead className="bg-gray-100 text-left text-gray-600">
                  <tr>
                    <th className="px-4 py-3 font-semibold">Tool</th>
                    <th className="px-4 py-3 font-semibold">Best for</th>
                    <th className="px-4 py-3 font-semibold">Addresses</th>
                    <th className="px-4 py-3 font-semibold">Nearby places</th>
                    <th className="px-4 py-3 font-semibold">Road trips</th>
                    <th className="px-4 py-3 font-semibold">Meet halfway</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {comparisonRows.map(([tool, bestFor, addresses, places, roadTrips, meet]) => (
                    <tr key={tool} className="hover:bg-gray-50">
                      <td className="px-4 py-3 font-bold text-gray-950">{tool}</td>
                      <td className="px-4 py-3 text-gray-700">{bestFor}</td>
                      <td className="px-4 py-3 text-gray-600">{addresses}</td>
                      <td className="px-4 py-3 text-gray-600">{places}</td>
                      <td className="px-4 py-3 text-gray-600">{roadTrips}</td>
                      <td className="px-4 py-3 text-gray-600">{meet}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </section>

        <section className="bg-white px-5 py-14">
          <div className="max-w-4xl mx-auto">
            <h2 className="text-3xl font-extrabold tracking-tight text-gray-950 mb-4">
              What makes a good halfway point calculator?
            </h2>
            <p className="text-lg leading-8 text-gray-600 mb-5">
              A good halfway point calculator should do more than show the center of a map. Real plans depend on roads,
              driving time, nearby places, and whether the result is easy to share with the other person.
            </p>
            <p className="text-lg leading-8 text-gray-600">
              If you are meeting someone, the best tool is usually the one that gets you from wondering where halfway
              is to deciding where to actually meet with the fewest steps.
            </p>
          </div>
        </section>

        <section className="bg-gray-50 px-5 py-14">
          <div className="max-w-5xl mx-auto">
            <h2 className="text-3xl font-extrabold tracking-tight text-gray-950 mb-8 text-center">
              Tool-by-tool notes
            </h2>
            <div className="grid grid-cols-1 gap-4">
              {tools.map((tool) => (
                <article key={tool.name} className="rounded-lg border border-gray-200 bg-white p-6">
                  <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4 mb-4">
                    <div>
                      <h3 className="text-xl font-extrabold text-gray-950">{tool.name}</h3>
                      <p className="text-sm font-semibold text-teal-700 mt-1">{tool.bestFor}</p>
                    </div>
                    {tool.url.startsWith('http') ? (
                      <a
                        href={tool.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className={toolLinkClass}
                      >
                        Visit Tool
                      </a>
                    ) : (
                      <Link href={tool.url} className={toolLinkClass}>
                        Visit Tool
                      </Link>
                    )}
                  </div>
                  <div className="grid grid-cols-1 lg:grid-cols-[1fr_1.2fr] gap-5">
                    <div>
                      <p className="text-sm font-bold text-gray-950 mb-2">What it does well</p>
                      <ul className="space-y-2 text-sm leading-6 text-gray-600">
                        {tool.strengths.map((strength) => (
                          <li key={strength}>{strength}</li>
                        ))}
                      </ul>
                    </div>
                    <div className="rounded-md bg-gray-50 p-4 text-sm leading-6 text-gray-700">
                      {tool.whenToUse}
                    </div>
                  </div>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="bg-white px-5 py-14">
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

        <section className="bg-gray-50 px-5 py-14">
          <div className="max-w-4xl mx-auto text-center">
            <h2 className="text-3xl font-extrabold tracking-tight text-gray-950 mb-4">
              Try a modern halfway point calculator
            </h2>
            <p className="text-lg leading-8 text-gray-600 mb-7">
              Enter two places, find a fair midpoint, and choose somewhere nearby to meet or stop.
            </p>
            <Link
              href="/"
              className="inline-flex h-12 items-center justify-center rounded-md bg-orange-500 px-6 text-base font-bold text-white hover:bg-orange-600 transition"
            >
              Try Split The Distance
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
