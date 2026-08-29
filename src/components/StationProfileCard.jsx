import { motion } from 'framer-motion'
import { MapPin, Phone, Mail, BadgeCheck } from 'lucide-react'

export default function StationProfileCard({ station }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      whileHover={{ y: -2 }}
      className="cursor-pointer overflow-hidden rounded-xl border border-slate-200 bg-white shadow-card transition-shadow duration-200 hover:shadow-card-hover"
    >
      <div className="grid grid-cols-1 lg:grid-cols-5">
        <div className="relative h-48 overflow-hidden lg:col-span-2 lg:h-auto lg:min-h-[220px]">
          <motion.img
            src={station.photo}
            alt={station.name}
            className="h-full w-full object-cover"
            initial={{ scale: 1.05 }}
            animate={{ scale: 1.16 }}
            transition={{ duration: 18, repeat: Infinity, repeatType: 'reverse', ease: 'easeInOut' }}
          />
          <div className="absolute inset-0 bg-gradient-to-t from-slate-950/75 via-slate-950/5 to-transparent" />
          <div className="absolute bottom-3 left-3 flex items-center gap-2">
            <img src={station.logo} alt="" className="h-8 w-16 object-contain drop-shadow-[0_1px_4px_rgba(0,0,0,0.8)]" />
            <span className="rounded-md bg-slate-950/70 px-2 py-1 text-xs font-semibold text-white backdrop-blur">{station.brand}</span>
          </div>
        </div>

        <div className="flex flex-col justify-center gap-3 p-5 lg:col-span-3 lg:p-6">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-lg font-bold text-slate-900 sm:text-xl">{station.name}</h2>
            <span className="inline-flex items-center gap-1 rounded-full bg-brand-50 px-2.5 py-1 text-[11px] font-semibold text-brand-700">
              <BadgeCheck size={12} /> {station.dealerType}
            </span>
          </div>
          <p className="text-sm text-slate-500">
            Proprietor: <span className="font-medium text-slate-700">{station.dealerName}</span>
          </p>

          <div className="flex flex-wrap gap-2 text-xs">
            <span className="rounded-md bg-indigo-50 px-2 py-1 font-medium text-indigo-700">SAP No: {station.sapNo}</span>
            <span className="rounded-md bg-violet-50 px-2 py-1 font-medium text-violet-700">GSTIN: {station.gstin}</span>
          </div>

          <div className="mt-1 grid grid-cols-1 gap-2.5 text-sm text-slate-600 sm:grid-cols-2">
            <div className="flex items-start gap-2 sm:col-span-2">
              <MapPin size={15} className="mt-0.5 shrink-0 text-brand-500" />
              <span>{station.addressLines.join(', ')}</span>
            </div>
            <div className="flex items-center gap-2">
              <Phone size={15} className="shrink-0 text-brand-500" />
              <span>{station.mobiles.join(' / ')}</span>
            </div>
            <div className="flex items-center gap-2">
              <Mail size={15} className="shrink-0 text-brand-500" />
              <span className="truncate">{station.email}</span>
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  )
}
