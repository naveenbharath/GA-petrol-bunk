import { useEffect, useMemo, useRef, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import toast from 'react-hot-toast'
import {
  Plus,
  X,
  Landmark,
  Droplet,
  Coins,
  Receipt,
  Fuel,
  Upload,
  Paperclip,
  StickyNote,
  Save,
  CloudUpload,
  AlertTriangle,
  TrendingUp,
} from 'lucide-react'
import {
  FUEL_KEYS_BY_PUMP,
  NOZZLE_KEYS,
  readingLiters,
  readingAmount,
  entryFuelAmount,
  entryFuelLiters,
  shiftSaleAmount,
  emptyShiftEntry,
  emptyPaymentLine,
  emptyOilRow,
  emptyCaneOilRow,
  caneOilAmount,
  sortPumpEntries,
  withCarriedOpenings,
  aggregateEntries,
  PAYMENT_METHOD_OPTIONS,
} from '../utils/fuelCalc.js'
import { formatCurrency, formatDate, todayISO } from '../utils/format.js'
import { currentRate, purchaseBatchesByCost, sortedPriceHistory, stockAvailableAtRate } from '../utils/lubricants.js'
import { resolveFileUrl, uploadFile } from '../lib/apiClient.js'
import { Input, Select, Textarea, IconButton, PrimaryButton } from './FormControls.jsx'
import ConfirmDialog from './ConfirmDialog.jsx'
import { useData } from '../context/DataContext.jsx'
import { useLanguage } from '../context/LanguageContext.jsx'
import { FUEL_ENTRY_TEXT } from '../i18n/fuelEntry.js'

function makeBillId() {
  return `bill-${Math.random().toString(36).slice(2, 9)}`
}

// A labeled on/off switch — used for turning the 2nd/3rd shift employee on
// or off, instead of a plain "Add" button, so the pump header reads like a
// small settings row rather than a growing list of one-shot action buttons.
function ToggleSwitch({ checked, onChange, label, disabled, title }) {
  return (
    <label className={`flex items-center gap-2 select-none ${disabled ? 'cursor-not-allowed opacity-40' : 'cursor-pointer'}`} title={title}>
      <span className="text-sm font-semibold text-slate-600">{label}</span>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={label}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${checked ? 'bg-brand-600' : 'bg-slate-200'}`}
      >
        <motion.span
          className="absolute top-0.5 h-5 w-5 rounded-full bg-white shadow"
          initial={false}
          animate={{ left: checked ? '1.375rem' : '0.125rem' }}
          transition={{ type: 'spring', stiffness: 500, damping: 32 }}
        />
      </button>
    </label>
  )
}

const TINTS = {
  violet: { bg: 'bg-violet-100/70', border: 'border-violet-200' },
  blue: { bg: 'bg-blue-50/60', border: 'border-blue-100' },
}

// Distinct color per fuel type so Petrol/Diesel/Oil rows are tellable apart
// at a glance instead of all reading as the same muted gray label.
const FUEL_LABEL_COLORS = {
  petrol: 'text-orange-600',
  diesel: 'text-blue-600',
  oil: 'text-emerald-600',
}


// A currency figure that pops in whenever its displayed value actually
// changes (so totals updating as someone types is visible, not just a
// silent swap), and can "breathe" with a slow pulse for a figure that
// needs the manager's attention right now (a shortfall).
function AnimatedFigure({ value, signed = false, pulse = false, className = '' }) {
  const formatted = formatCurrency(value)
  return (
    <AnimatePresence mode="popLayout">
      <motion.span
        key={formatted}
        initial={{ opacity: 0, y: -6, scale: 0.9 }}
        animate={{ opacity: 1, y: 0, scale: pulse ? [1, 1.05, 1] : 1 }}
        transition={
          pulse
            ? { scale: { duration: 1.1, repeat: Infinity, ease: 'easeInOut' }, opacity: { duration: 0.22 }, y: { duration: 0.22 } }
            : { duration: 0.22, ease: 'easeOut' }
        }
        className={`inline-block ${className}`}
      >
        {signed && value >= 0 ? '+' : ''}
        {formatted}
      </motion.span>
    </AnimatePresence>
  )
}

// Payment-line labels that represent physical cash — these get the
// note/coin counter icon, whichever shift the cash was collected in.
const CASH_LABELS = new Set(['cash', 'day cash', 'night cash'])

// Which fuel a payment method's litres are converted at. Methods that name
// their fuel in the label (Card/QR (Petrol/Diesel)) use that directly;
// methods that don't (Company QR, Extra QR/Power/Reward) settle against one
// particular fuel at this station by fixed convention — Extra Test has no
// fixed fuel, so it's left unconverted.
const DIESEL_CONVENTION_LABELS = new Set(['company qr', 'extra power'])
const PETROL_CONVENTION_LABELS = new Set(['extra qr', 'extra reward'])
function paymentConversionFuel(label) {
  const lbl = (label || '').trim().toLowerCase()
  if (CASH_LABELS.has(lbl)) return null
  if (lbl.includes('petrol') || PETROL_CONVENTION_LABELS.has(lbl)) return 'petrol'
  if (lbl.includes('diesel') || DIESEL_CONVENTION_LABELS.has(lbl)) return 'diesel'
  return null
}

// A cash line at or above this is treated as "big cash" — worth a blinking
// highlight so it doesn't get glossed over while scanning the list.
const BIG_CASH_THRESHOLD = 50000

// Notes counted at these face values; anything smaller is lumped into one
// "coins" total rather than tracked coin-by-coin.
const NOTE_VALUES = [500, 200, 100, 50, 20, 10]

function denominationTotal(denominations) {
  if (!denominations) return 0
  const notesTotal = NOTE_VALUES.reduce((sum, note) => sum + note * (Number(denominations[note]) || 0), 0)
  return notesTotal + (Number(denominations.coins) || 0)
}

// Clamps a typed count so it can never exceed the product's available stock
// (when a product is selected and its stock is known).
function clampToStock(v, available) {
  if (v === '') return ''
  const n = Number(v)
  if (Number.isNaN(n)) return v
  const max = available == null ? Infinity : available
  return String(Math.min(Math.max(n, 0), max))
}

// The same product at the same rate should only ever be one row — picking
// it again in a second row is almost always a mistake (the manager meant to
// add to the existing row's count instead). Returns the set of row ids that
// share a (productId, rate) pair with at least one other row in the list;
// rows still missing either field are never flagged (nothing to conflict on
// yet). Pocket oil and cane oil are checked as two separate lists, never
// against each other.
function duplicateRowIds(rows) {
  const seen = new Map()
  for (const row of rows || []) {
    if (!row.productId || !row.stockRate) continue
    const key = `${row.productId}::${row.stockRate}`
    if (!seen.has(key)) seen.set(key, [])
    seen.get(key).push(row.id)
  }
  const duplicates = new Set()
  for (const ids of seen.values()) {
    if (ids.length > 1) ids.forEach((id) => duplicates.add(id))
  }
  return duplicates
}

// Every rate the product has ever sold at (its price history), most recent
// first and de-duplicated — the manager picks which one applies to this
// sale instead of typing a number freely.
function priceOptions(product) {
  const seen = new Set()
  const opts = []
  for (const entry of [...sortedPriceHistory(product)].reverse()) {
    if (seen.has(entry.rate)) continue
    seen.add(entry.rate)
    opts.push(entry.rate)
  }
  return opts
}

// Small chip row showing how many units of the selected product were bought
// at each distinct cost — e.g. "20 @ ₹260   10 @ ₹280" — so the manager can
// see the stock's purchase makeup at a glance. Only shown when purchases
// span more than one rate; at a single rate the combined "Available" count
// already says everything this row would, so it stays hidden to avoid
// repeating the same number twice.
function PurchaseBatches({ t, product }) {
  const batches = purchaseBatchesByCost(product)
  if (batches.length <= 1) return null
  return (
    <div className="mt-2 flex flex-wrap items-center gap-1.5 text-xs text-slate-500">
      <span className="font-semibold text-slate-500">{t.batchesLabel}:</span>
      {batches.map((b) => (
        <span key={b.cost} className="rounded-full bg-slate-100 px-2.5 py-1 font-medium text-slate-600">
          {b.qty} @ {formatCurrency(b.cost)}
        </span>
      ))}
    </div>
  )
}

// One row of "sold by count, not by nozzle" oil — Product/Count/Rate → Amount.
// Shared by both the Pocket and Cane oil sections, which are otherwise
// identical (each supports multiple rows via its own "Add more" button).
// Rate and Count always update together through one callback — updating
// them via two separate calls let the second silently clobber the first
// (both closed over the same not-yet-updated `value`), so a rate change
// could get lost the instant it also re-clamped the count.
function OilRow({ t, lubricants, productId, onSelectProduct, count, rate, onRateAndCountChange, amount, onRemove, showRemove, isDuplicate }) {
  const selectedProduct = (lubricants || []).find((p) => p.id === productId)
  const available = selectedProduct ? (rate ? stockAvailableAtRate(selectedProduct, rate) : Number(selectedProduct.stock) || 0) : null

  function handleCountChange(v) {
    onRateAndCountChange(rate, clampToStock(v, available))
  }

  function handleRateChange(newRate) {
    if (selectedProduct && newRate) {
      const newAvailable = stockAvailableAtRate(selectedProduct, newRate)
      onRateAndCountChange(newRate, Number(count) > newAvailable ? String(newAvailable) : count)
    } else {
      onRateAndCountChange(newRate, count)
    }
  }

  return (
    <div>
      <div className="flex flex-wrap items-center gap-2.5">
        <span className="shrink-0 text-sm font-semibold text-slate-600">{t.oilProductLabel}</span>
        <div className="w-56 shrink-0">
          <Select
            value={productId || ''}
            onChange={(e) => onSelectProduct(e.target.value)}
            className={isDuplicate ? 'border-rose-400 focus:border-rose-500 focus:ring-rose-100' : ''}
          >
            <option value="">{t.selectProduct}</option>
            {(lubricants || []).map((product) => (
              <option key={product.id} value={product.id}>
                {product.name}
              </option>
            ))}
          </Select>
        </div>
        <span className="shrink-0 text-sm font-semibold text-slate-600">{t.rate}</span>
        <div className="w-32 shrink-0">
          <Select
            value={rate || ''}
            onChange={(e) => handleRateChange(e.target.value)}
            disabled={!selectedProduct}
            title={t.oilStockRateHint}
            className={isDuplicate ? 'border-rose-400 focus:border-rose-500 focus:ring-rose-100' : ''}
          >
            <option value="">{t.selectRate}</option>
            {priceOptions(selectedProduct).map((r) => (
              <option key={r} value={r}>
                {formatCurrency(r)}
              </option>
            ))}
          </Select>
        </div>
        {selectedProduct ? (
          <span className="shrink-0 text-sm font-medium text-slate-500">
            {t.availableLabel}: <span className="font-bold text-slate-700">{available} {selectedProduct.unit}</span>
          </span>
        ) : null}
        <span className="shrink-0 text-sm font-semibold text-slate-600">{t.soldCountLabel}</span>
        <div className="w-24 shrink-0">
          <Input
            type="number"
            min="0"
            max={available ?? undefined}
            step="any"
            value={count || ''}
            onChange={(e) => handleCountChange(e.target.value)}
            placeholder="0"
            title={available != null ? t.soldCountHint(available) : undefined}
          />
        </div>
        <div className="ml-auto flex shrink-0 items-center gap-2">
          <span className="text-sm font-semibold text-slate-600">{t.amount}:</span>
          <div className="w-40 shrink-0">
            <Input value={formatCurrency(amount)} readOnly disabled className="bg-slate-50 font-bold text-emerald-700" />
          </div>
        </div>
        {showRemove ? (
          <IconButton onClick={onRemove} aria-label={t.removeOilRow} title={t.removeOilRow} tone="delete">
            <X size={15} />
          </IconButton>
        ) : null}
      </div>
      {selectedProduct ? <PurchaseBatches t={t} product={selectedProduct} /> : null}
      {isDuplicate ? <p className="mt-1.5 text-xs font-medium text-rose-500">{t.duplicateOilRowHint}</p> : null}
    </div>
  )
}

// One employee's shift — a fully independent, separately-saved record.
// There's no "Save as Draft" button: any edit here quietly persists itself
// (debounced) as a draft, so switching pages or refreshing the browser
// never loses progress. "Save Entry" stays a deliberate action — it's the
// only thing that finalizes a shift (requires bills, applies attendance/
// credit/stock effects) — so autosave never touches an already-final shift.
function ShiftCard({
  t,
  tRoot,
  pumpKey,
  value,
  onChange,
  isDerivedOpening,
  employees,
  creditCustomers,
  lubricants,
  onSaveDraft,
  onSaveFinal,
}) {
  const fuelKeys = FUEL_KEYS_BY_PUMP[pumpKey]
  const [openDenomId, setOpenDenomId] = useState(null)
  const [attemptedSubmit, setAttemptedSubmit] = useState(false)
  const [shakeKey, setShakeKey] = useState(0)
  const [autoSaveStatus, setAutoSaveStatus] = useState('idle') // 'idle' | 'pending' | 'saved'
  // Snapshot of `value` as of the last time this effect actually scheduled a
  // save (or, initially, as of first render) — comparing by reference rather
  // than a one-shot boolean flag survives React StrictMode's dev-only double
  // invocation of effects, which would otherwise consume a "skip the first
  // run" flag on its extra invocation and fire a phantom save on mount.
  const lastSeenValue = useRef(value)

  // Debounced autosave — waits for a pause in typing before persisting, and
  // never fires on mount (that would just re-save data that's already
  // exactly as loaded) or once the shift has been finalized.
  useEffect(() => {
    if (value.status === 'final') return
    if (value === lastSeenValue.current) return
    lastSeenValue.current = value
    setAutoSaveStatus('pending')
    const timer = setTimeout(async () => {
      try {
        await onSaveDraft(value)
        setAutoSaveStatus('saved')
      } catch (err) {
        setAutoSaveStatus('idle')
        toast.error(err.message || tRoot.toastAutoSaveFailed)
      }
    }, 900)
    return () => clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value])

  const packetProducts = (lubricants || []).filter((p) => p.packaging !== 'cane')
  const caneProducts = (lubricants || []).filter((p) => p.packaging === 'cane')

  function updateReading(fuelKey, nozzleKey, field, v) {
    onChange({ ...value, [fuelKey]: { ...value[fuelKey], [nozzleKey]: { ...value[fuelKey][nozzleKey], [field]: v } } })
  }

  function updatePayments(updater) {
    onChange({ ...value, payments: updater(value.payments || []) })
  }

  // Litres a payment line's amount represents, at this shift's own average
  // fuel rate — worked out from the label (Petrol/Diesel) rather than typed
  // separately, since a payment is always for one fuel or the other. Cash
  // lines skip this (a cash line commonly covers a mix of fuels, so there's
  // no single rate to divide by).
  const petrolLtrThisShift = entryFuelLiters(value, 'petrol')
  const petrolRateThisShift = petrolLtrThisShift > 0 ? entryFuelAmount(value, 'petrol') / petrolLtrThisShift : 0
  const dieselLtrThisShift = entryFuelLiters(value, 'diesel')
  const dieselRateThisShift = dieselLtrThisShift > 0 ? entryFuelAmount(value, 'diesel') / dieselLtrThisShift : 0
  function paymentLiters(p) {
    const fuel = paymentConversionFuel(p.label)
    if (!fuel) return null
    const amount = Number(p.amount) || 0
    if (!amount) return null
    if (fuel === 'petrol' && petrolRateThisShift > 0) return amount / petrolRateThisShift
    if (fuel === 'diesel' && dieselRateThisShift > 0) return amount / dieselRateThisShift
    return null
  }

  function addPaymentLine() {
    updatePayments((payments) => [...payments, emptyPaymentLine()])
  }
  function addCreditLine() {
    updatePayments((payments) => [...payments, emptyPaymentLine(t.creditLabel, 'credit')])
  }
  function addEmployeeCreditLine() {
    updatePayments((payments) => [...payments, emptyPaymentLine(t.employeeCreditLabel, 'employeeCredit')])
  }
  function addExpenseLine() {
    updatePayments((payments) => [...payments, emptyPaymentLine('', 'expense')])
  }
  function updatePaymentLine(id, field, v) {
    updatePayments((payments) => payments.map((p) => (p.id === id ? { ...p, [field]: v } : p)))
  }
  function removePaymentLine(id) {
    updatePayments((payments) => payments.filter((p) => p.id !== id))
  }
  function updateDenomination(paymentId, key, v) {
    updatePayments((payments) =>
      payments.map((p) => {
        if (p.id !== paymentId) return p
        const denominations = { ...(p.denominations || {}), [key]: v }
        return { ...p, denominations, amount: denominationTotal(denominations) }
      }),
    )
  }

  function updateBills(updater) {
    onChange({ ...value, bills: updater(value.bills || []) })
  }
  async function handleBillFileChange(e) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    try {
      const uploaded = await uploadFile(file)
      const newBill = { id: makeBillId(), name: uploaded.file_name, url: uploaded.file_url, date: todayISO() }
      updateBills((bills) => [...bills, newBill])
      toast.success(tRoot.toastBillAttached(file.name))
    } catch (err) {
      toast.error(err.message || tRoot.toastBillAttached(file.name))
    }
  }
  function removeBill(billId) {
    updateBills((bills) => bills.filter((b) => b.id !== billId))
    toast.success(tRoot.toastBillRemoved)
  }

  function addOilRow() {
    onChange({ ...value, oilRows: [...(value.oilRows || []), emptyOilRow('oil')] })
  }
  function removeOilRow(id) {
    onChange({ ...value, oilRows: value.oilRows.filter((row) => row.id !== id) })
  }
  function selectOilRowProduct(id, productId) {
    const product = (lubricants || []).find((p) => p.id === productId)
    onChange({ ...value, oilRows: value.oilRows.map((row) => (row.id === id ? { ...row, productId, stockRate: product ? currentRate(product) : '' } : row)) })
  }

  function addCaneOilRow() {
    onChange({ ...value, caneOilRows: [...(value.caneOilRows || []), emptyCaneOilRow()] })
  }
  function removeCaneOilRow(id) {
    onChange({ ...value, caneOilRows: value.caneOilRows.filter((row) => row.id !== id) })
  }
  function selectCaneOilRowProduct(id, productId) {
    const product = (lubricants || []).find((p) => p.id === productId)
    onChange({
      ...value,
      caneOilRows: value.caneOilRows.map((row) => (row.id === id ? { ...row, productId, stockRate: product ? currentRate(product) : '' } : row)),
    })
  }

  const caneOilStockAmount = caneOilAmount(value)
  const shiftTotal = shiftSaleAmount(value)
  const shiftBillsMissing = attemptedSubmit && (!value.bills || value.bills.length === 0)
  const isDraft = value.status === 'draft'
  // Same product at the same rate should only ever be one row — checked
  // separately per section (a pocket-oil duplicate never flags a cane-oil row).
  const duplicateOilRowIds = useMemo(() => duplicateRowIds(value.oilRows), [value.oilRows])
  const duplicateCaneOilRowIds = useMemo(() => duplicateRowIds(value.caneOilRows), [value.caneOilRows])
  const hasDuplicateOilRows = duplicateOilRowIds.size > 0 || duplicateCaneOilRowIds.size > 0

  function handleSaveFinalClick() {
    if (hasDuplicateOilRows) {
      toast.error(tRoot.errorDuplicateOilRow)
      return
    }
    if (!value.bills || value.bills.length === 0) {
      setAttemptedSubmit(true)
      setShakeKey((k) => k + 1)
      return
    }
    setAttemptedSubmit(true)
    onSaveFinal(value)
  }

  return (
    <div className="rounded-lg border border-slate-200 bg-white/80 p-4">
      <div className="mb-3.5 flex flex-wrap items-center gap-2">
        {value.id ? (
          isDraft ? (
            <span className="rounded-full bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-600" title={tRoot.editingDraft}>
              {tRoot.draftBadge}
            </span>
          ) : (
            <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-600">{t.savedLabel}</span>
          )
        ) : (
          <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-500">{t.unsavedLabel}</span>
        )}
        {value.status !== 'final' && autoSaveStatus === 'pending' ? (
          <span className="flex items-center gap-1 text-xs font-medium text-slate-400">
            <CloudUpload size={13} className="animate-pulse" /> {tRoot.autoSaving}
          </span>
        ) : null}
        <div className="max-w-xs flex-1">
          <Select value={value.employeeId} onChange={(e) => onChange({ ...value, employeeId: e.target.value })}>
            <option value="">{t.selectEmployee}</option>
            {employees.map((emp) => (
              <option key={emp.id} value={emp.id}>
                {emp.name}
              </option>
            ))}
          </Select>
        </div>
      </div>

      {/* The nozzle grid's columns (opening/closing/testing/rate/liters/
          amount) each need real room for a full meter reading — squeezed to
          a phone's width they'd be too narrow to read or tap. Scrolling the
          whole grid horizontally as one block (rather than shrinking it)
          keeps every column usable; the fixed pump-total banner below stays
          full-width so the running total is always visible without scrolling. */}
      <div className="-mx-1 overflow-x-auto px-1">
        <div className="min-w-[640px]">
          <div className="grid grid-cols-[0.6fr_1.7fr_1.7fr_0.7fr_1.5fr_1fr_1.1fr] gap-2 px-1 pb-1.5 text-xs font-semibold uppercase tracking-wide text-slate-400">
            <span className="text-brand-700">{t.fuel}</span>
            <span>{t.opening}</span>
            <span>{t.closing}</span>
            <span>{t.testing}</span>
            <span>{t.rate}</span>
            <span className="text-right">{t.liters}</span>
            <span className="text-right">{t.amount}</span>
          </div>
          <div className="space-y-3">
            {fuelKeys.map((fuelKey) => {
          const fuelTotal = entryFuelAmount(value, fuelKey)
          const fuelTotalLiters = entryFuelLiters(value, fuelKey)
          return (
            <div key={fuelKey} className="space-y-1.5">
              <span className={`text-sm font-bold ${FUEL_LABEL_COLORS[fuelKey] || 'text-slate-600'}`}>{t.fuelLabels[fuelKey]}</span>
              <div className="space-y-1.5">
                {NOZZLE_KEYS.map((nozzleKey, nozzleIdx) => {
                  const reading = value[fuelKey][nozzleKey]
                  const closingRaw = reading.closing
                  const hasClosing = closingRaw !== '' && closingRaw != null
                  const netLiters = readingLiters(reading)
                  const isClosingTooLow =
                    hasClosing && (Number(closingRaw) || 0) - (Number(reading.opening) || 0) - (Number(reading.testing) || 0) < 0
                  return (
                    <div key={nozzleKey}>
                      <div className="grid grid-cols-[0.6fr_1.7fr_1.7fr_0.7fr_1.5fr_1fr_1.1fr] items-center gap-2">
                        <span className="pl-2 text-xs font-medium text-slate-500">{t.nozzleLabel(nozzleIdx + 1)}</span>
                        <Input
                          type="number"
                          step="any"
                          value={reading.opening}
                          disabled={isDerivedOpening}
                          onChange={(e) => updateReading(fuelKey, nozzleKey, 'opening', e.target.value)}
                          placeholder="0"
                          className={`px-2.5 py-2 ${isDerivedOpening ? 'bg-slate-50 text-slate-400' : ''}`}
                          title={isDerivedOpening ? t.autoFromHandover : undefined}
                        />
                        <Input
                          type="number"
                          step="any"
                          value={closingRaw}
                          onChange={(e) => updateReading(fuelKey, nozzleKey, 'closing', e.target.value)}
                          placeholder="0"
                          className={`px-2.5 py-2 ${isClosingTooLow ? 'border-rose-400 bg-rose-50 focus:border-rose-500 focus:ring-rose-100' : ''}`}
                          title={isClosingTooLow ? t.closingTooLowHint : undefined}
                        />
                        <Input
                          type="number"
                          step="any"
                          value={reading.testing}
                          onChange={(e) => updateReading(fuelKey, nozzleKey, 'testing', e.target.value)}
                          placeholder="0"
                          className="px-2.5 py-2"
                        />
                        <Input
                          type="number"
                          step="any"
                          value={reading.rate}
                          onChange={(e) => updateReading(fuelKey, nozzleKey, 'rate', e.target.value)}
                          placeholder="0.00"
                          className="px-2.5 py-2"
                        />
                        <span
                          className={`text-right text-sm ${isClosingTooLow ? 'font-semibold text-rose-500' : 'text-slate-500'}`}
                          title={isClosingTooLow ? t.closingTooLowHint : t.litersHint}
                        >
                          {netLiters.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </span>
                        <span className={`text-right text-sm font-semibold ${isClosingTooLow ? 'text-rose-500' : 'text-slate-700'}`}>
                          {formatCurrency(readingAmount(reading))}
                        </span>
                      </div>
                      {isClosingTooLow ? (
                        <p className="pl-2 pt-1 text-xs font-medium text-rose-500">
                          {t.closingTooLowHint} ({t.opening.toLowerCase()}: {Number(reading.opening).toLocaleString('en-IN')})
                        </p>
                      ) : null}
                    </div>
                  )
                })}
                <div className="grid grid-cols-[0.6fr_1.7fr_1.7fr_0.7fr_1.5fr_1fr_1.1fr] items-center gap-2 border-t border-dashed border-slate-200 pt-1.5">
                  <span className={`pl-2 text-xs font-bold ${FUEL_LABEL_COLORS[fuelKey] || 'text-slate-600'}`}>{t.fuelTotalLabel}</span>
                  <span />
                  <span />
                  <span />
                  <span />
                  <span className={`text-right text-sm font-bold ${FUEL_LABEL_COLORS[fuelKey] || 'text-slate-700'}`}>
                    <motion.span
                      animate={{ scale: [1, 1.06, 1] }}
                      transition={{ duration: 1.4, repeat: Infinity, ease: 'easeInOut' }}
                      className="inline-block"
                    >
                      {fuelTotalLiters.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </motion.span>
                  </span>
                  <span className={`text-right text-sm font-bold ${FUEL_LABEL_COLORS[fuelKey] || 'text-slate-700'}`}>
                    <motion.span
                      animate={{ scale: [1, 1.06, 1] }}
                      transition={{ duration: 1.4, repeat: Infinity, ease: 'easeInOut', delay: 0.15 }}
                      className="inline-block"
                    >
                      {formatCurrency(fuelTotal)}
                    </motion.span>
                  </span>
                </div>
              </div>
            </div>
          )
        })}
          </div>
        </div>
      </div>

      {pumpKey === 'pump2' ? (
        <div className="mt-3 space-y-3">
          <div className="rounded-lg border border-slate-200 bg-white/80 p-4">
            <div className="mb-3 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Droplet size={16} className="shrink-0 text-emerald-600" />
                <span className="text-sm font-bold text-emerald-600">{t.pocketOilLabel}</span>
              </div>
              <button
                type="button"
                onClick={addOilRow}
                className="flex items-center gap-1.5 rounded-full bg-emerald-50 px-3.5 py-1.5 text-sm font-semibold text-emerald-700 transition-colors hover:bg-emerald-100"
              >
                <Plus size={15} /> {t.addMorePacketOil}
              </button>
            </div>
            <div className="space-y-3">
              {(value.oilRows || []).map((row) => (
                <OilRow
                  key={row.id}
                  t={t}
                  lubricants={packetProducts}
                  productId={row.productId}
                  onSelectProduct={(productId) => selectOilRowProduct(row.id, productId)}
                  count={row.stockCount}
                  rate={row.stockRate}
                  onRateAndCountChange={(rate, count) =>
                    onChange({ ...value, oilRows: value.oilRows.map((r) => (r.id === row.id ? { ...r, stockRate: rate, stockCount: count } : r)) })
                  }
                  amount={(Number(row.stockCount) || 0) * (Number(row.stockRate) || 0)}
                  onRemove={() => removeOilRow(row.id)}
                  showRemove={(value.oilRows || []).length > 1}
                  isDuplicate={duplicateOilRowIds.has(row.id)}
                />
              ))}
            </div>
          </div>
          <div className="rounded-lg border border-slate-200 bg-white/80 p-4">
            <div className="mb-3 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Droplet size={16} className="shrink-0 text-emerald-600" />
                <span className="text-sm font-bold text-emerald-600">{t.caneOilLabel}</span>
              </div>
              <button
                type="button"
                onClick={addCaneOilRow}
                className="flex items-center gap-1.5 rounded-full bg-emerald-50 px-3.5 py-1.5 text-sm font-semibold text-emerald-700 transition-colors hover:bg-emerald-100"
              >
                <Plus size={15} /> {t.addMoreCaneOil}
              </button>
            </div>
            <div className="space-y-3">
              {(value.caneOilRows || []).map((row) => (
                <OilRow
                  key={row.id}
                  t={t}
                  lubricants={caneProducts}
                  productId={row.productId}
                  onSelectProduct={(productId) => selectCaneOilRowProduct(row.id, productId)}
                  count={row.stockCount}
                  rate={row.stockRate}
                  onRateAndCountChange={(rate, count) =>
                    onChange({ ...value, caneOilRows: value.caneOilRows.map((r) => (r.id === row.id ? { ...r, stockRate: rate, stockCount: count } : r)) })
                  }
                  amount={(Number(row.stockCount) || 0) * (Number(row.stockRate) || 0)}
                  onRemove={() => removeCaneOilRow(row.id)}
                  showRemove={(value.caneOilRows || []).length > 1}
                  isDuplicate={duplicateCaneOilRowIds.has(row.id)}
                />
              ))}
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-2.5 border-t border-dashed border-slate-200 pt-3">
              <span className="shrink-0 text-sm font-semibold text-rose-500">{t.offerLabel}</span>
              <div className="w-40 shrink-0">
                <Input
                  type="number"
                  min="0"
                  step="any"
                  value={value.caneOilOffer || ''}
                  onChange={(e) => onChange({ ...value, caneOilOffer: e.target.value })}
                  placeholder="0.00"
                  title={t.offerHint}
                  className="border-rose-200"
                />
              </div>
              <span className="ml-auto shrink-0 text-sm font-semibold text-slate-600">
                {t.amount}: <span className="font-bold text-emerald-700">{formatCurrency(caneOilStockAmount)}</span>
              </span>
            </div>
          </div>
        </div>
      ) : null}

      <motion.div
        key={shiftTotal > 0 ? 'has-total' : 'zero-total'}
        initial={{ opacity: 0, scale: 0.97 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.3, ease: 'easeOut' }}
        className="mt-3 rounded-lg bg-gradient-to-r from-brand-600 to-brand-800 px-4 py-3 shadow-md shadow-brand-600/30"
      >
        <div className="flex items-center justify-between">
          <span className="text-sm font-bold uppercase tracking-wide text-brand-100">{t.shiftTotalLabel}</span>
          <AnimatePresence mode="popLayout">
            <motion.span
              key={formatCurrency(shiftTotal)}
              initial={{ opacity: 0, y: -6, scale: 0.9 }}
              animate={{ opacity: 1, y: 0, scale: [1, 1.07, 1] }}
              transition={{
                opacity: { duration: 0.22, ease: 'easeOut' },
                y: { duration: 0.22, ease: 'easeOut' },
                scale: { duration: 1.4, repeat: Infinity, ease: 'easeInOut' },
              }}
              className="inline-block text-lg font-extrabold text-white"
            >
              {formatCurrency(shiftTotal)}
            </motion.span>
          </AnimatePresence>
        </div>
      </motion.div>

      <div className="mt-4">
        <div className="mb-2.5 flex flex-wrap items-center justify-between gap-2">
          <h5 className="text-sm font-bold text-slate-700">{t.payments}</h5>
          <div className="flex flex-wrap items-center gap-2.5">
            <button
              type="button"
              onClick={addCreditLine}
              className="flex items-center gap-1.5 rounded-full bg-rose-50 px-3.5 py-1.5 text-sm font-semibold text-rose-600 transition-colors hover:bg-rose-100"
            >
              <Landmark size={15} /> {t.addCreditLine}
            </button>
            <button
              type="button"
              onClick={addEmployeeCreditLine}
              className="flex items-center gap-1.5 rounded-full bg-violet-50 px-3.5 py-1.5 text-sm font-semibold text-violet-600 transition-colors hover:bg-violet-100"
            >
              <Landmark size={15} /> {t.addEmployeeCreditLine}
            </button>
            <button
              type="button"
              onClick={addExpenseLine}
              className="flex items-center gap-1.5 rounded-full bg-amber-50 px-3.5 py-1.5 text-sm font-semibold text-amber-700 transition-colors hover:bg-amber-100"
            >
              <Receipt size={15} /> {t.addExpenseLine}
            </button>
            <button
              type="button"
              onClick={addPaymentLine}
              className="flex items-center gap-1.5 rounded-full bg-brand-50 px-3.5 py-1.5 text-sm font-semibold text-brand-700 transition-colors hover:bg-brand-100"
            >
              <Plus size={15} /> {t.addLine}
            </button>
          </div>
        </div>
        <div className="space-y-2">
          {(value.payments || []).map((p) => {
            const isCash = p.type !== 'credit' && CASH_LABELS.has(p.label.trim().toLowerCase())
            const isCounting = isCash && openDenomId === p.id
            // A large cash line is worth a second look before saving — the
            // amber highlight keeps it noticeable without needing a click.
            const isBigCash = isCash && Number(p.amount) >= BIG_CASH_THRESHOLD
            return (
              <div key={p.id}>
                <div className="flex flex-wrap items-center gap-2">
                  <div className={p.type === 'credit' || p.type === 'employeeCredit' ? 'w-full sm:min-w-0 sm:flex-1' : 'w-full sm:w-64 sm:shrink-0'}>
                    {p.type === 'credit' ? (
                      <div className="flex flex-wrap items-center gap-2">
                        <div className="w-full sm:w-48 sm:shrink-0">
                          <Select value={p.customerId || ''} onChange={(e) => updatePaymentLine(p.id, 'customerId', e.target.value)} className="text-rose-600">
                            <option value="">{t.selectCustomer}</option>
                            {(creditCustomers || []).map((c) => (
                              <option key={c.id} value={c.id}>
                                {c.name}
                              </option>
                            ))}
                          </Select>
                        </div>
                        <Input
                          value={p.note || ''}
                          onChange={(e) => updatePaymentLine(p.id, 'note', e.target.value)}
                          placeholder={t.placeholderCreditNote}
                          title={t.creditNoteHint}
                          className="min-w-0 flex-1 text-rose-600"
                        />
                      </div>
                    ) : p.type === 'employeeCredit' ? (
                      <div className="flex flex-wrap items-center gap-2">
                        <div className="w-full sm:w-48 sm:shrink-0">
                          <Select value={p.employeeId || ''} onChange={(e) => updatePaymentLine(p.id, 'employeeId', e.target.value)} className="text-violet-600">
                            <option value="">{t.selectEmployee}</option>
                            {(employees || []).map((emp) => (
                              <option key={emp.id} value={emp.id}>
                                {emp.name}
                              </option>
                            ))}
                          </Select>
                        </div>
                        <Input
                          value={p.note || ''}
                          onChange={(e) => updatePaymentLine(p.id, 'note', e.target.value)}
                          placeholder={t.placeholderEmployeeCreditNote}
                          title={t.employeeCreditNoteHint}
                          className="min-w-0 flex-1 text-violet-600"
                        />
                      </div>
                    ) : p.type === 'expense' ? (
                      <Input
                        value={p.label}
                        onChange={(e) => updatePaymentLine(p.id, 'label', e.target.value)}
                        placeholder={t.placeholderExpenseLabel}
                        className="text-amber-700"
                      />
                    ) : (
                      <Select value={p.label} onChange={(e) => updatePaymentLine(p.id, 'label', e.target.value)}>
                        <option value="">{t.selectPaymentMethod}</option>
                        {PAYMENT_METHOD_OPTIONS.map((method) => (
                          <option key={method} value={method}>
                            {method}
                          </option>
                        ))}
                      </Select>
                    )}
                  </div>
                  <div className={p.type === 'credit' || p.type === 'employeeCredit' ? 'w-full sm:w-60 sm:shrink-0' : 'min-w-0 flex-1'}>
                    <Input
                      type="number"
                      step="any"
                      value={p.amount}
                      onChange={(e) => updatePaymentLine(p.id, 'amount', e.target.value)}
                      placeholder="0"
                      title={isBigCash ? t.bigCashHint : undefined}
                      className={isBigCash ? 'border-amber-400 font-bold text-amber-700' : ''}
                    />
                  </div>
                  {!isCash ? (
                    <div className="w-24 shrink-0 text-right text-xs" title={t.paymentLitersHint}>
                      <div className="font-semibold text-slate-500">{paymentLiters(p) != null ? `${paymentLiters(p).toFixed(2)} L` : '—'}</div>
                      {paymentConversionFuel(p.label) ? (
                        <span
                          className={`inline-block rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${
                            paymentConversionFuel(p.label) === 'petrol' ? 'bg-orange-50 text-orange-600' : 'bg-blue-50 text-blue-600'
                          }`}
                        >
                          {paymentConversionFuel(p.label) === 'petrol' ? t.fuelLabels.petrol : t.fuelLabels.diesel}
                        </span>
                      ) : null}
                    </div>
                  ) : null}
                  {isCash ? (
                    <IconButton
                      onClick={() => setOpenDenomId(isCounting ? null : p.id)}
                      aria-label={t.countCash}
                      title={t.countCash}
                      tone={isCounting ? 'brand' : 'success'}
                    >
                      <Coins size={16} />
                    </IconButton>
                  ) : null}
                  <IconButton onClick={() => removePaymentLine(p.id)} aria-label="Remove" title="Remove" tone="delete">
                    <X size={15} />
                  </IconButton>
                </div>

                {isCounting ? (
                  <div className="mt-2 grid grid-cols-4 gap-2 rounded-lg border border-brand-100 bg-brand-50/50 p-3 sm:grid-cols-7">
                    {NOTE_VALUES.map((note) => (
                      <label key={note} className="block">
                        <span className="mb-1 block text-xs font-semibold text-slate-500">{t.denomNote(note)}</span>
                        <Input
                          type="number"
                          min="0"
                          value={p.denominations?.[note] ?? ''}
                          onChange={(e) => updateDenomination(p.id, note, e.target.value)}
                          placeholder="0"
                          className="px-2.5 py-2"
                        />
                      </label>
                    ))}
                    <label className="block">
                      <span className="mb-1 block text-xs font-semibold text-slate-500">{t.denomCoins}</span>
                      <Input
                        type="number"
                        min="0"
                        step="any"
                        value={p.denominations?.coins ?? ''}
                        onChange={(e) => updateDenomination(p.id, 'coins', e.target.value)}
                        placeholder="0"
                        className="px-2.5 py-2"
                      />
                    </label>
                    <div className="col-span-4 flex items-center justify-between border-t border-brand-100 pt-2 sm:col-span-7">
                      <span className="text-xs font-semibold text-slate-500">{t.denomTotal}</span>
                      <span className="text-sm font-bold text-brand-700">{formatCurrency(denominationTotal(p.denominations))}</span>
                    </div>
                  </div>
                ) : null}
              </div>
            )
          })}
        </div>
      </div>

      <motion.div
        key={`${shakeKey}`}
        animate={shiftBillsMissing ? { x: [0, -8, 8, -6, 6, -3, 3, 0] } : { x: 0 }}
        transition={{ duration: 0.45, ease: 'easeInOut' }}
        className={`mt-4 rounded-xl border p-4 ${shiftBillsMissing ? 'border-rose-400 bg-rose-50 ring-2 ring-rose-100' : 'border-violet-300 bg-violet-100'}`}
      >
        <div className="mb-3.5 flex items-center gap-2">
          <Paperclip size={17} className={shiftBillsMissing ? 'text-rose-500' : 'text-violet-600'} />
          <h4 className="text-base font-bold text-slate-800">
            {tRoot.billsAndDocuments}
            <span className="text-rose-500"> *</span>
          </h4>
        </div>
        {value.bills?.length > 0 ? (
          <ul className="mb-3.5 space-y-2">
            {value.bills.map((bill) => (
              <li key={bill.id} className="flex items-center justify-between gap-2 rounded-lg bg-slate-50 px-3.5 py-2.5 text-sm">
                <a href={resolveFileUrl(bill.url)} target="_blank" rel="noreferrer" className="flex min-w-0 items-center gap-1.5 font-medium text-brand-700 hover:underline">
                  <Paperclip size={13} className="shrink-0" />
                  <span className="truncate">{bill.name}</span>
                </a>
                <span className="shrink-0 text-slate-400">&middot; {formatDate(bill.date)}</span>
                <IconButton onClick={() => removeBill(bill.id)} aria-label={tRoot.removeBill} title={tRoot.removeBill} tone="delete">
                  <X size={15} />
                </IconButton>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mb-3.5 text-sm text-slate-400">{tRoot.noBillsYet}</p>
        )}
        <label className="flex cursor-pointer items-center justify-center gap-2 rounded-lg border border-dashed border-slate-300 px-4 py-3.5 text-sm font-medium text-slate-500 transition-colors hover:border-brand-300 hover:bg-brand-50 hover:text-brand-700">
          <Upload size={16} />
          {tRoot.uploadBillPrompt}
          <input type="file" accept="image/*,.pdf" className="hidden" onChange={handleBillFileChange} />
        </label>
        {shiftBillsMissing ? <span className="mt-2 block text-sm font-medium text-rose-500">{tRoot.errorBillsRequired}</span> : null}
      </motion.div>

      <div className="mt-4 rounded-xl border border-amber-300 bg-amber-100 p-4">
        <div className="mb-3.5 flex items-center gap-2">
          <StickyNote size={17} className="text-amber-700" />
          <h4 className="text-base font-bold text-slate-800">{tRoot.additionalInfo}</h4>
        </div>
        <Textarea value={value.notes} onChange={(e) => onChange({ ...value, notes: e.target.value })} placeholder={tRoot.additionalInfoPlaceholder} rows={3} />
      </div>

      <div className="mt-4 flex items-center justify-end gap-2 border-t border-slate-100 pt-4">
        <PrimaryButton type="button" onClick={handleSaveFinalClick}>
          <Save size={15} /> {value.id ? tRoot.saveChanges : tRoot.saveEntry}
        </PrimaryButton>
      </div>
    </div>
  )
}

export default function PumpDayEditor({ pumpKey, label, accent, tint, date, employees, fuelRates, creditCustomers, lubricants }) {
  const { language } = useLanguage()
  const tRoot = FUEL_ENTRY_TEXT[language]
  const t = tRoot.pumpEditor
  const theme = TINTS[tint] || { bg: 'bg-white', border: 'border-slate-200' }
  const { fuelEntries, addFuelEntry, updateFuelEntry, deleteFuelEntry } = useData()

  const priorEntries = useMemo(
    () => sortPumpEntries(fuelEntries.filter((e) => e.pumpKey === pumpKey && e.date < date)),
    [fuelEntries, pumpKey, date],
  )

  const [cards, setCards] = useState(() => {
    const existing = sortPumpEntries(fuelEntries.filter((e) => e.pumpKey === pumpKey && e.date === date))
    if (existing.length > 0) return existing.map((e) => ({ ...e }))
    const last = priorEntries[priorEntries.length - 1]
    const blank = emptyShiftEntry(pumpKey, date, 1, fuelRates)
    if (last) {
      for (const fuelKey of FUEL_KEYS_BY_PUMP[pumpKey]) {
        blank[fuelKey] = {
          nozzle1: { ...blank[fuelKey].nozzle1, opening: last[fuelKey]?.nozzle1?.closing ?? '' },
          nozzle2: { ...blank[fuelKey].nozzle2, opening: last[fuelKey]?.nozzle2?.closing ?? '' },
        }
      }
    }
    return [blank]
  })
  const [confirmRemoveIndex, setConfirmRemoveIndex] = useState(null)
  // Only one shift's full form (readings, payments, bills...) shows at a
  // time — a "Shift 1 / Shift 2 / Shift 3" tab strip switches between them,
  // instead of stacking every shift's whole form one below the other.
  const [activeShiftIndex, setActiveShiftIndex] = useState(0)

  // Shift 1's opening is directly editable (pre-filled once above from the
  // pump's last saved shift, whichever earlier day that was). Shift 2+'s
  // opening is never independently stored — it's always the live closing of
  // the card right before it, so a handover reading is entered exactly once.
  const effectiveCards = useMemo(() => withCarriedOpenings(cards), [cards])
  const pumpTotals = useMemo(() => aggregateEntries(effectiveCards), [effectiveCards])

  function updateCard(index, patch) {
    setCards((prev) => prev.map((c, i) => (i === index ? { ...c, ...patch } : c)))
  }

  function addShift(shiftNumber) {
    setCards((prev) => [...prev, emptyShiftEntry(pumpKey, date, shiftNumber, fuelRates)])
    setActiveShiftIndex(shiftNumber - 1)
  }

  function requestRemove(index) {
    if (cards[index].id) {
      setConfirmRemoveIndex(index)
    } else {
      setCards((prev) => prev.filter((_, i) => i !== index))
      setActiveShiftIndex((i) => Math.min(i, cards.length - 2))
    }
  }

  async function confirmRemove() {
    const index = confirmRemoveIndex
    setConfirmRemoveIndex(null)
    if (index == null) return
    const card = cards[index]
    if (card.id) {
      try {
        await deleteFuelEntry(card.id)
        toast.success(tRoot.toastDeleted)
      } catch (err) {
        toast.error(err.message || tRoot.toastDeleteFailed)
        return
      }
    }
    setCards((prev) => prev.filter((_, i) => i !== index))
    setActiveShiftIndex((i) => Math.min(i, cards.length - 2))
  }

  function buildPayload(index) {
    const effective = effectiveCards[index]
    const { id, localOnlyId, ...rest } = effective
    return rest
  }

  // Called by ShiftCard's own debounced autosave — silent on success (no
  // toast), since it can fire many times a minute while someone is typing;
  // the card's own "Draft"/"Not saved yet" badge is the persistent signal
  // that progress is safe. A failure DOES surface — see ShiftCard's autosave
  // effect, which awaits this and toasts on a rejected promise.
  async function handleSaveDraft(index) {
    const payload = { ...buildPayload(index), status: 'draft' }
    const card = cards[index]
    if (card.id) {
      await updateFuelEntry(card.id, payload)
    } else {
      const id = await addFuelEntry(payload)
      updateCard(index, { id })
    }
    updateCard(index, { status: 'draft' })
  }

  async function handleSaveFinal(index) {
    const payload = { ...buildPayload(index), status: 'final' }
    const card = cards[index]
    try {
      if (card.id) {
        await updateFuelEntry(card.id, payload)
        toast.success(tRoot.toastUpdated)
      } else {
        const id = await addFuelEntry(payload)
        updateCard(index, { id })
        toast.success(tRoot.toastAdded)
      }
      updateCard(index, { status: 'final' })
    } catch (err) {
      toast.error(err.message || tRoot.toastSaveFailed)
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: 'easeOut' }}
      className={`rounded-xl border p-5 shadow-card ${theme.bg} ${theme.border}`}
    >
      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2.5">
          <span className={`h-3 w-3 rounded-full ${accent}`} />
          <Fuel size={19} className={accent.replace('bg-', 'text-')} />
          <h4 className="text-base font-bold text-slate-800">{label}</h4>
        </div>
        <div className="flex flex-wrap items-center gap-3 sm:gap-4">
          <ToggleSwitch
            checked={cards.length >= 2}
            disabled={cards.length >= 3}
            title={cards.length >= 3 ? t.removeThirdShiftFirst : undefined}
            label={t.secondShiftToggle}
            onChange={(on) => (on ? addShift(2) : requestRemove(1))}
          />
          {cards.length >= 2 ? (
            <ToggleSwitch
              checked={cards.length >= 3}
              title={t.internalShiftHint}
              label={t.thirdShiftToggle}
              onChange={(on) => (on ? addShift(3) : requestRemove(2))}
            />
          ) : null}
        </div>
      </div>

      {cards.length > 1 ? (
        <div className="mb-4 flex flex-wrap items-center gap-2">
          {cards.map((card, index) => {
            const cardStatus = effectiveCards[index]?.status
            return (
              <button
                key={card.id || card.localOnlyId}
                type="button"
                onClick={() => setActiveShiftIndex(index)}
                className={`flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-sm font-semibold transition-colors ${
                  index === activeShiftIndex ? 'bg-brand-600 text-white shadow-sm' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                }`}
              >
                {t.shiftLabel(index + 1)}
                {!card.id ? (
                  <span className={`h-1.5 w-1.5 rounded-full ${index === activeShiftIndex ? 'bg-white/70' : 'bg-slate-400'}`} />
                ) : cardStatus === 'draft' ? (
                  <span className="h-1.5 w-1.5 rounded-full bg-amber-400" />
                ) : null}
              </button>
            )
          })}
        </div>
      ) : null}

      <div className="space-y-4">
        {cards.map((card, index) => (
          <div key={card.id || card.localOnlyId} className={index === activeShiftIndex ? '' : 'hidden'}>
            <ShiftCard
              t={t}
              tRoot={tRoot}
              pumpKey={pumpKey}
              value={effectiveCards[index]}
              onChange={(next) => updateCard(index, next)}
              isDerivedOpening={index > 0}
              employees={employees}
              creditCustomers={creditCustomers}
              lubricants={lubricants}
              onSaveDraft={() => handleSaveDraft(index)}
              onSaveFinal={() => handleSaveFinal(index)}
            />
          </div>
        ))}
      </div>

      <motion.div
        animate={pumpTotals.excessShortage < 0 ? { backgroundColor: ['#fef2f2', '#fee2e2', '#fef2f2'] } : { backgroundColor: '#f8fafc' }}
        transition={pumpTotals.excessShortage < 0 ? { duration: 1.6, repeat: Infinity, ease: 'easeInOut' } : { duration: 0.3 }}
        className={`mt-5 space-y-1.5 rounded-lg px-4 py-3.5 text-sm ${pumpTotals.excessShortage < 0 ? 'ring-1 ring-rose-200' : ''}`}
      >
        <div className="flex items-center justify-between">
          <span className="text-slate-500">{t.saleAmount}</span>
          <AnimatedFigure value={pumpTotals.totalSaleAmount} className="font-semibold text-slate-800" />
        </div>
        <div className="flex items-center justify-between">
          <span className="text-slate-500">{t.paymentsCollected}</span>
          <AnimatedFigure value={pumpTotals.totalPayments} className="font-semibold text-slate-800" />
        </div>
        <div className="flex items-center justify-between border-t border-slate-200 pt-1.5">
          <span className={`flex items-center gap-1 font-semibold ${pumpTotals.excessShortage >= 0 ? 'text-emerald-600' : 'text-rose-500'}`}>
            {pumpTotals.excessShortage >= 0 ? (
              <TrendingUp size={13} />
            ) : (
              <motion.span animate={{ scale: [1, 1.25, 1] }} transition={{ duration: 1.1, repeat: Infinity, ease: 'easeInOut' }}>
                <AlertTriangle size={13} />
              </motion.span>
            )}
            {pumpTotals.excessShortage >= 0 ? t.excess : t.shortage}
          </span>
          <AnimatedFigure
            value={pumpTotals.excessShortage}
            signed
            pulse={pumpTotals.excessShortage < 0}
            className={`font-bold ${pumpTotals.excessShortage >= 0 ? 'text-emerald-600' : 'text-rose-500'}`}
          />
        </div>
      </motion.div>

      <ConfirmDialog
        isOpen={confirmRemoveIndex != null}
        onClose={() => setConfirmRemoveIndex(null)}
        onConfirm={confirmRemove}
        title={tRoot.deleteTitle}
        description={tRoot.deleteDesc}
      />
    </motion.div>
  )
}
