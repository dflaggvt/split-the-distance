export const metadata = {
  title: 'Privacy Policy — Split The Distance',
  description: 'Privacy Policy for Split The Distance.',
};

export default function PrivacyPage() {
  return (
    <article className="legal-prose">
      <p className="text-sm text-gray-400 mb-1">Effective Date: February 9, 2026</p>
      <h1>Privacy Policy</h1>

      <p>
        This Privacy Policy (&quot;Policy&quot;) explains how Split The Distance (&quot;we,&quot; &quot;our,&quot; or
        &quot;us&quot;) collects, uses, and shares your information when you use our website at{' '}
        <a href="https://splitthedistance.com">splitthedistance.com</a> and all related services, features, and
        applications (the &quot;Service&quot;). We are committed to protecting your privacy and being transparent about
        the data we collect.
      </p>
      <p>
        <strong>
          By using the Service, you agree to the collection and use of information in accordance with this Policy. If you
          do not agree, please do not use the Service.
        </strong>
      </p>

      {/* ------------------------------------------------------------------ */}
      <h2>1. Information We Collect</h2>

      <h3>1.1 Information You Provide</h3>
      <ul>
        <li>
          <strong>Account information:</strong> When you create an account via Google sign-in or email/password, we receive your
          name, email address, and profile photo (if using Google).
        </li>
        <li>
          <strong>Payment information:</strong> If you subscribe to a paid plan, our payment processor Stripe collects
          your billing details. We do not store credit card numbers on our servers.
        </li>
        <li>
          <strong>Feature waitlist sign-ups:</strong> If you sign up for notifications about upcoming features, we
          collect your email address.
        </li>
        <li>
          <strong>Communications:</strong> If you contact us (e.g., via email), we collect the information you provide in
          those communications.
        </li>
      </ul>

      <h3>1.2 Information Collected Automatically</h3>
      <ul>
        <li>
          <strong>Location searches:</strong> When you search for a midpoint, we collect the location names and
          coordinates you enter. This data is used to provide the Service and for analytics (e.g., understanding popular
          routes). <em>We do not track your real-time GPS location.</em>
        </li>
        <li>
          <strong>Usage data:</strong> We automatically collect information about how you interact with the Service,
          including pages visited, features used (place clicks, shares, travel mode selections), referrer URLs, and
          timestamps.
        </li>
        <li>
          <strong>Device information:</strong> We collect device type (mobile, desktop, tablet), browser type, and screen
          dimensions.
        </li>
        <li>
          <strong>Session identifiers:</strong> We generate anonymous session IDs to group activity within a single visit.
          These are not tied to your identity unless you are signed in.
        </li>
        <li>
          <strong>Cookies &amp; local storage:</strong> We use browser local storage to cache route data, feature flags,
          and session tokens to improve performance. We use cookies via Google Analytics and Google Tag Manager for
          analytics purposes.
        </li>
      </ul>

      <h3>1.3 Information from Third Parties</h3>
      <ul>
        <li>
          <strong>Authentication providers:</strong> When you sign in with Google, we receive basic profile
          information (name, email, profile photo) from that provider.
        </li>
        <li>
          <strong>Payment processor:</strong> Stripe may provide us with transaction status, subscription state, and
          customer identifiers. Stripe&apos;s use of your data is governed by{' '}
          <a href="https://stripe.com/privacy" target="_blank" rel="noopener noreferrer">Stripe&apos;s Privacy Policy</a>.
        </li>
      </ul>

      {/* ------------------------------------------------------------------ */}
      <h2>2. How We Use Your Information</h2>
      <p>We use the information we collect to:</p>
      <ul>
        <li>
          <strong>Provide and improve the Service:</strong> Calculate midpoints, display nearby places, process
          subscriptions, and deliver features you request.
        </li>
        <li>
          <strong>Analytics:</strong> Understand how the Service is used so we can improve it. This includes analyzing
          search patterns, popular routes, device usage, traffic sources, and conversion funnels.
        </li>
        <li>
          <strong>Communications:</strong> Send you feature notifications you opted into, respond to support requests,
          and deliver important service updates.
        </li>
        <li>
          <strong>Security &amp; fraud prevention:</strong> Detect and prevent abuse, unauthorized access, and other
          harmful activity.
        </li>
        <li>
          <strong>Legal compliance:</strong> Comply with applicable laws, regulations, and legal processes.
        </li>
      </ul>

      {/* ------------------------------------------------------------------ */}
      <h2>3. How We Share Your Information</h2>
      <p>
        We do not sell your personal information. We share your information only in the following circumstances:
      </p>
      <ul>
        <li>
          <strong>Service providers:</strong> We share data with third-party providers that help us operate the Service,
          including:
          <ul>
            <li><strong>Supabase</strong> — database and authentication (hosted in AWS, US)</li>
            <li><strong>Stripe</strong> — payment processing</li>
            <li><strong>Google Maps Platform</strong> — maps, directions, and geocoding</li>
            <li><strong>Mapbox</strong> — place search</li>
            <li><strong>Google Analytics &amp; Google Tag Manager</strong> — web analytics</li>
            <li><strong>Vercel</strong> — hosting and deployment</li>
          </ul>
          Each provider processes data in accordance with their own privacy policies.
        </li>
        <li>
          <strong>Legal requirements:</strong> We may disclose your information if required by law, regulation, legal
          process, or governmental request.
        </li>
        <li>
          <strong>Business transfers:</strong> If we are involved in a merger, acquisition, or sale of assets, your
          information may be transferred as part of that transaction.
        </li>
        <li>
          <strong>With your consent:</strong> We may share information with your explicit consent.
        </li>
      </ul>

      {/* ------------------------------------------------------------------ */}
      <h2>4. Cookies &amp; Tracking Technologies</h2>
      <p>We use the following cookies and similar technologies:</p>

      <div className="overflow-x-auto">
        <table>
          <thead>
            <tr>
              <th>Technology</th>
              <th>Purpose</th>
              <th>Retention</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>Google Analytics (GA4)</td>
              <td>Analyze website traffic and user behavior</td>
              <td>Up to 14 months</td>
            </tr>
            <tr>
              <td>Google Tag Manager</td>
              <td>Manage analytics and marketing tags</td>
              <td>Session-based</td>
            </tr>
            <tr>
              <td>Supabase Auth</td>
              <td>Authentication session tokens</td>
              <td>Until sign-out</td>
            </tr>
            <tr>
              <td>Local Storage</td>
              <td>Cache routes, coordinates, feature flags, and session ID for performance</td>
              <td>Varies (minutes to days)</td>
            </tr>
          </tbody>
        </table>
      </div>

      <p>
        You can control cookies through your browser settings. Blocking cookies may affect the functionality of the
        Service. You can opt out of Google Analytics by installing the{' '}
        <a href="https://tools.google.com/dlpage/gaoptout" target="_blank" rel="noopener noreferrer">
          Google Analytics Opt-out Browser Add-on
        </a>.
      </p>

      {/* ------------------------------------------------------------------ */}
      <h2>5. Data Security</h2>
      <p>
        We take reasonable measures to protect your information, including:
      </p>
      <ul>
        <li>All data is transmitted over HTTPS (TLS 1.2+).</li>
        <li>Database access is protected by Row Level Security policies and encrypted at rest.</li>
        <li>Authentication is handled via OAuth 2.0 — we never see or store your Google or Apple password.</li>
        <li>Payment information is processed by Stripe and never touches our servers.</li>
        <li>Admin access to our systems requires authenticated accounts with elevated permissions.</li>
      </ul>
      <p>
        No method of transmission or storage is 100% secure. While we strive to protect your information, we cannot
        guarantee absolute security.
      </p>

      {/* ------------------------------------------------------------------ */}
      <h2>6. Data Retention</h2>
      <p>
        We retain your information for as long as necessary to provide the Service and fulfill the purposes described in
        this Policy. Specifically:
      </p>
      <ul>
        <li><strong>Account data:</strong> Retained until you delete your account.</li>
        <li><strong>Search and analytics data:</strong> Retained for up to 24 months, then aggregated or deleted.</li>
        <li><strong>Subscription data:</strong> Retained for the duration of your subscription plus any period required for tax and legal compliance.</li>
        <li><strong>Waitlist sign-ups:</strong> Retained until the feature launches or you request removal.</li>
      </ul>

      {/* ------------------------------------------------------------------ */}
      <h2>7. Your Rights &amp; Choices</h2>
      <p>Depending on your location, you may have the following rights:</p>
      <ul>
        <li><strong>Access:</strong> Request a copy of the personal information we hold about you.</li>
        <li><strong>Correction:</strong> Request correction of inaccurate information.</li>
        <li><strong>Deletion:</strong> Request deletion of your account and associated data.</li>
        <li><strong>Portability:</strong> Request your data in a machine-readable format.</li>
        <li><strong>Opt-out of marketing:</strong> Unsubscribe from any promotional emails at any time.</li>
        <li><strong>Cookie preferences:</strong> Control cookies through your browser settings.</li>
      </ul>
      <p>
        To exercise any of these rights, contact us at{' '}
        <a href="mailto:support@splitthedistance.com">support@splitthedistance.com</a>. We will respond within 30 days.
      </p>

      {/* ------------------------------------------------------------------ */}
      <h2>8. Children&apos;s Privacy</h2>
      <p>
        The Service is not directed to children under 13. We do not knowingly collect personal information from children
        under 13. If you believe a child has provided us with personal information, please contact us and we will take
        steps to delete it.
      </p>

      {/* ------------------------------------------------------------------ */}
      <h2>9. International Users</h2>
      <p>
        The Service is operated from the United States. If you access the Service from outside the U.S., your information
        may be transferred to and processed in the U.S. By using the Service, you consent to this transfer. If you are
        located in the European Economic Area (EEA) or United Kingdom (UK), we process your data on the basis of
        contractual necessity, legitimate interests, or your consent, as applicable.
      </p>

      {/* ------------------------------------------------------------------ */}
      <h2>10. Changes to This Policy</h2>
      <p>
        We may update this Policy from time to time. If we make material changes, we will notify you by posting the
        revised Policy on the Service and updating the &quot;Effective Date&quot; above. We encourage you to review this
        Policy periodically.
      </p>

      {/* ------------------------------------------------------------------ */}
      <h2>11. Contact Us</h2>
      <p>
        If you have questions or concerns about this Privacy Policy or our data practices, please contact us at:
      </p>
      <ul>
        <li>Email: <a href="mailto:support@splitthedistance.com">support@splitthedistance.com</a></li>
      </ul>
    </article>
  );
}
