import { motion } from 'framer-motion'
import { BadgeCheck, User, Hash, FileText } from 'lucide-react'

export default function AboutSection({ station }) {
  return (
    <section id="about" className="relative bg-brand-50 px-6 py-16 sm:py-20">
      <div className="mx-auto max-w-5xl">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.3 }}
          transition={{ duration: 0.5 }}
          className="mb-10 text-center"
        >
          <h2 className="font-heading bg-gradient-to-r from-slate-900 via-slate-700 to-brand-600 bg-clip-text text-xl font-black text-transparent sm:text-2xl">About Our Station</h2>
          <p className="mt-2 text-sm text-slate-600 sm:text-base">A registered {station.dealerType} you can rely on.</p>
        </motion.div>

        <div className="grid grid-cols-1 gap-8 rounded-2xl border border-slate-200 bg-white p-6 shadow-card sm:p-10 lg:grid-cols-5">
          <motion.div
            initial={{ opacity: 0, x: -16 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true, amount: 0.4 }}
            transition={{ duration: 0.5 }}
            className="flex flex-col items-center justify-center gap-3 border-b border-slate-100 pb-6 text-center lg:col-span-2 lg:border-b-0 lg:border-r lg:pb-0 lg:pr-8"
          >
            <div className="flex h-20 w-32 items-center justify-center">
              <img src={station.logo} alt={station.name} className="h-full w-full object-contain" />
            </div>
            <h3 className="text-lg font-bold text-slate-900">{station.name}</h3>
            <span className="inline-flex items-center gap-1 rounded-full bg-brand-50 px-3 py-1 text-xs font-semibold text-brand-700">
              <BadgeCheck size={13} /> {station.dealerType}
            </span>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, x: 16 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true, amount: 0.4 }}
            transition={{ duration: 0.5, delay: 0.1 }}
            className="flex flex-col justify-center gap-4 lg:col-span-3"
          >
            <p className="text-sm leading-relaxed text-slate-600 sm:text-base">
              {station.name} has proudly served {station.location.split(',')[0]} and the surrounding
              villages with genuine {station.brand} fuel and dependable vehicle care. Built on honest
              measures and courteous service, it's the kind of station where drivers stop once and
              keep coming back — from daily commuters to long-haul transporters.
            </p>
            <div className="flex flex-wrap gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-md bg-slate-100 px-2.5 py-1.5 text-xs font-medium text-slate-600">
                <User size={13} /> Proprietor: <span className="font-semibold text-slate-800">{station.dealerName}</span>
              </span>
              <span className="inline-flex items-center gap-1.5 rounded-md bg-indigo-50 px-2.5 py-1.5 text-xs font-medium text-indigo-700">
                <Hash size={13} /> SAP No: {station.sapNo}
              </span>
              <span className="inline-flex items-center gap-1.5 rounded-md bg-violet-50 px-2.5 py-1.5 text-xs font-medium text-violet-700">
                <FileText size={13} /> GSTIN: {station.gstin}
              </span>
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  )
}
