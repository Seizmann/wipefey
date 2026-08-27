interface LogoProps {
  size?: number
  className?: string
  /** Omit role/aria-label for purely decorative uses (drop zone, etc.). */
  decorative?: boolean
}

/**
 * Wipefey mark — a square photo/CCD sensor frame with a horizontal "wipe"
 * motion-slice through it and a terminal caret (no AI vibe, monochrome two-tone).
 * Renders with currentColor so it adapts to light/dark themes.
 * This is the ONLY logo component — do not create a second variant.
 */
export function Logo({ size = 24, className, decorative = false }: LogoProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      role={decorative ? undefined : 'img'}
      aria-hidden={decorative || undefined}
      aria-label={decorative ? undefined : 'Wipefey'}
      className={className}
    >
      {/* Outer sensor frame */}
      <rect
        x="2"
        y="2"
        width="28"
        height="28"
        rx="4"
        stroke="currentColor"
        strokeWidth="2"
      />
      {/* Inner photo frame */}
      <rect
        x="8"
        y="8"
        width="13"
        height="13"
        rx="2"
        stroke="currentColor"
        strokeWidth="1.5"
        opacity="0.5"
      />
      {/* Wipe motion-slice (the "erase" stroke) */}
      <path
        d="M4 21h13"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
      />
      {/* Terminal caret — clean/data action */}
      <path
        d="M24 11l4 4-4 4"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
    </svg>
  )
}
