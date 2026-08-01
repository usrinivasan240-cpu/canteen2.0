import React from 'react';

interface LegalFooterProps {
  onNavigate?: (page: string) => void;
}

const RED = '#DC2626';
const TEXT_LIGHT = '#9CA3AF';
const BORDER_LIGHT = '#E5E7EB';

const links = [
  { label: 'About Us', page: 'about' },
  { label: 'Contact Us', page: 'contact' },
  { label: 'Privacy Policy', page: 'privacy' },
  { label: 'Terms & Conditions', page: 'terms' },
  { label: 'Refund & Cancellation Policy', page: 'refund' },
  { label: 'Payment Checkout Flow', page: 'checkout' },
];

const footerStyle: React.CSSProperties = {
  borderTop: `1px solid ${BORDER_LIGHT}`,
  padding: '24px 16px',
  backgroundColor: '#FFFFFF',
  fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
};

const linksRowStyle: React.CSSProperties = {
  display: 'flex',
  flexWrap: 'wrap',
  justifyContent: 'center',
  alignItems: 'center',
  gap: '6px 20px',
  marginBottom: '16px',
};

const linkStyle: React.CSSProperties = {
  fontSize: '13px',
  fontWeight: 500,
  color: RED,
  textDecoration: 'none',
  cursor: 'pointer',
  transition: 'all 0.15s ease',
  padding: '2px 0',
  background: 'none',
  border: 'none',
  fontFamily: 'inherit',
};

const poweredByStyle: React.CSSProperties = {
  textAlign: 'center',
  fontSize: '12px',
  color: TEXT_LIGHT,
  fontWeight: 500,
  letterSpacing: '0.02em',
};

export default function LegalFooter({ onNavigate }: LegalFooterProps) {
  const handleClick = (page: string) => {
    if (onNavigate) {
      onNavigate(page);
    }
  };

  return (
    <footer style={footerStyle}>
      <div style={linksRowStyle}>
        {links.map((link) => (
          <button
            key={link.page}
            style={linkStyle}
            onClick={() => handleClick(link.page)}
            onMouseEnter={(e) => {
              e.currentTarget.style.textDecoration = 'underline';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.textDecoration = 'none';
            }}
          >
            {link.label}
          </button>
        ))}
      </div>
      <div style={poweredByStyle}>
        Powered by AUTO HUB SOLUTION (AHS)
      </div>
    </footer>
  );
}
