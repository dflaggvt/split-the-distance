import Image from 'next/image';
import Link from 'next/link';
import HorizontalAd from '@/components/HorizontalAd';

const faqs = [
  {
    question: 'How do I find the halfway point between two addresses?',
    answer:
      'Enter both addresses into the calculator and Split The Distance will find a practical midpoint, then show places nearby where you can meet.',
  },
  {
    question: 'Is the halfway point based on distance or driving time?',
    answer:
      'Split The Distance can help you compare routes and find a midpoint based on real travel, which is often more useful than a straight-line center on a map.',
  },
  {
    question: 'Can I find restaurants near the halfway point?',
    answer:
      'Yes. After calculating the midpoint, you can browse nearby restaurants, coffee shops, parks, bars, activities, and other meeting spots.',
  },
  {
    question: 'Can I share the halfway point with someone else?',
    answer:
      'Yes. Once you find a route and meeting spot, you can share the result so the other person can review the same midpoint.',
  },
  {
    question: 'Does this work for cities and exact addresses?',
    answer:
      'Yes. You can enter cities, addresses, landmarks, or place names. Exact addresses usually give the most precise result.',
  },
];

const useCases = [
  'Meet a friend who lives in another town',
  'Pick a fair date night spot',
  'Plan a family meetup',
  'Choose a lunch spot between offices',
  'Find a road trip stop that is not random',
];

export const metadata = {
  title: 'Halfway Point Calculator | Split The Distance',
  description:
    'Find the best halfway point between two locations based on real travel. Discover restaurants, cafes, parks, and other places near the midpoint.',
  alternates: {
    canonical: '/halfway-point-calculator',
  },
  openGraph: {
    title: 'Halfway Point Calculator | Split The Distance',
    description:
      'Find a fair place to meet between two locations and discover nearby restaurants, cafes, parks, and more.',
    url: '/halfway-point-calculator',
    images: ['/og-image.png'],
  },
};

export default function HalfwayPointCalculatorPage() {
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

      <header className="absolute top-0 left-0 right-0 z-20">
        <div className="max-w-6xl mx-auto px-5 py-4 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2 text-white font-semibold text-lg hover:opacity-90 transition">
            <Image src="/logo.png" alt="Split The Distance" width={28} height={28} priority />
            Split The Distance
          </Link>
          <nav className="flex items-center gap-5 text-sm text-white/80">
            <Link href="/about" className="hover:text-white transition">About Us</Link>
            <Link href="/legal/privacy" className="hover:text-white transition">Privacy</Link>
          </nav>
        </div>
      </header>

      <section className="relative min-h-[78vh] overflow-hidden bg-gray-950">
        <Image
          src="/og-image.png"
          alt=""
          fill
          priority
          sizes="100vw"
          className="object-cover opacity-60"
        />
        <div className="absolute inset-0 bg-gray-950/45" />

        <div className="relative z-10 max-w-6xl mx-auto px-5 pt-28 pb-12 min-h-[78vh] flex flex-col justify-center">
          <div className="max-w-3xl">
            <p className="text-sm font-semibold uppercase tracking-wide text-teal-100 mb-4">
              Halfway Point Calculator
            </p>
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold leading-tight text-white mb-5">
              Find the best place to meet halfway.
            </h1>
            <p className="text-lg sm:text-xl leading-8 text-white/90 max-w-2xl mb-8">
              Enter two locations and find a fair meeting point based on real travel, then discover restaurants,
              cafes, parks, and other places near the midpoint.
            </p>
          </div>

          <form action="/" method="get" className="max-w-5xl">
            <div className="grid grid-cols-1 md:grid-cols-[1fr_1fr_auto] gap-3">
              <label className="block">
                <span className="sr-only">First location</span>
                <input
                  name="from"
                  type="text"
                  required
                  placeholder="First city, address, or place"
                  className="w-full h-12 rounded-md border border-white/20 bg-white px-4 text-base text-gray-950 shadow-sm outline-none focus:border-teal-300 focus:ring-2 focus:ring-teal-200"
                />
              </label>
              <label className="block">
                <span className="sr-only">Second location</span>
                <input
                  name="to"
                  type="text"
                  required
                  placeholder="Second city, address, or place"
                  className="w-full h-12 rounded-md border border-white/20 bg-white px-4 text-base text-gray-950 shadow-sm outline-none focus:border-teal-300 focus:ring-2 focus:ring-teal-200"
                />
              </label>
              <button
                type="submit"
                className="h-12 rounded-md bg-orange-500 px-6 text-base font-bold text-white shadow-sm hover:bg-orange-600 transition"
              >
                Find Halfway
              </button>
            </div>
          </form>

          <p className="mt-4 text-sm text-white/72">
            Useful for friends, dates, family meetups, work lunches, and road trip stops.
          </p>
        </div>
      </section>

      <HorizontalAd />

      <main>
        <section className="border-b border-gray-200 bg-white px-5 py-14">
          <div className="max-w-4xl mx-auto">
            <h2 className="text-3xl font-extrabold tracking-tight text-gray-950 mb-4">
              A fair meeting spot in seconds
            </h2>
            <p className="text-lg leading-8 text-gray-600">
              A halfway point is not always the place that looks centered on a map. Roads, bridges, highways,
              traffic, and travel mode can all change what feels fair. Split The Distance helps you find a practical
              midpoint and then choose somewhere nearby to actually meet.
            </p>
          </div>
        </section>

        <section className="bg-gray-50 px-5 py-14">
          <div className="max-w-5xl mx-auto">
            <h2 className="text-3xl font-extrabold tracking-tight text-gray-950 text-center mb-10">
              How it works
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
              {[
                ['1', 'Enter two locations', 'Use cities, addresses, landmarks, or place names.'],
                ['2', 'Calculate the midpoint', 'Find a fair point between both routes.'],
                ['3', 'Pick somewhere nearby', 'Browse restaurants, cafes, parks, bars, and activities.'],
              ].map(([num, title, text]) => (
                <div key={num} className="rounded-lg border border-gray-200 bg-white p-6">
                  <div className="w-10 h-10 rounded-full bg-teal-600 text-white font-bold flex items-center justify-center mb-4">
                    {num}
                  </div>
                  <h3 className="text-lg font-bold text-gray-950 mb-2">{title}</h3>
                  <p className="text-sm leading-6 text-gray-600">{text}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="bg-white px-5 py-14">
          <div className="max-w-5xl mx-auto grid grid-cols-1 lg:grid-cols-[0.9fr_1.1fr] gap-10 items-start">
            <div>
              <h2 className="text-3xl font-extrabold tracking-tight text-gray-950 mb-4">
                When a halfway calculator helps
              </h2>
              <p className="text-lg leading-8 text-gray-600">
                Use it whenever two people are trying to meet without one person taking on the whole drive.
              </p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {useCases.map((item) => (
                <div key={item} className="rounded-md border border-gray-200 bg-gray-50 px-4 py-3 text-sm font-medium text-gray-700">
                  {item}
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
              Ready to find your halfway point?
            </h2>
            <p className="text-lg leading-8 text-gray-600 mb-7">
              Open the calculator, enter two places, and choose a meeting spot that feels fair.
            </p>
            <Link
              href="/"
              className="inline-flex h-12 items-center justify-center rounded-md bg-teal-600 px-6 text-base font-bold text-white hover:bg-teal-700 transition"
            >
              Start Calculating
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
