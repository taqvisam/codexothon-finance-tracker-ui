interface BrandIconProps {
  className?: string;
}

export function BrandIcon({ className = "" }: BrandIconProps) {
  return (
    <svg
      viewBox="0 0 64 64"
      fill="none"
      aria-hidden="true"
      className={className}
    >
      <defs>
        <linearGradient id="brand-icon-bg" x1="10" y1="8" x2="54" y2="56" gradientUnits="userSpaceOnUse">
          <stop stopColor="#6A63FF" />
          <stop offset="1" stopColor="#3C97F4" />
        </linearGradient>
        <linearGradient id="brand-icon-accent" x1="16" y1="44" x2="46" y2="20" gradientUnits="userSpaceOnUse">
          <stop stopColor="#9BE7C4" />
          <stop offset="1" stopColor="#FFFFFF" />
        </linearGradient>
      </defs>

      <rect x="6" y="6" width="52" height="52" rx="18" fill="url(#brand-icon-bg)" />
      <circle cx="45" cy="20" r="8" fill="rgba(255,255,255,0.18)" />
      <path
        d="M18 42.5h28"
        stroke="rgba(255,255,255,0.28)"
        strokeWidth="2.4"
        strokeLinecap="round"
      />
      <path
        d="M22 38V31"
        stroke="#FFFFFF"
        strokeWidth="4"
        strokeLinecap="round"
      />
      <path
        d="M31 38V25"
        stroke="#FFFFFF"
        strokeWidth="4"
        strokeLinecap="round"
      />
      <path
        d="M40 38V20"
        stroke="#FFFFFF"
        strokeWidth="4"
        strokeLinecap="round"
      />
      <path
        d="M20 27.5 29.5 22 37 24.5 45 16.5"
        stroke="url(#brand-icon-accent)"
        strokeWidth="3.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M41 16.5H45V20.5"
        stroke="url(#brand-icon-accent)"
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
