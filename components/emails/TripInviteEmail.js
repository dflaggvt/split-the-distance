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
} from '@react-email/components';

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
        {hostName} invited you to join &quot;{tripTitle}&quot; on Split the Distance
      </Preview>
      <Body style={main}>
        <Container style={container}>
          {/* Header */}
          <Section style={header}>
            <Text style={logo}>Split the Distance</Text>
          </Section>

          {/* Content */}
          <Section style={content}>
            <Heading as="h1" style={heading}>
              You&apos;re invited!
            </Heading>
            <Text style={paragraph}>
              <strong>{hostName}</strong> has invited you to join a trip:
            </Text>

            {/* Trip card */}
            <Section style={tripCard}>
              <Heading as="h2" style={tripTitle_style}>
                {tripTitle}
              </Heading>
              {tripDescription && (
                <Text style={tripDesc}>{tripDescription}</Text>
              )}
            </Section>

            <Text style={paragraph}>
              Click the button below to view the trip details and join the group.
              You&apos;ll be able to vote on dates, locations, and help plan activities.
            </Text>

            <Section style={buttonContainer}>
              <Button style={button} href={inviteUrl}>
                View Trip & Join
              </Button>
            </Section>

            <Text style={smallText}>
              Or copy and paste this link into your browser:
            </Text>
            <Text style={linkText}>{inviteUrl}</Text>
          </Section>

          <Hr style={hr} />

          {/* Footer */}
          <Section style={footer}>
            <Text style={footerText}>
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
  backgroundColor: '#f6f9fc',
  fontFamily:
    '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Ubuntu, sans-serif',
};

const container = {
  backgroundColor: '#ffffff',
  margin: '0 auto',
  padding: '0',
  maxWidth: '560px',
  borderRadius: '12px',
  overflow: 'hidden',
  border: '1px solid #e5e7eb',
};

const header = {
  backgroundColor: '#0d9488',
  padding: '24px 32px',
  textAlign: 'center',
};

const logo = {
  color: '#ffffff',
  fontSize: '18px',
  fontWeight: '700',
  margin: '0',
  letterSpacing: '-0.5px',
};

const content = {
  padding: '32px',
};

const heading = {
  color: '#111827',
  fontSize: '24px',
  fontWeight: '700',
  margin: '0 0 16px',
  lineHeight: '1.3',
};

const paragraph = {
  color: '#374151',
  fontSize: '15px',
  lineHeight: '1.6',
  margin: '0 0 16px',
};

const tripCard = {
  backgroundColor: '#f0fdfa',
  border: '1px solid #99f6e4',
  borderRadius: '8px',
  padding: '16px 20px',
  margin: '0 0 20px',
};

const tripTitle_style = {
  color: '#0f766e',
  fontSize: '18px',
  fontWeight: '700',
  margin: '0 0 4px',
};

const tripDesc = {
  color: '#5eead4',
  fontSize: '13px',
  margin: '0',
  lineHeight: '1.4',
};

const buttonContainer = {
  textAlign: 'center',
  margin: '24px 0',
};

const button = {
  backgroundColor: '#0d9488',
  borderRadius: '8px',
  color: '#ffffff',
  fontSize: '15px',
  fontWeight: '600',
  textDecoration: 'none',
  textAlign: 'center',
  display: 'inline-block',
  padding: '12px 32px',
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
  margin: '0 0 16px',
};

const hr = {
  borderColor: '#e5e7eb',
  margin: '0',
};

const footer = {
  padding: '20px 32px',
};

const footerText = {
  color: '#9ca3af',
  fontSize: '12px',
  lineHeight: '1.5',
  margin: '0',
  textAlign: 'center',
};
