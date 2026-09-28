import { useId } from 'react'
import { logoImage } from '../lib/brand-assets'

/** Platform mark: custom logo if provided, otherwise a drawn padel ball. */
export function BrandMark({ className = 'h-9 w-9' }: { className?: string }) {
  // Unique per instance: SVG ids are document-global, and an id defined inside a hidden
  // (display:none) copy, e.g. the desktop sidebar on mobile, would not render for the others.
  const bg = `bm-bg-${useId()}`
  if (logoImage) return <img src={logoImage} alt="" className={`${className} object-contain`} />
  return (
    <svg viewBox="0 0 40 40" className={className} aria-hidden="true">
      <defs>
        <linearGradient id={bg} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#10b981" />
          <stop offset="1" stopColor="#047857" />
        </linearGradient>
      </defs>
      <rect width="40" height="40" rx="11" fill={`url(#${bg})`} />
      <circle cx="20" cy="20" r="10.5" fill="#d4f25a" />
      <path
        d="M11.2 14.6c4.6 2.2 7 6.1 7 10.9 0 1.2-.2 2.4-.5 3.5M28.8 25.4c-4.6-2.2-7-6.1-7-10.9 0-1.2.2-2.4.5-3.5"
        fill="none"
        stroke="#fff"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  )
}

/**
 * Top-down padel court (20 × 10 m): glass walls, net, service lines.
 * Proportions follow the official court so it reads as padel at a glance.
 */
export function CourtGraphic({ live = false, className = '' }: { live?: boolean; className?: string }) {
  const id = useId()
  const turf = `court-turf-${id}`
  const grain = `court-grain-${id}`
  const line = 'rgba(255,255,255,0.75)'
  return (
    <svg viewBox="0 0 220 120" className={className} aria-hidden="true" preserveAspectRatio="xMidYMid meet">
      <defs>
        <linearGradient id={turf} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor={live ? '#0f766e' : '#1e3a5f'} />
          <stop offset="1" stopColor={live ? '#065f46' : '#152a47'} />
        </linearGradient>
        <pattern id={grain} width="4" height="4" patternUnits="userSpaceOnUse">
          <path d="M0 4L4 0" stroke="rgba(255,255,255,0.035)" strokeWidth="1" />
        </pattern>
      </defs>
      {/* glass walls */}
      <rect x="4" y="4" width="212" height="112" rx="5" fill="none" stroke="rgba(148,197,255,0.35)" strokeWidth="2" />
      {/* playing surface */}
      <rect x="10" y="10" width="200" height="100" rx="2" fill={`url(#${turf})`} />
      <rect x="10" y="10" width="200" height="100" rx="2" fill={`url(#${grain})`} />
      <rect x="10" y="10" width="200" height="100" rx="2" fill="none" stroke={line} strokeWidth="1.4" />
      {/* service lines (6.95 m from the net) and center service line */}
      <line x1="40.5" y1="10" x2="40.5" y2="110" stroke={line} strokeWidth="1.2" />
      <line x1="179.5" y1="10" x2="179.5" y2="110" stroke={line} strokeWidth="1.2" />
      <line x1="40.5" y1="60" x2="179.5" y2="60" stroke={line} strokeWidth="1.2" />
      {/* net */}
      <line x1="110" y1="6" x2="110" y2="114" stroke="#fff" strokeWidth="2.2" />
      <line x1="110" y1="6" x2="110" y2="114" stroke="rgba(0,0,0,0.25)" strokeWidth="0.6" strokeDasharray="1.5 1.5" />
    </svg>
  )
}
