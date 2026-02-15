/**
 * TripInviteEmail — React Email template for trip invitations.
 *
 * Rendered server-side by Resend. Uses @react-email/components
 * for cross-client email compatibility.
 */

import {
  Html,
  Head,
  Body,
  Container,
  Section,
  Text,
  Button,
  Hr,
  Preview,
  Heading,
  Img,
  Link,
  Row,
  Column,
} from '@react-email/components';

const LOGO_URL = 'https://splitthedistance.com/logo.png';
const SITE_URL = 'https://splitthedistance.com';

export default function TripInviteEmail({
  tripTitle = 'A Trip',
  hostName = 'Someone',
  inviteUrl = '',
  tripDescription = '',
}) {
  return (
    <Html>
      <Head />
      <Preview>
        {hostName} invited you to &quot;{tripTitle}&quot; — join the group on Split the Distance
      </Preview>
      <Body style={main}>
        <Container style={container}>
          {/* Header with gradient + logo */}
          <Section style={header}>
            <Section style={headerContent}>
              <Img
                src={LOGO_URL}
                width="44"
                height="44"
                alt="Split the Distance"
                style={logoImg}
              />
              <Text style={logoText}>Split the Distance</Text>
            </Section>
          </Section>

          {/* Main content */}
          <Section style={content}>
            <Section style={heroSection}>
              <Text style={heroEmoji}>🗺️</Text>
              <Heading as="h1" style={heading}>
                You&apos;re invited on a trip!
              </Heading>
            </Section>

            <Text style={paragraph}>
              <strong style={hostNameStyle}>{hostName}</strong> wants you to join a trip they&apos;re
              planning. You&apos;ll be able to vote on dates, suggest places, and help
              build the itinerary together.
            </Text>

            {/* Trip card */}
            <Section style={tripCard}>
              <Row>
                <Column style={tripIconCol}>
                  <Text style={tripIcon}>✈️</Text>
                </Column>
                <Column style={tripDetailsCol}>
                  <Heading as="h2" style={tripTitleStyle}>
                    {tripTitle}
                  </Heading>
                  {tripDescription && (
                    <Text style={tripDesc}>{tripDescription}</Text>
                  )}
                </Column>
              </Row>
            </Section>

            {/* CTA button */}
            <Section style={buttonContainer}>
              <Button style={button} href={inviteUrl}>
                View Trip &amp; Join
              </Button>
            </Section>

            <Text style={subText}>
              One tap and you&apos;re in. No app download required.
            </Text>

            <Hr style={divider} />

            {/* Fallback link */}
            <Text style={smallText}>
              Or copy and paste this link into your browser:
            </Text>
            <Text style={linkText}>{inviteUrl}</Text>
          </Section>

          {/* Footer */}
          <Section style={footer}>
            <Img
              src={LOGO_URL}
              width="24"
              height="24"
              alt="Split the Distance"
              style={footerLogo}
            />
            <Text style={footerBrand}>
              <Link href={SITE_URL} style={footerLink}>
                Split the Distance
              </Link>
            </Text>
            <Text style={footerTagline}>
              Find your halfway point. Plan the perfect meetup.
            </Text>
            <Hr style={footerDivider} />
            <Text style={footerDisclaimer}>
              This invite was sent via Split the Distance. If you don&apos;t
              recognize this invitation, you can safely ignore this email.
            </Text>
          </Section>
        </Container>
      </Body>
    </Html>
  );
}

// ---------------------------------------------------------------------------
// Styles (inline for email client compatibility)
// ---------------------------------------------------------------------------

const main = {
  backgroundColor: '#f3f4f6',
  fontFamily:
    '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Ubuntu, sans-serif',
  padding: '24px 0',
};

const container = {
  backgroundColor: '#ffffff',
  margin: '0 auto',
  padding: '0',
  maxWidth: '520px',
  borderRadius: '16px',
  overflow: 'hidden',
  boxShadow: '0 4px 12px rgba(0, 0, 0, 0.08)',
};

const header = {
  background: 'linear-gradient(135deg, #0d9488 0%, #0f766e 60%, #115e59 100%)',
  padding: '32px 32px 28px',
  textAlign: 'center',
};

const headerContent = {
  textAlign: 'center',
};

const logoImg = {
  margin: '0 auto 8px',
  display: 'block',
  borderRadius: '10px',
};

const logoText = {
  color: '#ffffff',
  fontSize: '20px',
  fontWeight: '700',
  margin: '0',
  letterSpacing: '-0.5px',
};

const content = {
  padding: '36px 32px 24px',
};

const heroSection = {
  textAlign: 'center',
  marginBottom: '24px',
};

const heroEmoji = {
  fontSize: '40px',
  margin: '0 0 8px',
  lineHeight: '1',
};

const heading = {
  color: '#111827',
  fontSize: '26px',
  fontWeight: '800',
  margin: '0',
  lineHeight: '1.2',
};

const paragraph = {
  color: '#4b5563',
  fontSize: '15px',
  lineHeight: '1.7',
  margin: '0 0 24px',
};

const hostNameStyle = {
  color: '#111827',
};

const tripCard = {
  backgroundColor: '#f0fdfa',
  border: '2px solid #99f6e4',
  borderRadius: '12px',
  padding: '20px',
  margin: '0 0 28px',
};

const tripIconCol = {
  width: '48px',
  verticalAlign: 'top',
  paddingRight: '12px',
};

const tripIcon = {
  fontSize: '28px',
  margin: '0',
  lineHeight: '1',
};

const tripDetailsCol = {
  verticalAlign: 'top',
};

const tripTitleStyle = {
  color: '#0f766e',
  fontSize: '20px',
  fontWeight: '700',
  margin: '0 0 4px',
  lineHeight: '1.3',
};

const tripDesc = {
  color: '#5eead4',
  fontSize: '14px',
  margin: '0',
  lineHeight: '1.5',
};

const buttonContainer = {
  textAlign: 'center',
  margin: '0 0 12px',
};

const button = {
  background: 'linear-gradient(135deg, #0d9488 0%, #0f766e 100%)',
  backgroundColor: '#0d9488',
  borderRadius: '12px',
  color: '#ffffff',
  fontSize: '16px',
  fontWeight: '700',
  textDecoration: 'none',
  textAlign: 'center',
  display: 'inline-block',
  padding: '14px 48px',
  letterSpacing: '0.3px',
};

const subText = {
  color: '#9ca3af',
  fontSize: '13px',
  textAlign: 'center',
  margin: '0 0 24px',
};

const divider = {
  borderColor: '#f3f4f6',
  margin: '0 0 16px',
};

const smallText = {
  color: '#9ca3af',
  fontSize: '12px',
  margin: '0 0 4px',
};

const linkText = {
  color: '#0d9488',
  fontSize: '12px',
  wordBreak: 'break-all',
  margin: '0',
  textDecoration: 'underline',
};

const footer = {
  backgroundColor: '#f9fafb',
  padding: '24px 32px',
  textAlign: 'center',
};

const footerLogo = {
  margin: '0 auto 8px',
  display: 'block',
  opacity: '0.7',
};

const footerBrand = {
  margin: '0 0 2px',
  fontSize: '13px',
  fontWeight: '600',
};

const footerLink = {
  color: '#0d9488',
  textDecoration: 'none',
};

const footerTagline = {
  color: '#9ca3af',
  fontSize: '12px',
  margin: '0 0 16px',
  fontStyle: 'italic',
};

const footerDivider = {
  borderColor: '#e5e7eb',
  margin: '0 0 16px',
};

const footerDisclaimer = {
  color: '#d1d5db',
  fontSize: '11px',
  lineHeight: '1.5',
  margin: '0',
};
