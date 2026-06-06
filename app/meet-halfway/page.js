import Image from 'next/image';
import Link from 'next/link';

const situations = [
  'Meet a friend who lives in another town',
  'Plan a date without one person doing all the driving',
  'Find a family meetup spot everyone can agree on',
  'Pick a fair handoff location',
  'Choose a lunch spot between two offices',
  'Meet up during a road trip',
];

const faqs = [
  {
    question: 'How do I find somewhere to meet halfway?',
    answer:
      'Enter both starting locations and Split The Distance will calculate a practical midpoint, then show nearby places where you can actually meet.',
  },
  {
    question: 'What makes a meeting spot fair?',
    answer:
      'A fair meeting spot usually balances the trip for both people. Real driving time is often more useful than simply picking the geographic center.',
  },
  {
    question: 'Can I find cafes or restaurants near the midpoint?',
    answer:
      'Yes. Once the midpoint is calculated, you can browse restaurants, coffee shops, parks, bars, activities, and other nearby places.',
  },
  {
    question: 'Can I use this for exact addresses?',
    answer:
      'Yes. You can use exact addresses, cities, landmarks, or place names. Exact addresses usually produce the most accurate route.',
  },
];

export const metadata = {
  title: 'Meet Halfway | Find a Fair Place to Meet',
  description:
    'Find somewhere fair to meet halfway between two locations. Compare the midpoint and discover restaurants, cafes, parks, and activities nearby.',
  alternates: {
    canonical: '/meet-halfway',
  },
  openGraph: {
    title: 'Meet Halfway | Split The Distance',
    description:
      'Find a fair place to meet between two locations and discover nearby spots that work for both people.',
    url: '/meet-halfway',
    images: ['/og-image.png'],
  },
};

export default function MeetHalfwayPage() {
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
            <Link href="/about" className="hover:text-gray-900 transition">About Us</Link>
          </nav>
        </div>
      </header>

      <main>
        <section className="bg-white px-5 py-12 lg:py-16">
          <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-[1.05fr_0.95fr] gap-10 items-center">
            <div>
              <p className="text-sm font-semibold uppercase tracking-wide text-teal-700 mb-4">
                Meet Halfway
              </p>
              <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold leading-tight tracking-tight text-gray-950 mb-5">
                Find a fair place to meet without guessing.
              </h1>
              <p className="text-lg sm:text-xl leading-8 text-gray-600 mb-8">
                Enter two locations, find the midpoint, and choose somewhere nearby that works for both people.
              </p>

              <form action="/" method="get" className="rounded-lg border border-gray-200 bg-gray-50 p-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <label className="block">
                    <span className="sr-only">Your location</span>
                    <input
                      name="from"
                      type="text"
                      required
                      placeholder="Your city or address"
                      className="w-full h-12 rounded-md border border-gray-300 bg-white px-4 text-base text-gray-950 outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-100"
                    />
                  </label>
                  <label className="block">
                    <span className="sr-only">Their location</span>
                    <input
                      name="to"
                      type="text"
                      required
                      placeholder="Their city or address"
                      className="w-full h-12 rounded-md border border-gray-300 bg-white px-4 text-base text-gray-950 outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-100"
                    />
                  </label>
                </div>
                <button
                  type="submit"
                  className="mt-3 w-full h-12 rounded-md bg-teal-600 px-5 text-base font-bold text-white hover:bg-teal-700 transition"
                >
                  Find Somewhere to Meet
                </button>
              </form>
            </div>

            <div className="relative overflow-hidden rounded-lg border border-teal-900/10 bg-teal-900 aspect-[4/3] shadow-sm">
              <Image
                src="/og-image.png"
                alt="Split The Distance map pin graphic"
                fill
                sizes="(min-width: 1024px) 45vw, 100vw"
                className="object-contain"
                priority
              />
            </div>
          </div>
        </section>

        <section className="border-y border-gray-200 bg-gray-50 px-5 py-14">
          <div className="max-w-5xl mx-auto">
            <h2 className="text-3xl font-extrabold tracking-tight text-gray-950 mb-8 text-center">
              Good for all the plans that need a fair middle
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {situations.map((situation) => (
                <div key={situation} className="min-h-16 rounded-md border border-gray-200 bg-white px-4 py-4 text-sm font-semibold leading-6 text-gray-700">
                  {situation}
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="bg-white px-5 py-14">
          <div className="max-w-4xl mx-auto">
            <h2 className="text-3xl font-extrabold tracking-tight text-gray-950 mb-4">
              Why meeting halfway is not always obvious
            </h2>
            <p className="text-lg leading-8 text-gray-600 mb-5">
              The center of a map is not always the fairest place to meet. Highways, traffic, bridges, and local roads
              can make one person drive much longer than the other.
            </p>
            <p className="text-lg leading-8 text-gray-600">
              Split The Distance helps turn the vague question of where to meet into a practical choice: compare the
              midpoint, browse nearby places, and send the plan to the other person.
            </p>
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
              Find your meeting spot now
            </h2>
            <p className="text-lg leading-8 text-gray-600 mb-7">
              Use the calculator to split the trip and choose a place that feels fair.
            </p>
            <Link
              href="/"
              className="inline-flex h-12 items-center justify-center rounded-md bg-orange-500 px-6 text-base font-bold text-white hover:bg-orange-600 transition"
            >
              Find Somewhere to Meet
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
