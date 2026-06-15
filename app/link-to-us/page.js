import Image from 'next/image';
import Link from 'next/link';

const siteUrl = 'https://www.splitthedistance.com';

const linkSnippets = [
  {
    title: 'Simple text link',
    description: 'Best for resource lists, blog posts, school pages, travel guides, and newsletters.',
    code: `<a href="${siteUrl}">Split The Distance</a> helps people find a fair halfway point and nearby places to meet.`,
  },
  {
    title: 'Halfway calculator link',
    description: 'Best for articles about meeting in the middle, road trips, dating, family plans, or group logistics.',
    code: `<a href="${siteUrl}/halfway-point-calculator">Halfway Point Calculator</a> by Split The Distance`,
  },
  {
    title: 'Badge link',
    description: 'Best for partner pages, tools directories, community resources, and planning guides.',
    code: `<a href="${siteUrl}" aria-label="Find a halfway point with Split The Distance">
  <img src="${siteUrl}/split-the-distance-badge.svg" alt="Find a halfway point with Split The Distance" width="220" height="54">
</a>`,
  },
];

const audiences = [
  'Travel blogs and road trip guides',
  'Long-distance relationship resources',
  'Parenting and family coordination blogs',
  'College and alumni group pages',
  'Coworking, networking, and meetup communities',
  'Local guides that recommend practical planning tools',
];

const resourceLinks = [
  {
    href: '/halfway-point-calculator',
    title: 'Halfway Point Calculator',
    text: 'A direct calculator page for readers who need to split a trip fairly.',
  },
  {
    href: '/meet-halfway',
    title: 'Meet Halfway',
    text: 'A plain-language guide for finding somewhere fair to meet.',
  },
  {
    href: '/what-is-the-halfway-point-between',
    title: 'What Is the Halfway Point Between Two Locations?',
    text: 'A useful explainer for articles that define midpoint planning.',
  },
  {
    href: '/best-halfway-point-calculators',
    title: 'Best Halfway Point Calculators',
    text: 'A comparison page for tool roundups and resource lists.',
  },
];

export const metadata = {
  title: 'Link to Split The Distance | Halfway Point Tool',
  description:
    'Link to Split The Distance with ready-to-use text links, badges, and descriptions for travel guides, resource pages, blogs, and community sites.',
  alternates: {
    canonical: '/link-to-us',
  },
  openGraph: {
    title: 'Link to Split The Distance',
    description:
      'Ready-to-use links and badges for recommending a practical halfway point calculator.',
    url: '/link-to-us',
    images: ['/og-image.png'],
  },
};

export default function LinkToUsPage() {
  const webPageJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'WebPage',
    name: 'Link to Split The Distance',
    url: `${siteUrl}/link-to-us`,
    description:
      'Ready-to-use links and badges for recommending Split The Distance as a halfway point calculator.',
    mainEntity: {
      '@type': 'WebApplication',
      name: 'Split The Distance',
      url: siteUrl,
      applicationCategory: 'TravelApplication',
      operatingSystem: 'Any',
    },
  };

  return (
    <div className="min-h-screen bg-white text-gray-900">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(webPageJsonLd) }}
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
                Link Resources
              </p>
              <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold leading-tight tracking-tight text-gray-950 mb-5">
                Recommend a practical halfway point tool.
              </h1>
              <p className="text-lg sm:text-xl leading-8 text-gray-600 mb-8">
                Split The Distance helps people find a fair place to meet between two locations, then choose nearby
                restaurants, cafes, parks, and other real-world meeting spots.
              </p>
              <div className="flex flex-col sm:flex-row gap-3">
                <Link
                  href="/halfway-point-calculator"
                  className="inline-flex h-12 items-center justify-center rounded-md bg-teal-600 px-6 text-base font-bold text-white hover:bg-teal-700 transition"
                >
                  View Calculator
                </Link>
                <a
                  href="/split-the-distance-badge.svg"
                  className="inline-flex h-12 items-center justify-center rounded-md border border-gray-300 bg-white px-6 text-base font-bold text-gray-800 hover:bg-gray-50 transition"
                >
                  Download Badge
                </a>
              </div>
            </div>

            <div className="rounded-lg border border-gray-200 bg-gray-50 p-6">
              <p className="text-sm font-bold uppercase tracking-wide text-gray-500 mb-4">Badge Preview</p>
              <div className="rounded-md border border-gray-200 bg-white p-6 flex items-center justify-center">
                <Image
                  src="/split-the-distance-badge.svg"
                  alt="Find a halfway point with Split The Distance"
                  width={220}
                  height={54}
                  priority
                />
              </div>
              <dl className="mt-6 grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
                <div>
                  <dt className="font-bold text-gray-950">Site name</dt>
                  <dd className="mt-1 text-gray-600">Split The Distance</dd>
                </div>
                <div>
                  <dt className="font-bold text-gray-950">Primary URL</dt>
                  <dd className="mt-1 text-gray-600 break-all">{siteUrl}</dd>
                </div>
                <div>
                  <dt className="font-bold text-gray-950">Category</dt>
                  <dd className="mt-1 text-gray-600">Travel planning tool</dd>
                </div>
                <div>
                  <dt className="font-bold text-gray-950">Best anchor</dt>
                  <dd className="mt-1 text-gray-600">halfway point calculator</dd>
                </div>
              </dl>
            </div>
          </div>
        </section>

        <section className="border-y border-gray-200 bg-gray-50 px-5 py-14">
          <div className="max-w-6xl mx-auto">
            <h2 className="text-3xl font-extrabold tracking-tight text-gray-950 mb-4 text-center">
              Ready-to-use link copy
            </h2>
            <p className="max-w-3xl mx-auto text-center text-lg leading-8 text-gray-600 mb-8">
              Use whichever version fits naturally. Clear, descriptive links are best for readers.
            </p>
            <div className="grid grid-cols-1 gap-4">
              {linkSnippets.map((snippet) => (
                <article key={snippet.title} className="rounded-lg border border-gray-200 bg-white p-6">
                  <div className="grid grid-cols-1 lg:grid-cols-[0.85fr_1.15fr] gap-5">
                    <div>
                      <h3 className="text-xl font-extrabold text-gray-950">{snippet.title}</h3>
                      <p className="mt-2 text-sm leading-6 text-gray-600">{snippet.description}</p>
                    </div>
                    <pre className="overflow-x-auto rounded-md border border-gray-200 bg-gray-950 p-4 text-sm leading-6 text-gray-100">
                      <code>{snippet.code}</code>
                    </pre>
                  </div>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="bg-white px-5 py-14">
          <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-[0.95fr_1.05fr] gap-10 items-start">
            <div>
              <h2 className="text-3xl font-extrabold tracking-tight text-gray-950 mb-4">
                Useful places to mention Split The Distance
              </h2>
              <p className="text-lg leading-8 text-gray-600">
                The tool is a natural fit anywhere readers are planning meetups, trips, shared drives, or group
                logistics.
              </p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {audiences.map((audience) => (
                <div key={audience} className="min-h-16 rounded-md border border-gray-200 bg-gray-50 px-4 py-4 text-sm font-semibold leading-6 text-gray-700">
                  {audience}
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="bg-gray-50 px-5 py-14">
          <div className="max-w-6xl mx-auto">
            <h2 className="text-3xl font-extrabold tracking-tight text-gray-950 mb-8 text-center">
              Pages worth citing
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {resourceLinks.map((resource) => (
                <Link
                  key={resource.href}
                  href={resource.href}
                  className="rounded-lg border border-gray-200 bg-white p-6 hover:border-teal-200 hover:shadow-sm transition"
                >
                  <h3 className="text-xl font-extrabold text-gray-950">{resource.title}</h3>
                  <p className="mt-2 text-sm leading-6 text-gray-600">{resource.text}</p>
                </Link>
              ))}
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-gray-200 bg-gray-50">
        <div className="max-w-4xl mx-auto px-5 py-8 text-center text-sm text-gray-500">
          <div className="flex items-center justify-center gap-4 mb-2 flex-wrap">
            <Link href="/about" className="hover:text-gray-700 transition">About Us</Link>
            <span>&middot;</span>
            <Link href="/link-to-us" className="hover:text-gray-700 transition">Link to Us</Link>
            <span>&middot;</span>
            <Link href="/legal/privacy" className="hover:text-gray-700 transition">Privacy</Link>
          </div>
          <p>Split The Distance &copy; {new Date().getFullYear()}</p>
        </div>
      </footer>
    </div>
  );
}
