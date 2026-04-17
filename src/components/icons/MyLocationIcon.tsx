export function MyLocationIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="22"
      height="22"
      viewBox="0 0 24 24"
      fill="none"
      className={className}
      aria-hidden
    >
      <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="2" />
      <path
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        d="M12 3v2M12 19v2M3 12h2M19 12h2"
      />
      <path
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        opacity="0.55"
        d="M6.34 6.34l1.41 1.41M16.24 16.24l1.42 1.42M17.66 6.34l-1.41 1.41M7.76 16.24l-1.42 1.42"
      />
    </svg>
  )
}
