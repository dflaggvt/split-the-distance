import Image from 'next/image';
import Link from 'next/link';

const stopIdeas = [
  'Restaurants for a real meal',
  'Coffee shops for a quick break',
  'Parks for stretching or walking',
  'Bars or activities for a longer stop',
  'Hotels for overnight road trips',
  'Gas stations and practical rest stops',
];

const faqs = [
  {
    question: 'How do I find the best place to stop halfway on a drive?',
    answer:
      'Enter your starting point and destination, then use Split The Distance to find a practical midpoint and nearby places where you can stop.',
  },
  {
    question: 'Can I use this for a road trip?',
    answer:
      'Yes. The calculator works well for road trips when you want to find a midpoint stop for lunch, coffee, a walk, or an overnight break.',
  },
  {
    question: 'Is the halfway stop based on driving time?',
    answer:
      'Split The Distance is designed around real travel routes, which is often more useful than picking the geographic center of a map.',
  },
  {
    question: 'Can I find restaurants halfway to my destination?',
    answer:
      'Yes. After finding the midpoint, you can look for restaurants, cafes, parks, bars, and other places near the halfway area.',
  },
  {
    question: 'What makes a good halfway stop?',
    answer:
      'A good halfway stop is close to the route, easy to reach, and useful for the kind of break you need, such as food, coffee, walking, or rest.',
  },
];

export const metadata = {
  title: 'Best Place to Stop Halfway on a Drive | Split The Distance',
  description:
    'Find the best place to stop halfway on a drive or road trip. Enter your start and destination to discover restaurants, cafes, parks, and other midpoint stops.',
  alternates: {
    canonical: '/best-place-to-stop-halfway',
  },
  openGraph: {
    title: 'Best Place to Stop Halfway on a Drive',
    description:
      'Find a practical halfway stop on your drive and discover nearby restaurants, cafes, parks, and more.',
    url: '/best-place-to-stop-halfway',
    images: ['/og-image.png'],
  },
};

export default function BestPlaceToStopHalfwayPage() {
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
          <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-[1.03fr_0.97fr] gap-10 items-center">
            <div>
              <p className="text-sm font-semibold uppercase tracking-wide text-teal-700 mb-4">
                Road Trip Stops
              </p>
              <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold leading-tight tracking-tight text-gray-950 mb-5">
                Find the best place to stop halfway on a drive.
              </h1>
              <p className="text-lg sm:text-xl leading-8 text-gray-600 mb-8">
                Enter your starting point and destination to find a practical halfway stop, then choose restaurants,
                cafes, parks, or other places nearby.
              </p>

              <form action="/" method="get" className="rounded-lg border border-gray-200 bg-gray-50 p-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <label className="block">
                    <span className="sr-only">Starting point</span>
                    <input
                      name="from"
                      type="text"
                      required
                      placeholder="Starting point"
                      className="w-full h-12 rounded-md border border-gray-300 bg-white px-4 text-base text-gray-950 outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-100"
                    />
                  </label>
                  <label className="block">
                    <span className="sr-only">Destination</span>
                    <input
                      name="to"
                      type="text"
                      required
                      placeholder="Destination"
                      className="w-full h-12 rounded-md border border-gray-300 bg-white px-4 text-base text-gray-950 outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-100"
                    />
                  </label>
                </div>
                <button
                  type="submit"
                  className="mt-3 w-full h-12 rounded-md bg-teal-600 px-5 text-base font-bold text-white hover:bg-teal-700 transition"
                >
                  Find a Halfway Stop
                </button>
              </form>
            </div>

            <div className="relative overflow-hidden rounded-lg border border-teal-900/10 bg-teal-900 aspect-[4/3] shadow-sm">
              <Image
                src="/og-image.png"
                alt="Split The Distance halfway stop graphic"
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
              Plan a better halfway stop
            </h2>
            <p className="text-lg leading-8 text-gray-600 mb-5">
              A long drive is easier when the stop is intentional. Instead of guessing where to pull off, find the
              midpoint area between your start and destination and choose a nearby place that fits the break you need.
            </p>
            <p className="text-lg leading-8 text-gray-600">
              For some trips that means lunch. For others it might be coffee, a park, a quick walk, or a place to stay
              overnight before continuing.
            </p>
          </div>
        </section>

        <section className="bg-white px-5 py-14">
          <div className="max-w-5xl mx-auto">
            <h2 className="text-3xl font-extrabold tracking-tight text-gray-950 mb-8 text-center">
              Ideas for halfway stops
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {stopIdeas.map((idea) => (
                <div key={idea} className="min-h-16 rounded-md border border-gray-200 bg-gray-50 px-4 py-4 text-sm font-semibold leading-6 text-gray-700">
                  {idea}
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="bg-gray-50 px-5 py-14">
          <div className="max-w-4xl mx-auto">
            <h2 className="text-3xl font-extrabold tracking-tight text-gray-950 mb-4">
              Why the map center is not always the best stop
            </h2>
            <p className="text-lg leading-8 text-gray-600">
              The center of a map may not be close to the road you are actually taking. A better halfway stop should
              be near the route, easy to reach, and useful for the kind of break you want.
            </p>
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
              Find your halfway stop
            </h2>
            <p className="text-lg leading-8 text-gray-600 mb-7">
              Enter your start and destination, then choose a useful place near the midpoint.
            </p>
            <Link
              href="/"
              className="inline-flex h-12 items-center justify-center rounded-md bg-orange-500 px-6 text-base font-bold text-white hover:bg-orange-600 transition"
            >
              Find a Halfway Stop
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
