import { motion } from 'framer-motion'
import { Wind, Droplet, ShowerHead, ShieldCheck } from 'lucide-react'

const FACILITIES = [
  {
    icon: Wind,
    title: 'Free Air Filling',
    desc: 'Quick, free tyre air-filling for two-wheelers, cars and trucks — no waiting in line.',
    accent: 'bg-blue-50 text-blue-600',
  },
  {
    icon: Droplet,
    title: 'Engine Oil & Lubricants',
    desc: 'Genuine 2T, 4T and gear oils stocked for every vehicle that rolls in.',
    accent: 'bg-orange-50 text-orange-600',
  },
  {
    icon: Droplet,
    title: 'Coolant Top-Up',
    desc: 'Radiator coolant refill and top-up done right at the pump, on the spot.',
    accent: 'bg-green-50 text-green-600',
  },
  {
    icon: ShowerHead,
    title: 'Clean Rest Room',
    desc: 'A clean, well-maintained rest room open for customers and highway travellers.',
    accent: 'bg-violet-50 text-violet-600',
  },
]

export default function StationFacilities({ station }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: 0.08 }}
      className="rounded-xl border border-slate-200 bg-white p-5 shadow-card sm:p-6"
    >
      <div className="mb-1 flex items-center gap-2">
        <ShieldCheck size={16} className="text-brand-600" />
        <h3 className="text-sm font-bold text-slate-800">Why Customers Choose {station.name}</h3>
      </div>
      <p className="mb-5 text-xs text-slate-500 sm:text-sm">
        Trusted by transporters, buses and daily commuters across {station.location.split(',')[0]} for
        genuine {station.brand} fuel, honest measures and complete on-the-spot vehicle care.
      </p>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {FACILITIES.map((f, i) => (
          <motion.div
            key={f.title}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35, delay: 0.12 + i * 0.06 }}
            whileHover={{ y: -2 }}
            className="cursor-pointer rounded-lg border border-slate-100 p-4 transition-shadow hover:shadow-card-hover"
          >
            <div className={`mb-3 flex h-9 w-9 items-center justify-center rounded-lg ${f.accent}`}>
              <f.icon size={18} />
            </div>
            <p className="text-sm font-semibold text-slate-800">{f.title}</p>
            <p className="mt-1 text-xs text-slate-500">{f.desc}</p>
          </motion.div>
        ))}
      </div>
    </motion.div>
  )
}
