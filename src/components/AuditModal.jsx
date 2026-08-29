import { useMemo, useState } from 'react'
import toast from 'react-hot-toast'
import { Send, Download, ClipboardCheck } from 'lucide-react'
import Modal from './Modal.jsx'
import { Field, Input, Textarea, PrimaryButton, SecondaryButton } from './FormControls.jsx'
import { formatCurrency, formatDate } from '../utils/format.js'
import { useLanguage } from '../context/LanguageContext.jsx'
import { FUEL_ENTRY_TEXT } from '../i18n/fuelEntry.js'

// Suggested audit recipient — pre-filled but always editable, so the report
// still goes to whoever the manager types in instead.
const SUGGESTED_AUDIT_EMAIL = 'sreeabinayaassociates@gmail.com'

// mailto: can't attach a file (no browser API allows it for security
// reasons), so — same limitation the earlier WhatsApp flow had — this opens
// the manager's email app with the recipient/subject/body pre-filled and the
// report is downloaded alongside for them to attach by hand.
function buildMailtoLink(email, subject, body) {
  return `mailto:${(email || '').trim()}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`
}

// Litres are rounded to whole numbers everywhere in this audit report (and
// only here — the fuel-entry screens elsewhere keep their 2-decimal
// precision) since an auditor reading/printing this report cares about
// round-number litres, not fractional ones.
function roundLtr(value) {
  return Math.round(Number(value) || 0)
}

// Real payment collection methods only (Cash/Day Cash/Card/QR/...) — every
// line added via the plain "Add line" flow is type 'cash' regardless of its
// label, so this is the full set of money actually collected at the pump.
// Grouped by label and summed across both pumps, since the whole report is
// now an entire-day figure rather than split per pump.
// A payment line with no `type` at all (older data saved before the field
// existed) is a plain cash/card/QR line, same as emptyPaymentLine()'s own
// default — only an explicit 'credit'/'employeeCredit'/'expense' type means
// it's something else.
function isCashPayment(p) {
  return !p.type || p.type === 'cash'
}

function paymentsBreakdown(entries) {
  const totals = new Map()
  for (const entry of entries || []) {
    for (const p of entry.payments || []) {
      if (!isCashPayment(p)) continue
      const label = (p.label || '').trim() || '—'
      totals.set(label, (totals.get(label) || 0) + (Number(p.amount) || 0))
    }
  }
  return [...totals.entries()].map(([label, amount]) => ({ label, amount, kind: 'cash' }))
}

// Customer credit lines only (never employee credit) summed per customer —
// shown by name, right alongside the real payment methods, since credit is
// just another way the day's sale was settled (owed back later instead of
// collected today).
function customerCreditBreakdown(entries, creditCustomers) {
  const totals = new Map()
  for (const entry of entries || []) {
    for (const p of entry.payments || []) {
      if (p.type !== 'credit') continue
      const key = p.customerId || `unassigned:${p.note || ''}`
      const existing = totals.get(key) || { customerId: p.customerId || '', amount: 0 }
      existing.amount += Number(p.amount) || 0
      totals.set(key, existing)
    }
  }
  return [...totals.values()].map((row) => ({
    label: (creditCustomers || []).find((c) => c.id === row.customerId)?.name || '—',
    amount: row.amount,
    customerId: row.customerId,
    kind: 'credit',
  }))
}

// Payment methods and customer credit, combined into one table sorted by
// amount — this is "how the day's sale was settled", cash/card/QR and
// credit together.
function combinedPaymentRows(entries, creditCustomers) {
  return [...paymentsBreakdown(entries), ...customerCreditBreakdown(entries, creditCustomers)].sort((a, b) => b.amount - a.amount)
}

// Everything that isn't money collected for fuel today: employee credit
// (an employee's personal draw, tracked against their salary — not a
// customer sale) and expense lines (cash paid straight back out). Grouped
// by label and summed, same as the payment breakdown.
function remainingExpensesBreakdown(entries) {
  const totals = new Map()
  for (const entry of entries || []) {
    for (const p of entry.payments || []) {
      if (isCashPayment(p) || p.type === 'credit') continue
      const label = (p.label || '').trim() || '—'
      totals.set(label, (totals.get(label) || 0) + (Number(p.amount) || 0))
    }
  }
  return [...totals.entries()].map(([label, amount]) => ({ label, amount })).sort((a, b) => b.amount - a.amount)
}

// Cash lines don't get a litres figure — a cash line commonly covers a mix
// of fuels, so there's no single rate to divide by. Every other payment
// method settles against one particular fuel: the ones that name it in
// their own label (Card/QR (Petrol/Diesel)), plus a fixed house convention
// for the ones that don't (Company QR/Extra Power → diesel, Extra QR/Extra
// Reward → petrol) — Extra Test has no fixed fuel, so it's left blank.
// Customer credit always converts at the diesel rate, regardless of label.
const CASH_LABELS = new Set(['cash', 'day cash', 'night cash'])
const DIESEL_CONVENTION_LABELS = new Set(['company qr', 'extra power'])
const PETROL_CONVENTION_LABELS = new Set(['extra qr', 'extra reward'])

// Which fuel a row's litres are converted at — shown right next to the
// method/customer name so it's never ambiguous which rate produced the figure.
function rowConversionFuel(row) {
  if (row.kind === 'credit') return 'diesel'
  const lbl = (row.label || '').trim().toLowerCase()
  if (CASH_LABELS.has(lbl)) return null
  if (lbl.includes('petrol') || PETROL_CONVENTION_LABELS.has(lbl)) return 'petrol'
  if (lbl.includes('diesel') || DIESEL_CONVENTION_LABELS.has(lbl)) return 'diesel'
  return null
}

function rowLiters(row, dayTotals) {
  const fuel = rowConversionFuel(row)
  if (!fuel) return null
  const amt = Number(row.amount) || 0
  if (!amt) return null
  const petrolRate = dayTotals.petrolLtr > 0 ? dayTotals.petrolAmount / dayTotals.petrolLtr : 0
  const dieselRate = dayTotals.dieselLtr > 0 ? dayTotals.dieselAmount / dayTotals.dieselLtr : 0
  if (fuel === 'petrol' && petrolRate > 0) return amt / petrolRate
  if (fuel === 'diesel' && dieselRate > 0) return amt / dieselRate
  return null
}

// Everything here is a client-side snapshot: editing the "Overall Day Total"
// fields lets the auditor record their own reconciled figures on the report
// without silently rewriting the real, saved fuel entries underneath.
export default function AuditModal({ isOpen, onClose, date, station, onUpdateAuditContact, pump1, pump2, dayTotals, billsCount, employees, creditCustomers }) {
  const { language } = useLanguage()
  const t = FUEL_ENTRY_TEXT[language].audit

  const [auditorName, setAuditorName] = useState('')
  const [remarks, setRemarks] = useState('')
  const [editedSale, setEditedSale] = useState(String(dayTotals.totalSaleAmount))
  const [editedPayments, setEditedPayments] = useState(String(dayTotals.totalPayments))
  const [editedVariance, setEditedVariance] = useState(String(dayTotals.excessShortage))
  const [contactEmail, setContactEmail] = useState(station?.auditContactEmail || SUGGESTED_AUDIT_EMAIL)
  const [sending, setSending] = useState(false)
  // Opening Stock (what was already in the tank before today's delivery) +
  // Stock Received Today, minus what the meters show as sold today, is
  // what's left right now — the manager types both sides of that balance in.
  const [openingStockPetrol, setOpeningStockPetrol] = useState('')
  const [openingStockDiesel, setOpeningStockDiesel] = useState('')
  const [stockReceivedPetrol, setStockReceivedPetrol] = useState('')
  const [stockReceivedDiesel, setStockReceivedDiesel] = useState('')

  const variance = Number(editedVariance) || 0
  const currentStockPetrol = (Number(openingStockPetrol) || 0) + (Number(stockReceivedPetrol) || 0) - dayTotals.petrolLtr
  const currentStockDiesel = (Number(openingStockDiesel) || 0) + (Number(stockReceivedDiesel) || 0) - dayTotals.dieselLtr
  const dayEntries = useMemo(() => [...(pump1.entries || []), ...(pump2.entries || [])], [pump1.entries, pump2.entries])
  const paymentRows = useMemo(() => combinedPaymentRows(dayEntries, creditCustomers), [dayEntries, creditCustomers])
  const remainingExpenseRows = useMemo(() => remainingExpensesBreakdown(dayEntries), [dayEntries])
  const remainingExpensesTotal = useMemo(() => remainingExpenseRows.reduce((sum, r) => sum + r.amount, 0), [remainingExpenseRows])
  const pocketAndServoOilAmount = dayTotals.pocketOilTotal + dayTotals.caneOilTotal

  async function buildWorkbookBlob() {
    const ExcelJS = (await import('exceljs')).default
    const workbook = new ExcelJS.Workbook()
    workbook.creator = station?.name || 'Fuel Pump Manager'
    const sheet = workbook.addWorksheet('Audit Report')

    sheet.addRow([t.reportTitle]).font = { bold: true, size: 14 }
    sheet.addRow([station?.name || ''])
    sheet.addRow([t.dateLabel, formatDate(date)])
    sheet.addRow([t.auditorNameLabel, auditorName || '—'])
    sheet.addRow([])

    sheet.addRow([t.daySummaryTitle]).font = { bold: true }
    const header = sheet.addRow([t.colFuel, t.colLitres, t.colAmount])
    header.font = { bold: true }
    sheet.addRow([t.colPetrol, roundLtr(dayTotals.petrolLtr), formatCurrency(dayTotals.petrolAmount)])
    sheet.addRow([t.colDiesel, roundLtr(dayTotals.dieselLtr), formatCurrency(dayTotals.dieselAmount)])
    if (dayTotals.oilLtr) sheet.addRow([t.colOil, roundLtr(dayTotals.oilLtr), formatCurrency(dayTotals.oilAmount)])
    sheet.addRow([t.colPocketCane, '—', formatCurrency(pocketAndServoOilAmount)])
    sheet.addRow([t.fieldSale, '', formatCurrency(dayTotals.totalSaleAmount)]).font = { bold: true }
    sheet.addRow([])

    sheet.addRow([t.paymentsBreakdownTitle]).font = { bold: true }
    const paymentsHeader = sheet.addRow([t.colMethod, t.colLitres, t.colAmount])
    paymentsHeader.font = { bold: true }
    for (const row of paymentRows) {
      const fuel = rowConversionFuel(row)
      const litres = rowLiters(row, dayTotals)
      const labelWithFuel = fuel ? `${row.label} (${fuel === 'petrol' ? t.colPetrol : t.colDiesel})` : row.label
      sheet.addRow([labelWithFuel, litres != null ? roundLtr(litres) : '—', formatCurrency(row.amount)])
    }
    sheet.addRow([])

    if (remainingExpenseRows.length) {
      sheet.addRow([t.remainingExpensesTitle]).font = { bold: true }
      const remainingHeader = sheet.addRow([t.colMethod, t.colAmount])
      remainingHeader.font = { bold: true }
      for (const row of remainingExpenseRows) {
        sheet.addRow([row.label, formatCurrency(row.amount)])
      }
      sheet.addRow([t.totalRemainingExpensesLabel, formatCurrency(remainingExpensesTotal)]).font = { bold: true }
      sheet.addRow([])
    }

    sheet.addRow([t.fuelStockTitle]).font = { bold: true }
    const stockHeader = sheet.addRow([t.colFuel, t.colOpeningStock, t.colStockReceived, t.colCurrentStock, t.colSoldToday])
    stockHeader.font = { bold: true }
    sheet.addRow([
      t.colPetrol,
      Number(openingStockPetrol) || 0,
      Number(stockReceivedPetrol) || 0,
      roundLtr(currentStockPetrol),
      roundLtr(dayTotals.petrolLtr),
    ])
    sheet.addRow([
      t.colDiesel,
      Number(openingStockDiesel) || 0,
      Number(stockReceivedDiesel) || 0,
      roundLtr(currentStockDiesel),
      roundLtr(dayTotals.dieselLtr),
    ])
    sheet.addRow([])

    sheet.addRow([t.overallTitle]).font = { bold: true }
    sheet.addRow([t.fieldSale, formatCurrency(Number(editedSale) || 0)])
    sheet.addRow([t.fieldPayments, formatCurrency(Number(editedPayments) || 0)])
    sheet.addRow([t.fieldVariance, formatCurrency(variance)])
    sheet.addRow([t.billsLabel, billsCount])
    sheet.addRow([])
    sheet.addRow([t.remarksLabel, remarks || '—'])

    sheet.columns.forEach((col) => { col.width = 22 })

    const buffer = await workbook.xlsx.writeBuffer()
    return new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
  }

  function downloadBlob(blob) {
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `audit-report-${date}.xlsx`
    a.click()
    URL.revokeObjectURL(url)
  }

  async function handleDownload() {
    setSending(true)
    try {
      downloadBlob(await buildWorkbookBlob())
      toast.success(t.toastDownloaded)
    } finally {
      setSending(false)
    }
  }

  async function handleSendEmail() {
    if (!contactEmail.trim()) {
      toast.error(t.contactRequired)
      return
    }
    // Must be the very first thing in this click handler — opening a mailto:
    // link is only reliably treated as a direct response to the click (not
    // blocked as a pop-up) when it's the first thing the handler does;
    // building the file (below, async) has to happen after this.
    const subject = `${station?.name || ''} — ${t.reportTitle} — ${formatDate(date)}`
    const body = t.whatsAppMessage(
      station?.name || '',
      formatDate(date),
      formatCurrency(Number(editedSale) || 0),
      formatCurrency(Number(editedPayments) || 0),
      `${t.fieldVariance}: ${variance >= 0 ? '+' : ''}${formatCurrency(variance)}`,
    )
    window.location.href = buildMailtoLink(contactEmail, subject, body)
    onUpdateAuditContact?.(contactEmail.trim())

    setSending(true)
    try {
      downloadBlob(await buildWorkbookBlob())
      toast.success(t.toastSent)
    } finally {
      setSending(false)
    }
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={t.modalTitle} maxWidth="max-w-3xl">
      <div className="space-y-5">
        <div className="flex items-center gap-2 rounded-lg bg-brand-50 px-3 py-2.5 text-sm">
          <ClipboardCheck size={16} className="shrink-0 text-brand-600" />
          <span className="font-semibold text-slate-700">{station?.name}</span>
          <span className="text-slate-400">·</span>
          <span className="text-slate-600">{formatDate(date)}</span>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field label={t.auditorNameLabel}>
            <Input value={auditorName} onChange={(e) => setAuditorName(e.target.value)} placeholder={t.auditorNamePlaceholder} />
          </Field>
          <Field label={t.billsLabel}>
            <Input value={billsCount} readOnly disabled className="bg-slate-50" />
          </Field>
        </div>

        <div>
          <p className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-500">{t.daySummaryTitle}</p>
          <div className="overflow-x-auto rounded-lg border border-slate-200">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50">
                <tr className="text-slate-400">
                  <th className="px-3 py-2 font-semibold">{t.colFuel}</th>
                  <th className="px-3 py-2 font-semibold">{t.colLitres}</th>
                  <th className="px-3 py-2 text-right font-semibold">{t.colAmount}</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-t border-slate-100">
                  <td className="px-3 py-2 font-semibold text-orange-600">{t.colPetrol}</td>
                  <td className="px-3 py-2 font-semibold text-slate-700">{roundLtr(dayTotals.petrolLtr)} L</td>
                  <td className="px-3 py-2 text-right text-slate-600">{formatCurrency(dayTotals.petrolAmount)}</td>
                </tr>
                <tr className="border-t border-slate-100">
                  <td className="px-3 py-2 font-semibold text-blue-600">{t.colDiesel}</td>
                  <td className="px-3 py-2 font-semibold text-slate-700">{roundLtr(dayTotals.dieselLtr)} L</td>
                  <td className="px-3 py-2 text-right text-slate-600">{formatCurrency(dayTotals.dieselAmount)}</td>
                </tr>
                {dayTotals.oilLtr ? (
                  <tr className="border-t border-slate-100">
                    <td className="px-3 py-2 font-semibold text-emerald-600">{t.colOil}</td>
                    <td className="px-3 py-2 font-semibold text-slate-700">{roundLtr(dayTotals.oilLtr)} L</td>
                    <td className="px-3 py-2 text-right text-slate-600">{formatCurrency(dayTotals.oilAmount)}</td>
                  </tr>
                ) : null}
                <tr className="border-t border-slate-100">
                  <td className="px-3 py-2 font-semibold text-emerald-700">{t.colPocketCane}</td>
                  <td className="px-3 py-2 text-slate-400">—</td>
                  <td className="px-3 py-2 text-right text-slate-600">{formatCurrency(pocketAndServoOilAmount)}</td>
                </tr>
                <tr className="border-t border-slate-200 bg-slate-50">
                  <td className="px-3 py-2 font-bold text-slate-800" colSpan={2}>{t.fieldSale}</td>
                  <td className="px-3 py-2 text-right font-bold text-slate-800">{formatCurrency(dayTotals.totalSaleAmount)}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <div>
          <p className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-500">{t.paymentsBreakdownTitle}</p>
          <div className="overflow-x-auto rounded-lg border border-slate-200">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50">
                <tr className="text-slate-400">
                  <th className="px-3 py-2 font-semibold">{t.colMethod}</th>
                  <th className="px-3 py-2 text-right font-semibold">{t.colLitres}</th>
                  <th className="px-3 py-2 text-right font-semibold">{t.colAmount}</th>
                </tr>
              </thead>
              <tbody>
                {paymentRows.map((row, i) => {
                  const fuel = rowConversionFuel(row)
                  const litres = rowLiters(row, dayTotals)
                  return (
                    <tr key={`${row.kind}-${row.label}-${i}`} className="border-t border-slate-100">
                      <td className={`px-3 py-2 font-medium ${row.kind === 'credit' ? 'text-rose-600' : 'text-slate-700'}`}>
                        {row.label}
                        {row.kind === 'credit' ? (
                          <span className="ml-1.5 rounded-full bg-rose-50 px-1.5 py-0.5 text-[10px] font-semibold text-rose-600">{t.creditPillLabel}</span>
                        ) : null}
                        {fuel ? (
                          <span
                            className={`ml-1.5 rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${
                              fuel === 'petrol' ? 'bg-orange-50 text-orange-600' : 'bg-blue-50 text-blue-600'
                            }`}
                          >
                            {fuel === 'petrol' ? t.colPetrol : t.colDiesel}
                          </span>
                        ) : null}
                      </td>
                      <td className="px-3 py-2 text-right text-slate-500">{litres != null ? `${roundLtr(litres)} L` : '—'}</td>
                      <td className="px-3 py-2 text-right font-semibold text-slate-800">{formatCurrency(row.amount)}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>

        {remainingExpenseRows.length ? (
          <div>
            <p className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-500">{t.remainingExpensesTitle}</p>
            <div className="overflow-x-auto rounded-lg border border-slate-200">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50">
                  <tr className="text-slate-400">
                    <th className="px-3 py-2 font-semibold">{t.colMethod}</th>
                    <th className="px-3 py-2 text-right font-semibold">{t.colAmount}</th>
                  </tr>
                </thead>
                <tbody>
                  {remainingExpenseRows.map((row) => (
                    <tr key={row.label} className="border-t border-slate-100">
                      <td className="px-3 py-2 font-medium text-amber-700">{row.label}</td>
                      <td className="px-3 py-2 text-right font-semibold text-slate-800">{formatCurrency(row.amount)}</td>
                    </tr>
                  ))}
                  <tr className="border-t border-slate-200 bg-slate-50">
                    <td className="px-3 py-2 font-bold text-slate-800">{t.totalRemainingExpensesLabel}</td>
                    <td className="px-3 py-2 text-right font-bold text-slate-800">{formatCurrency(remainingExpensesTotal)}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        ) : null}

        <div>
          <p className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-500">{t.fuelStockTitle}</p>
          <p className="mb-2 text-xs text-slate-400">{t.stockHint}</p>
          <div className="overflow-x-auto rounded-lg border border-slate-200">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50">
                <tr className="text-slate-400">
                  <th className="px-3 py-2 font-semibold">{t.colFuel}</th>
                  <th className="px-3 py-2 font-semibold">{t.colOpeningStock}</th>
                  <th className="px-3 py-2 font-semibold">{t.colStockReceived}</th>
                  <th className="px-3 py-2 font-semibold">{t.colCurrentStock}</th>
                  <th className="px-3 py-2 text-right font-semibold">{t.colSoldToday}</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-t border-slate-100">
                  <td className="px-3 py-2 font-semibold text-orange-600">{t.colPetrol}</td>
                  <td className="px-3 py-2">
                    <div className="w-28">
                      <Input type="number" step="any" min="0" value={openingStockPetrol} onChange={(e) => setOpeningStockPetrol(e.target.value)} placeholder="0" />
                    </div>
                  </td>
                  <td className="px-3 py-2">
                    <div className="w-28">
                      <Input type="number" step="any" min="0" value={stockReceivedPetrol} onChange={(e) => setStockReceivedPetrol(e.target.value)} placeholder="0" />
                    </div>
                  </td>
                  <td className={`px-3 py-2 font-semibold ${currentStockPetrol >= 0 ? 'text-emerald-600' : 'text-rose-500'}`}>
                    {roundLtr(currentStockPetrol)} L
                  </td>
                  <td className="px-3 py-2 text-right text-slate-600">{roundLtr(dayTotals.petrolLtr)} L</td>
                </tr>
                <tr className="border-t border-slate-100">
                  <td className="px-3 py-2 font-semibold text-blue-600">{t.colDiesel}</td>
                  <td className="px-3 py-2">
                    <div className="w-28">
                      <Input type="number" step="any" min="0" value={openingStockDiesel} onChange={(e) => setOpeningStockDiesel(e.target.value)} placeholder="0" />
                    </div>
                  </td>
                  <td className="px-3 py-2">
                    <div className="w-28">
                      <Input type="number" step="any" min="0" value={stockReceivedDiesel} onChange={(e) => setStockReceivedDiesel(e.target.value)} placeholder="0" />
                    </div>
                  </td>
                  <td className={`px-3 py-2 font-semibold ${currentStockDiesel >= 0 ? 'text-emerald-600' : 'text-rose-500'}`}>
                    {roundLtr(currentStockDiesel)} L
                  </td>
                  <td className="px-3 py-2 text-right text-slate-600">{roundLtr(dayTotals.dieselLtr)} L</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <div className="rounded-lg border border-amber-200 bg-amber-50/60 p-3.5">
          <p className="mb-1 text-xs font-bold uppercase tracking-wide text-amber-700">{t.overallTitle}</p>
          <p className="mb-3 text-xs text-amber-700/80">{t.overallHint}</p>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <Field label={t.fieldSale}>
              <Input type="number" step="any" value={editedSale} onChange={(e) => setEditedSale(e.target.value)} />
            </Field>
            <Field label={t.fieldPayments}>
              <Input type="number" step="any" value={editedPayments} onChange={(e) => setEditedPayments(e.target.value)} />
            </Field>
            <Field label={t.fieldVariance}>
              <Input
                type="number"
                step="any"
                value={editedVariance}
                onChange={(e) => setEditedVariance(e.target.value)}
                className={variance >= 0 ? 'text-emerald-700' : 'text-rose-600'}
              />
            </Field>
          </div>
        </div>

        <Field label={t.remarksLabel}>
          <Textarea value={remarks} onChange={(e) => setRemarks(e.target.value)} placeholder={t.remarksPlaceholder} rows={2} />
        </Field>

        <div className="border-t border-slate-100 pt-4">
          <Field label={t.contactLabel}>
            <Input
              type="email"
              value={contactEmail}
              onChange={(e) => setContactEmail(e.target.value)}
              placeholder={t.contactPlaceholder}
            />
          </Field>
          {contactEmail.trim() !== SUGGESTED_AUDIT_EMAIL ? (
            <button
              type="button"
              onClick={() => setContactEmail(SUGGESTED_AUDIT_EMAIL)}
              className="mt-1.5 text-xs font-semibold text-brand-600 hover:underline"
            >
              {t.contactSuggestedHint(SUGGESTED_AUDIT_EMAIL)}
            </button>
          ) : null}
          <p className="mt-1.5 text-xs text-slate-400">{t.sendHint}</p>
          <div className="mt-3 flex flex-wrap justify-end gap-2">
            <SecondaryButton type="button" onClick={handleDownload} disabled={sending}>
              <Download size={15} /> {t.downloadButton}
            </SecondaryButton>
            <PrimaryButton type="button" onClick={handleSendEmail} disabled={sending}>
              <Send size={15} /> {t.sendWhatsAppButton}
            </PrimaryButton>
          </div>
        </div>
      </div>
    </Modal>
  )
}
