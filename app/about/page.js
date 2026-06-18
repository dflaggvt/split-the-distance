import Link from 'next/link';

export const metadata = {
  title: 'About Us — Split The Distance',
  description: 'Learn about Split The Distance and how it helps people find fair meeting points.',
};

export default function AboutPage() {
  return (
    <div className="min-h-screen bg-white text-gray-900">
      <header className="border-b border-gray-200 bg-white">
        <div className="max-w-3xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2 text-gray-900 font-semibold text-lg hover:opacity-80 transition">
            <img src="/logo.png" alt="Split The Distance" width="24" height="24" />
            Split The Distance
          </Link>
          <nav className="flex items-center gap-6 text-sm">
            <Link href="/legal/terms" className="text-gray-500 hover:text-gray-900 transition">Terms</Link>
            <Link href="/legal/privacy" className="text-gray-500 hover:text-gray-900 transition">Privacy</Link>
            <Link href="/" className="text-teal-600 hover:text-teal-700 font-medium transition">Back to App</Link>
          </nav>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-6 py-14">
        <p className="text-sm font-semibold text-teal-700 uppercase tracking-wide mb-3">About Us</p>
        <h1 className="text-4xl font-extrabold tracking-tight text-gray-950 mb-6">
          Fair meeting spots, without the group chat math.
        </h1>

        <div className="space-y-6 text-[17px] leading-8 text-gray-600">
          <p>
            Split The Distance helps people find a practical halfway point between two places. Enter two locations,
            choose how you want to split the trip, and discover restaurants, cafes, parks, and other places near the
            midpoint.
          </p>

          <p>
            The goal is simple: make plans feel fair. Whether you are meeting a friend, planning a date, coordinating
            family, or finding a stop on the way, the app focuses on real travel time instead of guessing from a map.
          </p>

          <p>
            We care about useful defaults, clean route details, and small product choices that make decisions easier.
            Split The Distance is built for the everyday moment when everyone wants to meet up, but nobody wants to do
            the logistics.
          </p>
        </div>

        <div className="mt-10 border-t border-gray-200 pt-8">
          <Link
            href="/"
            className="inline-flex items-center justify-center rounded-md bg-teal-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-teal-700 transition"
          >
            Find a Meeting Spot
          </Link>
        </div>
      </main>

      <footer className="border-t border-gray-200 bg-gray-50">
        <div className="max-w-3xl mx-auto px-6 py-8 text-center text-sm text-gray-400">
          <div className="flex items-center justify-center gap-4 mb-2">
            <Link href="/about" className="hover:text-gray-600 transition">About Us</Link>
            <span>&middot;</span>
            <Link href="/legal/terms" className="hover:text-gray-600 transition">Terms of Use</Link>
            <span>&middot;</span>
            <Link href="/legal/privacy" className="hover:text-gray-600 transition">Privacy Policy</Link>
          </div>
          <p>Split The Distance &copy; {new Date().getFullYear()}</p>
        </div>
      </footer>
    </div>
  );
}
