import { motion } from 'framer-motion'
import CountUp from './CountUp.jsx'

export default function StatCard({ icon: Icon, label, value, formatter, suffix, accent = 'brand', index = 0 }) {
  // VIBGYOR set (plus gold brand + neutral) so each metric on a multi-stat dashboard reads as
  // its own color-coded category rather than a wash of one repeated accent.
  const accents = {
    brand: { card: 'bg-brand-50/70 ring-brand-100', icon: 'bg-brand-100 text-brand-700' },
    violet: { card: 'bg-violet-50/70 ring-violet-100', icon: 'bg-violet-100 text-violet-700' },
    indigo: { card: 'bg-indigo-50/70 ring-indigo-100', icon: 'bg-indigo-100 text-indigo-700' },
    blue: { card: 'bg-blue-50/70 ring-blue-100', icon: 'bg-blue-100 text-blue-700' },
    green: { card: 'bg-green-50/70 ring-green-100', icon: 'bg-green-100 text-green-700' },
    yellow: { card: 'bg-yellow-50/70 ring-yellow-100', icon: 'bg-yellow-100 text-yellow-700' },
    orange: { card: 'bg-orange-50/70 ring-orange-100', icon: 'bg-orange-100 text-orange-700' },
    red: { card: 'bg-red-50/70 ring-red-100', icon: 'bg-red-100 text-red-700' },
    amber: { card: 'bg-amber-50/70 ring-amber-100', icon: 'bg-amber-100 text-amber-700' },
    rose: { card: 'bg-rose-50/70 ring-rose-100', icon: 'bg-rose-100 text-rose-700' },
    slate: { card: 'bg-slate-50 ring-slate-200', icon: 'bg-slate-200 text-slate-700' },
    black: { card: 'bg-slate-50 ring-slate-200', icon: 'bg-slate-900 text-white' },
  }
  const theme = accents[accent]

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: index * 0.06, ease: 'easeOut' }}
      whileHover={{ y: -2 }}
      className={`cursor-pointer rounded-xl border border-slate-200 p-5 shadow-card ring-1 transition-shadow duration-200 hover:shadow-card-hover ${theme.card}`}
    >
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm font-medium text-slate-500">{label}</p>
          <p className="mt-2 text-2xl font-bold tracking-tight text-slate-900">
            <CountUp value={value} formatter={formatter} />
            {suffix ? <span className="ml-1 text-base font-semibold text-slate-400">{suffix}</span> : null}
          </p>
        </div>
        {Icon ? (
          <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${theme.icon}`}>
            <Icon size={20} strokeWidth={2} />
          </div>
        ) : null}
      </div>
    </motion.div>
  )
}
