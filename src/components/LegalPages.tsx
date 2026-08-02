import React from 'react';

interface LegalPagesProps {
  page: 'about' | 'contact' | 'privacy' | 'terms' | 'refund' | 'checkout';
  onBack?: () => void;
}

const RED = '#DC2626';
const AMBER = '#F59E0B';
const LIGHT_BG = '#F9FAFB';
const CARD_BG = '#FFFFFF';
const TEXT_DARK = '#111827';
const TEXT_MED = '#374151';
const TEXT_LIGHT = '#6B7280';
const BORDER_LIGHT = '#E5E7EB';

const containerStyle: React.CSSProperties = {
  minHeight: '100vh',
  backgroundColor: LIGHT_BG,
  padding: '24px 16px',
  fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
};

const cardStyle: React.CSSProperties = {
  backgroundColor: CARD_BG,
  borderRadius: '16px',
  boxShadow: '0 1px 3px rgba(0,0,0,0.08), 0 4px 12px rgba(0,0,0,0.04)',
  padding: '32px 24px',
  maxWidth: '800px',
  margin: '0 auto',
  border: `1px solid ${BORDER_LIGHT}`,
};

const backBtnStyle: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: '6px',
  padding: '8px 16px',
  borderRadius: '10px',
  border: `1px solid ${BORDER_LIGHT}`,
  backgroundColor: '#FFFFFF',
  color: TEXT_MED,
  fontSize: '14px',
  fontWeight: 500,
  cursor: 'pointer',
  marginBottom: '24px',
  transition: 'all 0.15s ease',
};

const titleStyle: React.CSSProperties = {
  fontSize: '28px',
  fontWeight: 700,
  color: TEXT_DARK,
  marginBottom: '8px',
  letterSpacing: '-0.02em',
};

const subtitleStyle: React.CSSProperties = {
  fontSize: '14px',
  color: TEXT_LIGHT,
  marginBottom: '28px',
  fontWeight: 500,
};

const sectionTitleStyle: React.CSSProperties = {
  fontSize: '16px',
  fontWeight: 700,
  color: RED,
  marginBottom: '8px',
  marginTop: '24px',
};

const bodyTextStyle: React.CSSProperties = {
  fontSize: '15px',
  lineHeight: 1.7,
  color: TEXT_MED,
};

const labelStyle: React.CSSProperties = {
  fontSize: '12px',
  fontWeight: 600,
  color: TEXT_LIGHT,
  textTransform: 'uppercase' as const,
  letterSpacing: '0.05em',
  marginBottom: '4px',
};

const valueStyle: React.CSSProperties = {
  fontSize: '15px',
  color: TEXT_DARK,
  fontWeight: 500,
};

const contactCardStyle: React.CSSProperties = {
  backgroundColor: '#FEFCE8',
  borderRadius: '12px',
  padding: '16px 20px',
  border: `1px solid ${AMBER}33`,
  marginBottom: '12px',
};

const dividerStyle: React.CSSProperties = {
  height: '1px',
  backgroundColor: BORDER_LIGHT,
  margin: '20px 0',
};

const stepContainerStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  gap: '0',
};

const stepStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  position: 'relative',
};

const circleStyle: React.CSSProperties = {
  width: '40px',
  height: '40px',
  borderRadius: '50%',
  backgroundColor: AMBER,
  color: '#FFFFFF',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  fontWeight: 700,
  fontSize: '16px',
  boxShadow: '0 2px 8px rgba(245,158,11,0.3)',
  zIndex: 1,
};

const lineStyle: React.CSSProperties = {
  width: '2px',
  height: '28px',
  backgroundColor: `${AMBER}66`,
};

const stepLabelStyle: React.CSSProperties = {
  fontSize: '14px',
  fontWeight: 600,
  color: TEXT_DARK,
  marginTop: '6px',
  textAlign: 'center' as const,
  maxWidth: '180px',
};

function BackButton({ onBack }: { onBack?: () => void }) {
  return (
    <button
      style={backBtnStyle}
      onClick={onBack}
      onMouseEnter={(e) => {
        e.currentTarget.style.borderColor = RED;
        e.currentTarget.style.color = RED;
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.borderColor = BORDER_LIGHT;
        e.currentTarget.style.color = TEXT_MED;
      }}
    >
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="15 18 9 12 15 6" />
      </svg>
      Back
    </button>
  );
}

function AboutPage() {
  return (
    <>
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '4px' }}>
        <div style={{ width: '48px', height: '48px', borderRadius: '14px', backgroundColor: RED, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="16" x2="12" y2="12" />
            <line x1="12" y1="8" x2="12.01" y2="8" />
          </svg>
        </div>
        <div>
          <h1 style={titleStyle}>About Esc(Q)</h1>
          <p style={subtitleStyle}>Smart Campus Canteen Platform</p>
        </div>
      </div>

      <div style={dividerStyle} />

      <p style={bodyTextStyle}>
        Esc(Q) is a Smart Campus Canteen Platform developed and operated by AUTO HUB SOLUTION (AHS).
        The platform enables students, faculty members, educational institutions, and participating canteens to browse digital menus,
        place food orders, make secure online payments, receive real-time order updates, and collect food efficiently through a digital ordering system.
      </p>

      <div style={{ ...sectionTitleStyle, marginTop: '28px' }}>Our Mission</div>
      <p style={bodyTextStyle}>
        Our mission is to modernize campus dining by reducing waiting time, improving operational efficiency, minimizing food wastage,
        and delivering a seamless digital food ordering experience.
      </p>

      <div style={dividerStyle} />

      <div style={{ ...sectionTitleStyle, marginTop: '20px' }}>Parent Organization</div>
      <p style={bodyTextStyle}>
        AUTO HUB SOLUTION (AHS) is an MSME (Udyam) registered technology enterprise focused on developing software products,
        automation systems, AI-powered solutions, and digital platforms for educational institutions and businesses.
      </p>
      <p style={{ ...bodyTextStyle, marginTop: '12px' }}>
        Esc(Q) is one of the software products developed and maintained under AUTO HUB SOLUTION (AHS).
      </p>
    </>
  );
}

function ContactPage() {
  const items = [
    { label: 'Legal Entity', value: 'AUTO HUB SOLUTION (AHS)' },
    { label: 'Support Email', value: 'escqsupportemail@gmail.com' },
    { label: 'Business Email', value: 'ahsglobalservices@gmail.com' },
    { label: 'Alternative Email', value: 'autohubsolution777@gmail.com' },
    { label: 'Support Mobile', value: '+91 9940918442' },
    { label: 'Support Hours', value: 'Mon–Sat, 9:00 AM – 6:00 PM IST' },
  ];

  return (
    <>
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '4px' }}>
        <div style={{ width: '48px', height: '48px', borderRadius: '14px', backgroundColor: RED, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
            <polyline points="22,6 12,13 2,6" />
          </svg>
        </div>
        <div>
          <h1 style={titleStyle}>Contact Us</h1>
          <p style={subtitleStyle}>Get in touch with our team</p>
        </div>
      </div>

      <div style={dividerStyle} />

      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        {items.map((item, i) => (
          <div key={i} style={contactCardStyle}>
            <div style={labelStyle}>{item.label}</div>
            <div style={valueStyle}>{item.value}</div>
          </div>
        ))}
      </div>
    </>
  );
}

function PrivacyPage() {
  return (
    <>
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '4px' }}>
        <div style={{ width: '48px', height: '48px', borderRadius: '14px', backgroundColor: RED, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
            <path d="M7 11V7a5 5 0 0110 0v4" />
          </svg>
        </div>
        <div>
          <h1 style={titleStyle}>Privacy Policy</h1>
          <p style={subtitleStyle}>Effective Date: January 2026</p>
        </div>
      </div>

      <div style={dividerStyle} />

      <p style={bodyTextStyle}>
        This Privacy Policy describes how AUTO HUB SOLUTION (AHS) ("we," "us," or "our") collects, uses, stores, and protects
        your personal information when you use the Esc(Q) platform and related services.
      </p>

      <h3 style={sectionTitleStyle}>1. Information We Collect</h3>
      <p style={bodyTextStyle}>
        <strong>Account Information:</strong> Name, email address, mobile number, college/institution name, and student or staff ID when you register.
      </p>
      <p style={{ ...bodyTextStyle, marginTop: '8px' }}>
        <strong>Order Data:</strong> Food orders, cart items, payment confirmations, and order history.
      </p>
      <p style={{ ...bodyTextStyle, marginTop: '8px' }}>
        <strong>Device & Usage Data:</strong> Browser type, device information, IP address, and interaction logs for analytics and security.
      </p>

      <h3 style={sectionTitleStyle}>2. How We Use Your Information</h3>
      <p style={bodyTextStyle}>
        We use your data to process orders, manage your account, communicate order updates, improve the platform experience,
        generate analytics for participating canteens, and ensure platform security.
      </p>

      <h3 style={sectionTitleStyle}>3. Data Sharing</h3>
      <p style={bodyTextStyle}>
        We do not sell your personal data. Your information is shared only with participating canteens for order fulfillment,
        payment gateways for secure transactions, and government authorities when legally required.
      </p>

      <h3 style={sectionTitleStyle}>4. Data Security</h3>
      <p style={bodyTextStyle}>
        We implement industry-standard encryption, secure servers, and access controls. However, no system is 100% secure,
        and we encourage users to maintain strong password practices.
      </p>

      <h3 style={sectionTitleStyle}>5. Your Rights</h3>
      <p style={bodyTextStyle}>
        You may request access to, correction of, or deletion of your personal data by contacting our support team.
        Account deletion requests will be processed within 30 business days.
      </p>

      <h3 style={sectionTitleStyle}>6. Cookies & Tracking</h3>
      <p style={bodyTextStyle}>
        We use essential cookies for platform functionality and optional analytics cookies to improve user experience.
        You may disable non-essential cookies through your browser settings.
      </p>

      <h3 style={sectionTitleStyle}>7. Policy Updates</h3>
      <p style={bodyTextStyle}>
        We may update this Privacy Policy from time to time. Continued use of the platform after updates constitutes acceptance of the revised policy.
      </p>

      <h3 style={sectionTitleStyle}>8. Contact Us</h3>
      <p style={bodyTextStyle}>
        For privacy-related inquiries, contact us at escqsupportemail@gmail.com.
      </p>
    </>
  );
}

function TermsPage() {
  return (
    <>
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '4px' }}>
        <div style={{ width: '48px', height: '48px', borderRadius: '14px', backgroundColor: RED, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
            <polyline points="14 2 14 8 20 8" />
            <line x1="16" y1="13" x2="8" y2="13" />
            <line x1="16" y1="17" x2="8" y2="17" />
            <polyline points="10 9 9 9 8 9" />
          </svg>
        </div>
        <div>
          <h1 style={titleStyle}>Terms &amp; Conditions</h1>
          <p style={subtitleStyle}>Effective Date: January 2026</p>
        </div>
      </div>

      <div style={dividerStyle} />

      <p style={bodyTextStyle}>
        These Terms &amp; Conditions govern your use of the Esc(Q) platform operated by AUTO HUB SOLUTION (AHS).
        By accessing or using Esc(Q), you agree to be bound by these terms.
      </p>

      <h3 style={sectionTitleStyle}>1. Eligibility</h3>
      <p style={bodyTextStyle}>
        Esc(Q) is intended for students, faculty, and staff of educational institutions with active canteen partnerships.
        Users must be at least 16 years of age to create an account.
      </p>

      <h3 style={sectionTitleStyle}>2. Account Responsibility</h3>
      <p style={bodyTextStyle}>
        You are responsible for maintaining the confidentiality of your account credentials.
        You agree to provide accurate information during registration and to update it as needed.
      </p>

      <h3 style={sectionTitleStyle}>3. Orders &amp; Payments</h3>
      <p style={bodyTextStyle}>
        All orders placed through Esc(Q) are subject to item availability. Prices displayed are inclusive of applicable taxes
        unless stated otherwise. Payments are processed through secure third-party payment gateways.
      </p>

      <h3 style={sectionTitleStyle}>4. Order Cancellation</h3>
      <p style={bodyTextStyle}>
        Orders may be cancelled by the user before the kitchen begins preparation. Once food preparation has started,
        cancellation may not be possible. The canteen reserves the right to cancel orders due to unforeseen circumstances.
      </p>

      <h3 style={sectionTitleStyle}>5. User Conduct</h3>
      <p style={bodyTextStyle}>
        Users shall not misuse the platform, attempt unauthorized access, provide false order information,
        or engage in any activity that disrupts the service. Violations may result in account suspension.
      </p>

      <h3 style={sectionTitleStyle}>6. Intellectual Property</h3>
      <p style={bodyTextStyle}>
        All content, logos, designs, and software on Esc(Q) are the intellectual property of AUTO HUB SOLUTION (AHS).
        Unauthorized reproduction or distribution is prohibited.
      </p>

      <h3 style={sectionTitleStyle}>7. Limitation of Liability</h3>
      <p style={bodyTextStyle}>
        Esc(Q) acts as an intermediary between students and canteens. We are not liable for food quality, hygiene,
        or delivery delays caused by participating canteens. Our liability is limited to the transaction amount paid.
      </p>

      <h3 style={sectionTitleStyle}>8. Modifications</h3>
      <p style={bodyTextStyle}>
        We reserve the right to modify these terms at any material time. Users will be notified of significant changes
        through the platform. Continued use after changes constitutes acceptance.
      </p>

      <h3 style={sectionTitleStyle}>9. Governing Law</h3>
      <p style={bodyTextStyle}>
        These terms are governed by the laws of India. Any disputes shall be subject to the exclusive jurisdiction
        of courts in Tamil Nadu, India.
      </p>
    </>
  );
}

function RefundPage() {
  return (
    <>
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '4px' }}>
        <div style={{ width: '48px', height: '48px', borderRadius: '14px', backgroundColor: RED, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="1 4 1 10 7 10" />
            <path d="M3.51 15a9 9 0 102.13-9.36L1 10" />
          </svg>
        </div>
        <div>
          <h1 style={titleStyle}>Refund &amp; Cancellation Policy</h1>
          <p style={subtitleStyle}>Effective Date: January 2026</p>
        </div>
      </div>

      <div style={dividerStyle} />

      <p style={bodyTextStyle}>
        This policy outlines the conditions under which refunds and cancellations are processed on the Esc(Q) platform,
        operated by AUTO HUB SOLUTION (AHS).
      </p>

      <h3 style={sectionTitleStyle}>1. Order Cancellation by User</h3>
      <p style={bodyTextStyle}>
        You may cancel an order at no charge if the kitchen has not yet started food preparation.
        Once preparation has begun, cancellation is no longer available through the app.
      </p>

      <h3 style={sectionTitleStyle}>2. Cancellation by Canteen</h3>
      <p style={bodyTextStyle}>
        If a canteen is unable to fulfill an order (e.g., item out of stock, equipment failure), the order will be
        cancelled and a full refund will be initiated to the original payment method within 5–7 business days.
      </p>

      <h3 style={sectionTitleStyle}>3. Refund Eligibility</h3>
      <p style={bodyTextStyle}>
        Refunds are applicable for: duplicate charges, orders not received after successful payment,
        incorrect items delivered, or orders cancelled by the canteen. Refund requests must be raised within 24 hours of the transaction.
      </p>

      <h3 style={sectionTitleStyle}>4. Refund Process</h3>
      <p style={bodyTextStyle}>
        Approved refunds are processed to the original payment method. UPI and card refunds typically reflect within 5–7 business days.
        Wallet credits, if applicable, are instant.
      </p>

      <h3 style={sectionTitleStyle}>5. Non-Refundable Situations</h3>
      <p style={bodyTextStyle}>
        Refunds are not applicable for: orders successfully delivered, change of mind after food preparation,
        complaints about taste or portion size (unless verified quality issue), or orders placed with incorrect details by the user.
      </p>

      <h3 style={sectionTitleStyle}>6. Dispute Resolution</h3>
      <p style={bodyTextStyle}>
        For refund disputes, contact escqsupportemail@gmail.com with your order ID and issue description.
        Our support team will respond within 48 hours and resolve disputes within 7 business days.
      </p>
    </>
  );
}

function CheckoutPage() {
  const steps = [
    'Student',
    'Browse Menu',
    'Add Items to Cart',
    'Review Cart',
    'Proceed to Payment',
    'Complete Secure Payment',
    'Payment Verification',
    'Order Confirmation',
    'Kitchen Receives Order',
    'Food Preparation',
    'Ready Notification',
    'Student Collects Food',
  ];

  return (
    <>
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '4px' }}>
        <div style={{ width: '48px', height: '48px', borderRadius: '14px', backgroundColor: RED, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="1" y="4" width="22" height="16" rx="2" ry="2" />
            <line x1="1" y1="10" x2="23" y2="10" />
          </svg>
        </div>
        <div>
          <h1 style={titleStyle}>Payment Checkout Flow</h1>
          <p style={subtitleStyle}>How your order moves from selection to collection</p>
        </div>
      </div>

      <div style={dividerStyle} />

      <div style={stepContainerStyle}>
        {steps.map((step, i) => (
          <div key={i} style={stepStyle}>
            <div style={circleStyle}>{i + 1}</div>
            {i < steps.length - 1 && <div style={lineStyle} />}
            <div style={{ ...stepLabelStyle, marginTop: i < steps.length - 1 ? '6px' : '6px' }}>{step}</div>
          </div>
        ))}
      </div>
    </>
  );
}

const pages: Record<string, React.FC> = {
  about: AboutPage,
  contact: ContactPage,
  privacy: PrivacyPage,
  terms: TermsPage,
  refund: RefundPage,
  checkout: CheckoutPage,
};

export default function LegalPages({ page, onBack }: LegalPagesProps) {
  const PageContent = pages[page];

  return (
    <div style={containerStyle}>
      <div style={cardStyle}>
        <BackButton onBack={onBack} />
        {PageContent && <PageContent />}
      </div>
    </div>
  );
}
