interface LogoProps {
  size?: number
}

/** The Kalyxis mark: an evening star held inside two hairline rings. */
export function Logo({ size = 24 }: LogoProps) {
  return (
    <svg viewBox="0 0 100 100" width={size} height={size} aria-hidden="true" focusable="false">
      <circle cx="50" cy="50" r="46" fill="none" stroke="currentColor" strokeWidth="2" opacity="0.9" />
      <circle cx="50" cy="50" r="33" fill="none" stroke="currentColor" strokeWidth="1" opacity="0.4" />
      <path d="M50 18 L53.2 46.8 L82 50 L53.2 53.2 L50 82 L46.8 53.2 L18 50 L46.8 46.8 Z" fill="var(--star)" />
    </svg>
  )
}
