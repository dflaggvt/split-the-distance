import Image from 'next/image';
import Link from 'next/link';

const examples = [
  'Find a fair handoff location between two homes',
  'Choose a restaurant between two exact addresses',
  'Meet between two offices without guessing',
  'Plan a family visit from different starting points',
  'Pick a coffee shop between two neighborhoods',
  'Split a drive using real route details',
];

const faqs = [
  {
    question: 'How do I find the halfway point between two addresses?',
    answer:
      'Enter both addresses and Split The Distance will calculate a practical midpoint, then help you find nearby places where you can meet.',
  },
  {
    question: 'Why use addresses instead of cities?',
    answer:
      'Exact addresses usually produce a more useful result because two people in the same city may still have very different routes and travel times.',
  },
  {
    question: 'Is the midpoint based on driving time?',
    answer:
      'The calculator is designed around real travel routes, which helps make the meeting point feel fairer than choosing the center of a map.',
  },
  {
    question: 'Can I find restaurants or cafes near the halfway point?',
    answer:
      'Yes. After the midpoint is calculated, you can browse nearby restaurants, cafes, parks, bars, activities, and other places to meet.',
  },
  {
    question: 'Can I use cities or landmarks instead of addresses?',
    answer:
      'Yes. Exact addresses are best for precision, but you can also enter cities, neighborhoods, landmarks, or place names.',
  },
];

export const metadata = {
  title: 'Halfway Between Two Addresses | Split The Distance',
  description:
    'Find the halfway point between two addresses and discover nearby restaurants, cafes, parks, and other places to meet.',
  alternates: {
    canonical: '/halfway-between-two-addresses',
  },
  openGraph: {
    title: 'Halfway Between Two Addresses | Split The Distance',
    description:
      'Enter two addresses, find a fair midpoint, and choose somewhere nearby to meet.',
    url: '/halfway-between-two-addresses',
    images: ['/og-image.png'],
  },
};

export default function HalfwayBetweenTwoAddressesPage() {
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
          <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-[1fr_0.95fr] gap-10 items-center">
            <div>
              <p className="text-sm font-semibold uppercase tracking-wide text-teal-700 mb-4">
                Address to Address
              </p>
              <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold leading-tight tracking-tight text-gray-950 mb-5">
                Find the halfway point between two addresses.
              </h1>
              <p className="text-lg sm:text-xl leading-8 text-gray-600 mb-8">
                Enter two exact addresses and find a fair place to meet based on real travel, then discover
                restaurants, cafes, parks, and other nearby spots.
              </p>

              <form action="/" method="get" className="rounded-lg border border-gray-200 bg-gray-50 p-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <label className="block">
                    <span className="sr-only">First address</span>
                    <input
                      name="from"
                      type="text"
                      required
                      placeholder="First address"
                      className="w-full h-12 rounded-md border border-gray-300 bg-white px-4 text-base text-gray-950 outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-100"
                    />
                  </label>
                  <label className="block">
                    <span className="sr-only">Second address</span>
                    <input
                      name="to"
                      type="text"
                      required
                      placeholder="Second address"
                      className="w-full h-12 rounded-md border border-gray-300 bg-white px-4 text-base text-gray-950 outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-100"
                    />
                  </label>
                </div>
                <button
                  type="submit"
                  className="mt-3 w-full h-12 rounded-md bg-teal-600 px-5 text-base font-bold text-white hover:bg-teal-700 transition"
                >
                  Find the Halfway Point
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
          <div className="max-w-5xl mx-auto">
            <h2 className="text-3xl font-extrabold tracking-tight text-gray-950 mb-4 text-center">
              Exact addresses make the midpoint more useful
            </h2>
            <p className="max-w-3xl mx-auto text-center text-lg leading-8 text-gray-600 mb-10">
              City centers can be miles away from where people actually start. Address-based midpoint planning helps
              account for the real routes people will drive.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {examples.map((example) => (
                <div key={example} className="min-h-16 rounded-md border border-gray-200 bg-white px-4 py-4 text-sm font-semibold leading-6 text-gray-700">
                  {example}
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="bg-white px-5 py-14">
          <div className="max-w-4xl mx-auto">
            <h2 className="text-3xl font-extrabold tracking-tight text-gray-950 mb-4">
              From midpoint to actual meeting spot
            </h2>
            <p className="text-lg leading-8 text-gray-600 mb-5">
              Finding the halfway point is only the first step. Once you know the midpoint area, Split The Distance
              helps you look for real places nearby, like restaurants, cafes, parks, bars, and activities.
            </p>
            <p className="text-lg leading-8 text-gray-600">
              That makes the result easier to use in the real world: not just coordinates, but somewhere both people
              can actually go.
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
              Calculate the midpoint between two addresses
            </h2>
            <p className="text-lg leading-8 text-gray-600 mb-7">
              Enter both addresses and find a fair place to meet.
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
