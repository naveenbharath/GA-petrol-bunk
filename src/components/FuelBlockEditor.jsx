import { motion } from 'framer-motion'
import { CHANNELS, channelAmount, totalSalesAmount, totalSalesLtr, closingLtr } from '../utils/fuelCalc.js'
import { formatCurrency } from '../utils/format.js'
import { Field, Input } from './FormControls.jsx'
import { useLanguage } from '../context/LanguageContext.jsx'
import { FUEL_ENTRY_TEXT } from '../i18n/fuelEntry.js'

const TINTS = {
  orange: { bg: 'bg-orange-50/60', border: 'border-orange-100', hoverBorder: 'hover:border-orange-200' },
  blue: { bg: 'bg-blue-50/60', border: 'border-blue-100', hoverBorder: 'hover:border-blue-200' },
}

export default function FuelBlockEditor({ label, accent, tint, value, onChange }) {
  const { language } = useLanguage()
  const t = FUEL_ENTRY_TEXT[language].blockEditor
  const theme = TINTS[tint] || { bg: 'bg-white', border: 'border-slate-200', hoverBorder: 'hover:border-slate-300' }
  function setField(field, v) {
    onChange({ ...value, [field]: v })
  }
  function setChannel(key, field, v) {
    onChange({
      ...value,
      channels: { ...value.channels, [key]: { ...value.channels[key], [field]: v } },
    })
  }

  const totalLtr = totalSalesLtr(value)
  const totalAmt = totalSalesAmount(value)
  const closing = closingLtr(value)

  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: 'easeOut' }}
      whileHover={{ y: -2 }}
      className={`cursor-pointer rounded-xl border p-4 shadow-card transition-all duration-200 hover:shadow-card-hover ${theme.bg} ${theme.border} ${theme.hoverBorder}`}
    >
      <div className="mb-4 flex items-center gap-2">
        <span className={`h-2.5 w-2.5 rounded-full ${accent}`} />
        <h4 className="text-sm font-bold text-slate-800">{label}</h4>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <Field label={t.opening}>
          <Input type="number" min="0" step="any" value={value.opening} onChange={(e) => setField('opening', e.target.value)} placeholder="0" />
        </Field>
        <Field label={t.purchase}>
          <Input type="number" min="0" step="any" value={value.purchase} onChange={(e) => setField('purchase', e.target.value)} placeholder="0" />
        </Field>
        <Field label={t.testing}>
          <Input type="number" min="0" step="any" value={value.testing} onChange={(e) => setField('testing', e.target.value)} placeholder="0" />
        </Field>
      </div>

      <div className="mt-4">
        <div className="grid grid-cols-[1fr_1fr_1fr_1fr] gap-2 px-1 pb-1.5 text-[11px] font-semibold uppercase tracking-wide text-slate-400">
          <span>{t.channel}</span>
          <span>{t.ltr}</span>
          <span>{t.ratePerLtr}</span>
          <span className="text-right">{t.amount}</span>
        </div>
        <div className="space-y-2">
          {CHANNELS.map((key) => (
            <div key={key} className="grid grid-cols-[1fr_1fr_1fr_1fr] items-center gap-2">
              <span className="text-sm font-medium text-slate-600">{t.channelLabels[key]}</span>
              <Input
                type="number"
                min="0"
                step="any"
                value={value.channels[key].ltr}
                onChange={(e) => setChannel(key, 'ltr', e.target.value)}
                placeholder="0"
                className="px-2 py-1.5 text-sm"
              />
              <Input
                type="number"
                min="0"
                step="any"
                value={value.channels[key].rate}
                onChange={(e) => setChannel(key, 'rate', e.target.value)}
                placeholder="0.00"
                className="px-2 py-1.5 text-sm"
              />
              <span className="text-right text-sm font-semibold text-slate-700">{formatCurrency(channelAmount(value.channels[key]))}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="mt-4 flex flex-col gap-1 rounded-lg bg-slate-50 px-3 py-2.5 text-sm sm:flex-row sm:items-center sm:justify-between">
        <span className="text-slate-600">
          {t.totalSales} <span className="font-semibold text-slate-800">{totalLtr.toLocaleString('en-IN')} L</span> &middot;{' '}
          <span className="font-semibold text-slate-800">{formatCurrency(totalAmt)}</span>
        </span>
        <span className="text-slate-600">
          {t.closing} <span className={`font-semibold ${closing < 0 ? 'text-rose-500' : 'text-slate-800'}`}>{closing.toLocaleString('en-IN')} L</span>
        </span>
      </div>
    </motion.div>
  )
}
