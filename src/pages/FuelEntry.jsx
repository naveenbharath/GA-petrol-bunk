import { useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import toast from 'react-hot-toast'
import { useNavigate } from 'react-router-dom'
import { Plus, Pencil, Trash2, Download, Fuel, CheckCircle2, AlertTriangle, Paperclip } from 'lucide-react'
import { useData } from '../context/DataContext.jsx'
import { useLanguage } from '../context/LanguageContext.jsx'
import { FUEL_ENTRY_TEXT } from '../i18n/fuelEntry.js'
import { formatCurrency, formatDate, formatLiters } from '../utils/format.js'
import {
  entryFuelLiters,
  entryFuelAmount,
  shiftSaleAmount,
  shiftPaymentsTotal,
  shiftVariance,
  paymentsTotal,
  sortPumpEntries,
  withCarriedOpenings,
  FUEL_KEYS_BY_PUMP,
  NOZZLE_KEYS,
  PUMP_KEYS,
} from '../utils/fuelCalc.js'
import ConfirmDialog from '../components/ConfirmDialog.jsx'
import EmptyState from '../components/EmptyState.jsx'
import DataTable from '../components/DataTable.jsx'
import { SkeletonTable } from '../components/Skeleton.jsx'
import useSimulatedLoading from '../hooks/useSimulatedLoading.js'
import { PrimaryButton, IconButton } from '../components/FormControls.jsx'

const PUMP_LABELS = { pump1: 'Pump 1', pump2: 'Pump 2' }

function csvCell(value) {
  return `"${String(value ?? '').replace(/"/g, '""')}"`
}

// Rounded to 2 decimal places, never to whole rupees — CSV export should
// carry the same precision as the live reconciliation figures.
function round2(n) {
  return Math.round(n * 100) / 100
}

export default function FuelEntry() {
  const { fuelEntries, deleteFuelEntry, employees } = useData()
  const { language } = useLanguage()
  const t = FUEL_ENTRY_TEXT[language]
  const loading = useSimulatedLoading(650)
  const navigate = useNavigate()

  const [confirmDeleteId, setConfirmDeleteId] = useState(null)

  function handleDelete(id) {
    deleteFuelEntry(id)
    toast.success(t.toastDeleted)
  }

  function employeeName(id) {
    return employees.find((e) => e.id === id)?.name || ''
  }

  // Every shift entry is independent, but its opening reading is still
  // carried forward live from whichever shift (same pump, possibly an
  // earlier day) came right before it — see fuelCalc.js. Recompute that
  // once per pump so every row's liters/amount reflect the real chain.
  const effectiveById = useMemo(() => {
    const map = new Map()
    for (const pumpKey of PUMP_KEYS) {
      const withOpenings = withCarriedOpenings(sortPumpEntries(fuelEntries.filter((e) => e.pumpKey === pumpKey)))
      for (const e of withOpenings) map.set(e.id, e)
    }
    return map
  }, [fuelEntries])

  function exportEntry(entry) {
    const effective = effectiveById.get(entry.id) || entry
    const fuelKeys = FUEL_KEYS_BY_PUMP[entry.pumpKey]
    const rows = [
      ['Date', formatDate(entry.date)],
      ['Pump', PUMP_LABELS[entry.pumpKey]],
      [`Shift ${entry.shiftNumber}`, employeeName(entry.employeeId)],
      [],
      ['Fuel', 'Nozzle', 'Opening', 'Closing', 'Testing', 'Rate', 'Liters', 'Amount'],
    ]
    fuelKeys.forEach((fuelKey) => {
      NOZZLE_KEYS.forEach((nozzleKey, nozzleIdx) => {
        const reading = effective[fuelKey]?.[nozzleKey]
        rows.push([fuelKey, `Nozzle ${nozzleIdx + 1}`, reading?.opening, reading?.closing, reading?.testing, reading?.rate])
      })
    })
    rows.push([])
    rows.push(['Payments Received'])
    ;(entry.payments || []).forEach((p) => rows.push([p.label, p.amount]))
    rows.push(['Payments Collected', round2(paymentsTotal(entry.payments))])
    rows.push(['Sale Amount', round2(shiftSaleAmount(effective))])
    rows.push(['Excess / Shortage', round2(shiftVariance(effective))])

    const csv = rows.map((row) => row.map(csvCell).join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `fuel-entry-${entry.date}-${entry.pumpKey}-shift${entry.shiftNumber}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  // dateDisplay/pumpLabel are extra plain-text fields just for the search
  // box below to match against (typing "28/08" or "Pump 1" wouldn't hit
  // anything searching the raw ISO date / pumpKey values directly).
  const rows = useMemo(
    () =>
      fuelEntries.map((entry) => {
        const effective = effectiveById.get(entry.id) || entry
        const fuelKeys = FUEL_KEYS_BY_PUMP[entry.pumpKey]
        const fuelBreakdown = fuelKeys.map((fuelKey) => ({
          fuelKey,
          ltr: entryFuelLiters(effective, fuelKey),
          amount: entryFuelAmount(effective, fuelKey),
        }))
        const pumpLabel = `${entry.pumpKey === 'pump1' ? t.pump1 : t.pump2} ${t.pumpEditor.shiftLabel(entry.shiftNumber)}`
        return {
          id: entry.id,
          date: entry.date,
          dateDisplay: formatDate(entry.date),
          pumpKey: entry.pumpKey,
          shiftNumber: entry.shiftNumber,
          pumpLabel,
          employeeName: employeeName(entry.employeeId),
          status: entry.status,
          fuelBreakdown,
          totalSaleAmount: shiftSaleAmount(effective),
          excessShortage: shiftVariance(effective),
          billsCount: entry.bills?.length || 0,
          _entry: entry,
        }
      }),
    [fuelEntries, effectiveById, employees, t],
  )

  const historyColumns = [
    {
      field: 'date',
      header: t.colDate,
      sortable: true,
      style: { width: '12%' },
      body: (row) => (
        <div className="flex items-center gap-1.5">
          <span className="font-medium text-slate-700">{formatDate(row.date)}</span>
          {row.status === 'draft' ? (
            <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-semibold text-amber-600">{t.draftBadge}</span>
          ) : null}
        </div>
      ),
    },
    {
      field: 'pumpKey',
      header: t.colPump,
      sortable: true,
      style: { width: '16%' },
      body: (row) => (
        <>
          <p className={`font-semibold ${row.pumpKey === 'pump1' ? 'text-violet-600' : 'text-ocean-600'}`}>
            {row.pumpKey === 'pump1' ? t.pump1 : t.pump2} — {t.pumpEditor.shiftLabel(row.shiftNumber)}
          </p>
          <p className="text-xs font-medium text-slate-400">{row.employeeName || '—'}</p>
        </>
      ),
    },
    {
      field: 'fuel',
      header: t.colFuel,
      style: { width: '26%' },
      body: (row) => (
        <span className="font-medium text-slate-600">
          {row.fuelBreakdown
            .filter((f) => f.ltr > 0 || f.amount > 0)
            .map((f) => `${t.pumpEditor.fuelLabels[f.fuelKey]}: ${formatLiters(f.ltr)} · ${formatCurrency(f.amount)}`)
            .join('  ·  ') || '—'}
        </span>
      ),
    },
    {
      field: 'totalSaleAmount',
      header: t.colTotalAmount,
      sortable: true,
      style: { width: '14%' },
      body: (row) => <span className="font-semibold text-slate-800">{formatCurrency(row.totalSaleAmount)}</span>,
    },
    {
      field: 'excessShortage',
      header: t.colExcessShortage,
      sortable: true,
      style: { width: '14%' },
      body: (row) => (
        <span
          className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold ${
            row.excessShortage >= 0 ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-500'
          }`}
        >
          {row.excessShortage >= 0 ? <CheckCircle2 size={12} /> : <AlertTriangle size={12} />}
          {row.excessShortage >= 0 ? '+' : ''}
          {formatCurrency(row.excessShortage)}
        </span>
      ),
    },
    {
      field: 'bills',
      header: t.colBills,
      align: 'center',
      exportable: false,
      style: { width: '8%' },
      body: (row) =>
        row.billsCount > 0 ? (
          <span
            title={t.billsUploaded(row.billsCount)}
            className="inline-flex items-center gap-1 rounded-full bg-brand-50 px-2 py-0.5 text-xs font-semibold text-brand-700"
          >
            <Paperclip size={12} /> {row.billsCount}
          </span>
        ) : (
          <span className="text-xs text-slate-300">—</span>
        ),
    },
    {
      header: t.colActions,
      align: 'right',
      exportable: false,
      style: { width: '10%' },
      body: (row) => (
        <div className="flex justify-end gap-1">
          <IconButton
            onClick={(e) => {
              e.stopPropagation()
              exportEntry(row._entry)
            }}
            aria-label="Export"
            title="Export"
            tone="download"
          >
            <Download size={15} />
          </IconButton>
          <IconButton
            onClick={(e) => {
              e.stopPropagation()
              navigate(`/fuel-entry/${row.id}/edit`)
            }}
            aria-label="Edit"
            title="Edit"
            tone="edit"
          >
            <Pencil size={15} />
          </IconButton>
          <IconButton
            onClick={(e) => {
              e.stopPropagation()
              setConfirmDeleteId(row.id)
            }}
            aria-label="Delete"
            title="Delete"
            tone="delete"
          >
            <Trash2 size={15} />
          </IconButton>
        </div>
      ),
    },
  ]

  if (loading) {
    return <SkeletonTable rows={6} cols={6} />
  }

  return (
    <div className="space-y-6">
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35 }}
        className="rounded-xl border border-slate-200 bg-white shadow-card"
      >
        <div className="border-b border-slate-100 px-4 py-2.5">
          <h3 className="text-sm font-semibold text-slate-800">{t.entryHistory}</h3>
        </div>
        {fuelEntries.length === 0 ? (
          <div className="p-5">
            <EmptyState icon={Fuel} title={t.emptyTitle} description={t.emptyDesc} />
          </div>
        ) : (
          <DataTable
            columns={historyColumns}
            data={rows}
            rowKey="id"
            globalFilterFields={['dateDisplay', 'pumpLabel', 'employeeName']}
            searchPlaceholder={t.searchPlaceholder}
            defaultSortField="date"
            defaultSortOrder={-1}
            scrollable={false}
            exportFilename="fuel-entries"
            dense
            onRowClick={(row) => navigate(`/fuel-entry/${row.id}/edit`)}
            toolbarActions={
              <PrimaryButton onClick={() => navigate('/fuel-entry/new')} className="px-3.5 py-2 text-xs">
                <Plus size={14} /> {t.newDayEntry}
              </PrimaryButton>
            }
          />
        )}
      </motion.div>

      <ConfirmDialog
        isOpen={!!confirmDeleteId}
        onClose={() => setConfirmDeleteId(null)}
        onConfirm={() => handleDelete(confirmDeleteId)}
        title={t.deleteTitle}
        description={t.deleteDesc}
      />
    </div>
  )
}
