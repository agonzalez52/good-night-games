import type { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = {
  title: 'Privacy Policy | Good Night Games',
  description:
    'How Good Night Games collects and uses data for Survey Showdown accounts, gameplay, payments, cookies, and Google AdSense advertising.',
}

const sectionEyebrow: React.CSSProperties = {
  fontFamily: 'var(--font-display)',
  fontSize: 10,
  letterSpacing: '0.18em',
  color: 'var(--text-faint)',
  textTransform: 'uppercase',
  marginBottom: 8,
}

const headingStyle: React.CSSProperties = {
  fontFamily: 'var(--font-display)',
  fontSize: 'clamp(1.35rem, 3.5vw, 1.75rem)',
  fontWeight: 700,
  color: 'var(--text)',
  margin: '0 0 12px',
}

const bodyStyle: React.CSSProperties = {
  fontFamily: 'var(--font-body)',
  fontSize: 15,
  lineHeight: 1.65,
  color: 'var(--text-muted)',
  margin: '0 0 16px',
}

const listStyle: React.CSSProperties = {
  ...bodyStyle,
  paddingLeft: 20,
  marginBottom: 20,
}

const linkStyle: React.CSSProperties = {
  color: 'var(--blue)',
  textDecoration: 'underline',
  textUnderlineOffset: 3,
}

export default function PrivacyPage() {
  return (
    <div
      style={{
        minHeight: '100vh',
        background: 'var(--bg)',
        color: 'var(--text)',
        padding: 'clamp(20px, 5vw, 48px)',
        paddingBottom: 56,
      }}
    >
      <header
        style={{
          maxWidth: 720,
          margin: '0 auto 40px',
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'baseline',
          justifyContent: 'space-between',
          gap: 16,
        }}
      >
        <p style={{ ...sectionEyebrow, marginBottom: 0 }}>Legal</p>
        <Link
          href="/survey-showdown"
          style={{
            ...linkStyle,
            fontFamily: 'var(--font-display)',
            fontSize: 13,
            fontWeight: 600,
          }}
        >
          Back to Survey Showdown
        </Link>
      </header>

      <article style={{ maxWidth: 720, margin: '0 auto' }}>
        <h1
          style={{
            fontFamily: 'var(--font-display)',
            fontSize: 'clamp(1.75rem, 5vw, 2.25rem)',
            fontWeight: 800,
            color: 'var(--text)',
            margin: '0 0 8px',
            letterSpacing: '-0.02em',
          }}
        >
          Privacy Policy
        </h1>
        <p style={{ ...bodyStyle, color: 'var(--text-faint)', fontSize: 13, marginBottom: 32 }}>
          Last updated: May 8, 2026. This policy describes the Good Night Games website and Survey
          Showdown.
        </p>

        <section style={{ marginBottom: 36 }}>
          <p style={sectionEyebrow}>Overview</p>
          <h2 style={headingStyle}>Who we are</h2>
          <p style={bodyStyle}>
            Good Night Games operates this site and the Survey Showdown game. When this policy says
            &quot;we&quot; or &quot;us,&quot; it refers to that service.
          </p>
        </section>

        <section style={{ marginBottom: 36 }}>
          <p style={sectionEyebrow}>Data we collect</p>
          <h2 style={headingStyle}>Information you provide and we process</h2>
          <p style={bodyStyle}>
            Depending on how you use the product, we may process:
          </p>
          <ul style={listStyle}>
            <li style={{ marginBottom: 10 }}>
              <strong style={{ color: 'var(--text)' }}>Account data.</strong> If you create an
              account, we process information needed to authenticate you (for example, email address
              and credentials handled by our auth provider) and profile details you choose, such as
              a display name or username.
            </li>
            <li style={{ marginBottom: 10 }}>
              <strong style={{ color: 'var(--text)' }}>Gameplay and content.</strong> We process data
              generated when you play Survey Showdown, including session activity, scores and
              outcomes, custom survey content you save, and related game history needed to run the
              product.
            </li>
            <li style={{ marginBottom: 10 }}>
              <strong style={{ color: 'var(--text)' }}>Purchases.</strong> If you buy token packs or
              other paid items, our payment processor receives the information required to complete
              the transaction; we receive limited purchase and entitlement data needed to credit
              your account.
            </li>
            <li style={{ marginBottom: 10 }}>
              <strong style={{ color: 'var(--text)' }}>Support and feedback.</strong> If you contact
              us or submit in-product feedback, we process the contents of that message and any
              contact details you include.
            </li>
            <li>
              <strong style={{ color: 'var(--text)' }}>Referrals.</strong> If you use referral
              features, we process referral codes and related eligibility data described in the
              product.
            </li>
          </ul>
          <p style={bodyStyle}>
            We also receive standard technical data from browsers and devices (such as IP address,
            general location derived from IP, user agent, and timestamps) through our hosting,
            security, and service providers. We may use aggregated or de-identified analytics to
            understand traffic and reliability.
          </p>
        </section>

        <section style={{ marginBottom: 36 }}>
          <p style={sectionEyebrow}>Cookies &amp; similar tech</p>
          <h2 style={headingStyle}>How we use cookies</h2>
          <p style={bodyStyle}>
            We and our vendors use cookies, local storage, and similar technologies where needed to
            operate the site—for example, to keep you signed in, remember preferences, protect
            against abuse, and measure basic usage. Third parties that power authentication,
            payments, or advertising may set their own cookies or read information in accordance
            with their policies.
          </p>
        </section>

        <section style={{ marginBottom: 36 }}>
          <p style={sectionEyebrow}>Advertising</p>
          <h2 style={headingStyle}>Google AdSense and advertising cookies</h2>
          <p style={bodyStyle}>
            When advertising is enabled on the site, we may use Google AdSense (Google LLC) to show
            ads. Google may use cookies and similar technologies to serve and measure ads,
            personalize content and ads (depending on your settings and applicable law), and limit how
            often you see an ad. Google&apos;s use of advertising cookies enables it and its
            partners to serve ads based on your visits to this site and/or other sites on the
            Internet.
          </p>
          <p style={bodyStyle}>
            You can learn more about how Google uses data when you use our partners&apos; sites or
            apps in Google&apos;s policy documentation, and you can manage ad personalization in
            your Google account or industry opt-out tools where available.
          </p>
          <p style={bodyStyle}>
            We do not sell your personal information. Advertising partners may process data as
            independent controllers or processors according to their own policies and your choices.
          </p>
        </section>

        <section style={{ marginBottom: 36 }}>
          <p style={sectionEyebrow}>Use &amp; sharing</p>
          <h2 style={headingStyle}>Why we process data and who receives it</h2>
          <p style={bodyStyle}>
            We use the information above to provide and improve Survey Showdown, authenticate
            users, process purchases, prevent fraud and abuse, respond to you, comply with law, and
            communicate important service notices. We share data with service providers that help us
            run the product (such as hosting, authentication, payments, email, analytics, security,
            and when enabled, advertising). Those providers are contractually or legally required to
            protect the data and use it only for the services they provide to us.
          </p>
        </section>

        <section style={{ marginBottom: 36 }}>
          <p style={sectionEyebrow}>Retention</p>
          <h2 style={headingStyle}>How long we keep information</h2>
          <p style={bodyStyle}>
            We retain information for as long as your account is active, as needed to provide the
            service, and as required for legal, tax, or security purposes. Game history and similar
            records may be kept for a limited rolling window or until you delete associated content,
            consistent with how the product is built.
          </p>
        </section>

        <section style={{ marginBottom: 36 }}>
          <p style={sectionEyebrow}>Your choices</p>
          <h2 style={headingStyle}>Control and contact</h2>
          <p style={bodyStyle}>
            You can review and update certain account information in the product where available, sign
            out to clear session access on a shared device, and use browser controls to block or
            delete cookies (which may affect how the site or sign-in works). You may opt out of
            certain ad personalization through your Google settings or other tools offered by ad
            networks.
          </p>
          <p style={bodyStyle}>
            For privacy questions or requests regarding this policy, contact us at{' '}
            <a href="mailto:support@goodnightgames.app" style={linkStyle}>
              support@goodnightgames.app
            </a>
            .
          </p>
        </section>

        <section>
          <p style={sectionEyebrow}>Updates</p>
          <h2 style={headingStyle}>Changes to this policy</h2>
          <p style={{ ...bodyStyle, marginBottom: 0 }}>
            We may update this policy when our practices or the product changes. We will post the
            revised version on this page and adjust the &quot;Last updated&quot; date above.
          </p>
        </section>
      </article>
    </div>
  )
}
