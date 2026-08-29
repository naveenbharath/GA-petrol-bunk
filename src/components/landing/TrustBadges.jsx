import { Fuel, Scale, Zap } from 'lucide-react'

const BADGES = [
  { icon: Fuel, label: 'Genuine IndianOil Fuel' },
  { icon: Scale, label: 'Honest Measures' },
  { icon: Zap, label: 'On-the-Spot Service' },
]

export default function TrustBadges({ className = '' }) {
  return (
    <div className={`flex flex-wrap items-center justify-center gap-3 sm:gap-4 ${className}`}>
      {BADGES.map((b) => (
        <span
          key={b.label}
          className="inline-flex items-center gap-2 rounded-full border border-brand-200 bg-brand-50 px-3.5 py-1.5 text-xs font-semibold text-brand-700 sm:text-sm"
        >
          <b.icon size={14} /> {b.label}
        </span>
      ))}
    </div>
  )
}
