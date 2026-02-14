import Link from 'next/link';

export const metadata = {
  robots: { index: true, follow: true },
};

export default function LegalLayout({ children }) {
  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <header className="border-b border-gray-200 bg-white sticky top-0 z-10">
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

      {/* Content */}
      <main className="max-w-3xl mx-auto px-6 py-12">
        {children}
      </main>

      {/* Footer */}
      <footer className="border-t border-gray-200 bg-gray-50">
        <div className="max-w-3xl mx-auto px-6 py-8 text-center text-sm text-gray-400">
          <div className="flex items-center justify-center gap-4 mb-2">
            <Link href="/legal/terms" className="hover:text-gray-600 transition">Terms of Use</Link>
            <span>·</span>
            <Link href="/legal/privacy" className="hover:text-gray-600 transition">Privacy Policy</Link>
          </div>
          <p>Split The Distance &copy; {new Date().getFullYear()}</p>
        </div>
      </footer>
    </div>
  );
}
