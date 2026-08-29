import { useMemo, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, ReceiptText, Fuel, TrendingUp, AlertTriangle, ClipboardCheck } from 'lucide-react'
import { useData } from '../context/DataContext.jsx'
import { useLanguage } from '../context/LanguageContext.jsx'
import { FUEL_ENTRY_TEXT } from '../i18n/fuelEntry.js'
import { formatCurrency, todayISO } from '../utils/format.js'
import { aggregateEntries, withCarriedOpenings, sortPumpEntries } from '../utils/fuelCalc.js'
import EmptyState from '../components/EmptyState.jsx'
import AppDatePicker from '../components/AppDatePicker.jsx'
import { Field } from '../components/FormControls.jsx'
import PumpDayEditor from '../components/PumpDayEditor.jsx'
import AuditModal from '../components/AuditModal.jsx'

// Each shift is its own independently-saved record now (see PumpDayEditor —
// every shift card has its own Save/Save-as-Draft). This page is just the
// day-level shell around that: pick a date, switch between the two pumps,
// and see the combined totals once shifts are saved. Nothing here submits
// anything itself.
export default function FuelEntryForm() {
  const { entryId } = useParams()
  const navigate = useNavigate()
  const { fuelEntries, fuelRates, employees, creditCustomers, lubricants, station, updateStation } = useData()
  const { language } = useLanguage()
  const t = FUEL_ENTRY_TEXT[language]
  const activeEmployees = useMemo(() => employees.filter((e) => e.active !== false), [employees])

  // Arriving via a History row (entryId set) jumps straight to that shift's
  // day + pump; arriving via "New Day Entry" starts on today, Pump 1.
  const linkedEntry = entryId ? fuelEntries.find((e) => e.id === entryId) : null
  const [date, setDate] = useState(() => linkedEntry?.date || todayISO())
  const [activeTab, setActiveTab] = useState(() => linkedEntry?.pumpKey || 'pump1')
  const [auditOpen, setAuditOpen] = useState(false)

  if (entryId && !linkedEntry) {
    return (
      <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-card">
        <EmptyState icon={ReceiptText} title={t.emptyTitle} description={t.emptyDesc} />
      </div>
    )
  }

  // Combined Pump 1 + Pump 2 totals for the viewed date, from whatever
  // shifts are currently saved — updates live as each shift card is saved.
  // Also keeps each pump's own entries/aggregate/bill count around for the
  // Audit report, which breaks the day down per pump as well as overall.
  const dayBreakdown = useMemo(() => {
    const dayEntries = fuelEntries.filter((e) => e.date === date)
    const perPump = { pump1: [], pump2: [] }
    for (const pumpKey of ['pump1', 'pump2']) {
      perPump[pumpKey] = withCarriedOpenings(sortPumpEntries(dayEntries.filter((e) => e.pumpKey === pumpKey)))
    }
    const combined = [...perPump.pump1, ...perPump.pump2]
    const billsCount = combined.reduce((sum, e) => sum + (e.bills?.length || 0), 0)
    return {
      dayTotals: aggregateEntries(combined),
      pump1: { entries: perPump.pump1, aggregate: aggregateEntries(perPump.pump1) },
      pump2: { entries: perPump.pump2, aggregate: aggregateEntries(perPump.pump2) },
      billsCount,
    }
  }, [fuelEntries, date])
  const dayTotals = dayBreakdown.dayTotals

  return (
    <div className="space-y-5">
      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-card">
        <div className="flex items-center justify-between gap-4 border-b border-slate-100 pb-3">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => navigate('/fuel-entry')}
              className="flex items-center gap-1.5 text-sm font-semibold text-slate-500 transition-colors hover:text-slate-700"
            >
              <ArrowLeft size={15} /> {t.entryHistory}
            </button>
            <span className="h-4 w-px bg-slate-200" />
            <h2 className="text-base font-bold text-slate-800">{t.newEntry}</h2>
          </div>
          <Field label={t.fieldDate} className="max-w-xs">
            <AppDatePicker value={date} onChange={setDate} className="w-full" />
          </Field>
        </div>

        <motion.div
          initial={{ opacity: 0, y: -10, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.35, ease: 'easeOut' }}
          className={`my-4 rounded-xl border p-4 shadow-sm ${
            dayTotals.excessShortage < 0 ? 'border-rose-300 bg-rose-50' : 'border-brand-300 bg-brand-100'
          }`}
        >
          <div className="mb-3 flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <motion.span
                animate={{ rotate: [0, -8, 8, 0] }}
                transition={{ duration: 1.8, repeat: Infinity, repeatDelay: 3, ease: 'easeInOut' }}
              >
                <ReceiptText size={16} className={dayTotals.excessShortage < 0 ? 'text-rose-600' : 'text-brand-700'} />
              </motion.span>
              <h4 className="text-sm font-bold text-slate-800">{t.dayTotal}</h4>
            </div>
            <button
              type="button"
              onClick={() => setAuditOpen(true)}
              className="flex items-center gap-1.5 rounded-full bg-white px-3 py-1.5 text-xs font-semibold text-brand-700 shadow-sm ring-1 ring-brand-200 transition-colors hover:bg-brand-50"
            >
              <ClipboardCheck size={14} /> {t.auditButton}
            </button>
          </div>
          <dl className="grid grid-cols-1 gap-2 text-sm sm:grid-cols-3">
            <Row label={t.rowTotalSale} value={dayTotals.totalSaleAmount} />
            <Row label={t.rowTotalPayments} value={dayTotals.totalPayments} />
            <div className="flex items-center justify-between sm:justify-end sm:gap-2">
              <span className={`flex items-center gap-1 text-sm font-semibold ${dayTotals.excessShortage >= 0 ? 'text-emerald-600' : 'text-rose-500'}`}>
                {dayTotals.excessShortage >= 0 ? (
                  <TrendingUp size={14} />
                ) : (
                  <motion.span animate={{ scale: [1, 1.25, 1] }} transition={{ duration: 1.1, repeat: Infinity, ease: 'easeInOut' }}>
                    <AlertTriangle size={14} />
                  </motion.span>
                )}
                {dayTotals.excessShortage >= 0 ? t.excessCash : t.cashShortage}
              </span>
              <AnimatePresence mode="popLayout">
                <motion.span
                  key={formatCurrency(dayTotals.excessShortage)}
                  initial={{ opacity: 0, y: -6, scale: 0.85 }}
                  animate={{
                    opacity: 1,
                    y: 0,
                    scale: dayTotals.excessShortage < 0 ? [1, 1.06, 1] : 1,
                  }}
                  transition={
                    dayTotals.excessShortage < 0
                      ? { scale: { duration: 1.1, repeat: Infinity, ease: 'easeInOut' }, opacity: { duration: 0.25 }, y: { duration: 0.25 } }
                      : { duration: 0.25 }
                  }
                  className={`text-base font-extrabold ${dayTotals.excessShortage >= 0 ? 'text-emerald-600' : 'text-rose-500'}`}
                >
                  {dayTotals.excessShortage >= 0 ? '+' : ''}
                  {formatCurrency(dayTotals.excessShortage)}
                </motion.span>
              </AnimatePresence>
            </div>
          </dl>
        </motion.div>

        <div className="flex items-center gap-2 border-b border-slate-100">
          <PumpTab active={activeTab === 'pump1'} onClick={() => setActiveTab('pump1')} label={t.pump1} accentText="text-violet-600" accentBar="bg-violet-600" />
          <PumpTab active={activeTab === 'pump2'} onClick={() => setActiveTab('pump2')} label={t.pump2} accentText="text-ocean-600" accentBar="bg-ocean-600" />
        </div>

        <div className={`pt-4 ${activeTab === 'pump1' ? '' : 'hidden'}`}>
          <PumpDayEditor
            key={`pump1-${date}`}
            pumpKey="pump1"
            label={t.pump1}
            accent="bg-violet-600"
            tint="violet"
            date={date}
            employees={activeEmployees}
            fuelRates={fuelRates}
            creditCustomers={creditCustomers}
          />
        </div>
        <div className={`pt-4 ${activeTab === 'pump2' ? '' : 'hidden'}`}>
          <PumpDayEditor
            key={`pump2-${date}`}
            pumpKey="pump2"
            label={t.pump2}
            accent="bg-ocean-600"
            tint="blue"
            date={date}
            employees={activeEmployees}
            fuelRates={fuelRates}
            creditCustomers={creditCustomers}
            lubricants={lubricants}
          />
        </div>
      </div>

      <AuditModal
        isOpen={auditOpen}
        onClose={() => setAuditOpen(false)}
        date={date}
        station={station}
        onUpdateAuditContact={(email) => updateStation({ auditContactEmail: email })}
        pump1={{ label: t.pump1, ...dayBreakdown.pump1 }}
        pump2={{ label: t.pump2, ...dayBreakdown.pump2 }}
        dayTotals={dayTotals}
        billsCount={dayBreakdown.billsCount}
        employees={employees}
        creditCustomers={creditCustomers}
      />
    </div>
  )
}

function Row({ label, value }) {
  const formatted = formatCurrency(value)
  return (
    <div className="flex items-center justify-between">
      <dt className="text-slate-500">{label}</dt>
      <dd className="overflow-hidden font-bold text-slate-800">
        <AnimatePresence mode="popLayout">
          <motion.span
            key={formatted}
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.22, ease: 'easeOut' }}
            className="inline-block"
          >
            {formatted}
          </motion.span>
        </AnimatePresence>
      </dd>
    </div>
  )
}

function PumpTab({ active, onClick, label, accentText, accentBar }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`relative flex items-center gap-2 px-3.5 py-2 text-sm font-bold transition-colors ${
        active ? accentText : 'text-slate-400 hover:text-slate-600'
      }`}
    >
      <Fuel size={16} />
      {label}
      {active ? <span className={`absolute inset-x-0 -bottom-px h-0.5 rounded-full ${accentBar}`} /> : null}
    </button>
  )
}
