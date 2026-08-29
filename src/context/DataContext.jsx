import React, { createContext, useContext, useMemo, useState, useCallback, useEffect } from 'react'
import {
  EMPLOYEES,
  buildAttendance,
  buildFuelEntries,
  LUBRICANT_PRODUCTS,
  CREDIT_CUSTOMERS,
  EXPENSE_DAYS,
  FUEL_RATES,
  COMMISSION_RATES,
  STATION,
} from '../data/mockData.js'
import { todayISO } from '../utils/format.js'
import { nextDateISO } from '../utils/attendance.js'
import { entryFuelLiters } from '../utils/fuelCalc.js'

const DataContext = createContext(null)

function makeId(prefix) {
  return `${prefix}-${Math.random().toString(36).slice(2, 9)}`
}

// Every mutable slice of app data (fuel entries — including drafts — plus
// everything a fuel entry's side effects touch) round-trips through
// localStorage, keyed by slice name, so a real browser refresh or a closed
// tab never loses an in-progress shift: the manager never has to remember
// to save before navigating away, it's just always already saved.
const STORAGE_PREFIX = 'ga-fuel-pump:'

function loadPersisted(key, fallback) {
  try {
    const raw = localStorage.getItem(STORAGE_PREFIX + key)
    return raw ? JSON.parse(raw) : fallback()
  } catch {
    return fallback()
  }
}

function usePersistedState(key, fallback) {
  const [value, setValue] = useState(() => loadPersisted(key, fallback))
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_PREFIX + key, JSON.stringify(value))
    } catch {
      // Storage full or unavailable (e.g. private browsing) — the app still
      // works for this session, it just won't survive a refresh.
    }
  }, [key, value])
  return [value, setValue]
}

export function DataProvider({ children }) {
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [authPassword, setAuthPassword] = useState('admin123')

  const [employees, setEmployees] = usePersistedState('employees', () => EMPLOYEES)
  const [attendance, setAttendanceState] = usePersistedState('attendance', buildAttendance)
  const [fuelEntries, setFuelEntries] = usePersistedState('fuelEntries', buildFuelEntries)
  const [lubricants, setLubricants] = usePersistedState('lubricants', () => LUBRICANT_PRODUCTS)
  const [creditCustomers, setCreditCustomers] = usePersistedState('creditCustomers', () => CREDIT_CUSTOMERS)
  const [expenseDays, setExpenseDays] = usePersistedState('expenseDays', () => EXPENSE_DAYS)
  const [station, setStation] = usePersistedState('station', () => STATION)
  const [commissionRates, setCommissionRates] = usePersistedState('commissionRates', () => COMMISSION_RATES)

  // ---------- Auth ----------
  const login = useCallback(() => setIsAuthenticated(true), [])
  const logout = useCallback(() => setIsAuthenticated(false), [])
  const changePassword = useCallback((newPassword) => setAuthPassword(newPassword), [])

  const updateStation = useCallback((patch) => {
    setStation((prev) => ({ ...prev, ...patch }))
  }, [])

  const updateCommissionRates = useCallback((patch) => {
    setCommissionRates((prev) => ({ ...prev, ...patch }))
  }, [])

  // ---------- Employees & Attendance ----------
  const addEmployee = useCallback((data) => {
    const id = makeId('e')
    const { monthlySalary, ...rest } = data
    const salaryHistory = [{ effectiveFrom: rest.joinDate || todayISO(), amount: Number(monthlySalary) || 0 }]
    setEmployees((prev) => [...prev, { id, ...rest, salaryHistory }])
    setAttendanceState((prev) => ({ ...prev, [id]: {} }))
    return id
  }, [])

  const updateEmployee = useCallback((id, data) => {
    setEmployees((prev) => prev.map((e) => (e.id === id ? { ...e, ...data } : e)))
  }, [])

  // Adds (or replaces, if effectiveFrom matches an existing entry) a salary
  // history entry — this is how a salary change takes effect from a chosen
  // date rather than overwriting the employee's whole pay history.
  const reviseSalary = useCallback((employeeId, { amount, effectiveFrom }) => {
    setEmployees((prev) =>
      prev.map((e) => {
        if (e.id !== employeeId) return e
        const history = (e.salaryHistory || []).filter((h) => h.effectiveFrom !== effectiveFrom)
        history.push({ effectiveFrom, amount: Number(amount) })
        history.sort((a, b) => a.effectiveFrom.localeCompare(b.effectiveFrom))
        return { ...e, salaryHistory: history }
      }),
    )
  }, [])

  const deleteEmployee = useCallback((id) => {
    setEmployees((prev) => prev.filter((e) => e.id !== id))
    setAttendanceState((prev) => {
      const next = { ...prev }
      delete next[id]
      return next
    })
  }, [])

  // Merges a partial day record — { status: 'oneShift'|'doubleShift'|'absent'|
  // 'leave'|'dutyOff' } — into whatever is already stored for that employee/date.
  const setAttendanceDay = useCallback((employeeId, date, patch) => {
    setAttendanceState((prev) => ({
      ...prev,
      [employeeId]: {
        ...prev[employeeId],
        [date]: { ...prev[employeeId]?.[date], ...patch },
      },
    }))
  }, [])

  // ---------- Fuel Entries ----------
  // Saving/deleting a fuel entry is the single source of truth for three other
  // screens, so the sync lives here rather than in the page. Each shift is
  // now its own independent record, so every one of these operates on ONE
  // shift entry directly: (1) that shift's employee gets that date's
  // Attendance auto-marked (2+ shift entries for the same employee on the
  // same date = doubleShift, same as a manual 24hr shift), (2) a payment
  // line typed as "credit" against a real customer writes a ledger entry
  // for them, (3) Pump 2's Oil liters decrement a linked Lubricants
  // product's stock.
  //
  // Attendance counts shifts PER EMPLOYEE PER DATE across every currently
  // saved entry (not just the one just saved) — two independent shift
  // entries (e.g. Pump 1 shift 1 and Pump 2 shift 1) can both name the same
  // employee on the same date, and that should still count as a double shift.
  const applyAttendanceFromEntry = useCallback(
    (entry) => {
      // The 3rd/"internal use" shift is excluded from attendance entirely —
      // its employee assignment is for internal reconciliation only.
      if (entry.internalOnly || !entry.employeeId) return
      const count = fuelEntries.filter(
        (e) => e.id !== entry.id && e.date === entry.date && e.employeeId === entry.employeeId && !e.internalOnly,
      ).length + 1
      const status = count >= 2 ? 'doubleShift' : 'oneShift'
      const employeeId = entry.employeeId
      setAttendanceState((prev) => ({
        ...prev,
        [employeeId]: { ...prev[employeeId], [entry.date]: { ...prev[employeeId]?.[entry.date], status } },
      }))
      if (status === 'doubleShift') {
        const nextDate = nextDateISO(entry.date)
        setAttendanceState((prev) => {
          if (prev[employeeId]?.[nextDate]) return prev
          return { ...prev, [employeeId]: { ...prev[employeeId], [nextDate]: { status: 'dutyOff' } } }
        })
      }
    },
    [fuelEntries],
  )

  const applyCreditLedgerFromEntry = useCallback((entry) => {
    for (const p of entry.payments || []) {
      if (p.type === 'credit' && p.customerId && Number(p.amount) > 0) {
        const ledgerId = makeId('t')
        setCreditCustomers((prev) =>
          prev.map((c) =>
            c.id === p.customerId
              ? {
                  ...c,
                  ledger: [
                    ...c.ledger,
                    {
                      id: ledgerId,
                      date: entry.date,
                      type: 'credit',
                      fuelType: null,
                      ltr: null,
                      rate: null,
                      amount: Number(p.amount),
                      mode: null,
                      note: p.note?.trim() || `Fuel Entry — ${entry.pumpKey === 'pump1' ? 'Pump 1' : 'Pump 2'} · Shift ${entry.shiftNumber}`,
                      sourceFuelEntryId: entry.id,
                    },
                  ],
                }
              : c,
          ),
        )
      }
    }
  }, [])

  const removeLedgerEntriesBySource = useCallback((sourceFuelEntryId) => {
    setCreditCustomers((prev) => prev.map((c) => ({ ...c, ledger: c.ledger.filter((l) => l.sourceFuelEntryId !== sourceFuelEntryId) })))
  }, [])

  // Mirrors applyCreditLedgerFromEntry above, but against an employee — an
  // "employee credit" payment line records fuel/oil taken on credit by staff
  // rather than paid in cash, and is settled against their pay: the Salary
  // page totals each employee's credits per month.
  const applyEmployeeCreditFromEntry = useCallback((entry) => {
    for (const p of entry.payments || []) {
      if (p.type === 'employeeCredit' && p.employeeId && Number(p.amount) > 0) {
        const creditId = makeId('ec')
        setEmployees((prev) =>
          prev.map((emp) =>
            emp.id === p.employeeId
              ? {
                  ...emp,
                  credits: [
                    ...(emp.credits || []),
                    {
                      id: creditId,
                      date: entry.date,
                      amount: Number(p.amount),
                      note: p.note?.trim() || `Fuel Entry — ${entry.pumpKey === 'pump1' ? 'Pump 1' : 'Pump 2'} · Shift ${entry.shiftNumber}`,
                      sourceFuelEntryId: entry.id,
                    },
                  ],
                }
              : emp,
          ),
        )
      }
    }
  }, [])

  const removeEmployeeCreditEntriesBySource = useCallback((sourceFuelEntryId) => {
    setEmployees((prev) => prev.map((emp) => ({ ...emp, credits: (emp.credits || []).filter((c) => c.sourceFuelEntryId !== sourceFuelEntryId) })))
  }, [])

  // sign -1 decrements stock (applying the sale), +1 restores it (undoing a
  // previous save before re-applying, or undoing on delete). Draws down the
  // linked product by the nozzle-dispensed liters plus any units sold
  // straight from shelf stock (Pocket, and each Cane row) — each can point
  // at a different product, so every one is applied independently.
  const applyOilStockFromEntry = useCallback((entry, sign) => {
    if (entry.pumpKey !== 'pump2') return

    const decrement = (productId, qty) => {
      if (!productId || !qty) return
      setLubricants((prev) => prev.map((l) => (l.id === productId ? { ...l, stock: (Number(l.stock) || 0) + sign * qty } : l)))
    }

    // The nozzle-dispensed "2T oil (machine)" liters aren't tied to any one
    // pocket-oil row, so they're attributed to the first row's product —
    // there's no single canonical pocket-oil product once it's a multi-row list.
    const liters = entryFuelLiters(entry, 'oil')
    decrement(entry.oilRows?.[0]?.productId, liters)
    for (const row of entry.oilRows || []) {
      decrement(row.productId, Number(row.stockCount) || 0)
    }
    for (const row of entry.caneOilRows || []) {
      decrement(row.productId, Number(row.stockCount) || 0)
    }
  }, [])

  // Draft entries (status === 'draft') are a scratch copy for a huge form
  // that's still in progress — they save to fuelEntries so the manager can
  // find and resume them, but none of the real-world side effects
  // (attendance, credit ledgers, stock decrements) fire until the entry is
  // actually finalized via a normal save, so an unfinished/incorrect draft
  // can never throw off attendance, stock, or credit records.
  const addFuelEntry = useCallback(
    (entry) => {
      const id = makeId('f')
      const saved = { id, ...entry }
      setFuelEntries((prev) => [saved, ...prev])
      if (saved.status !== 'draft') {
        applyAttendanceFromEntry(saved)
        applyCreditLedgerFromEntry(saved)
        applyEmployeeCreditFromEntry(saved)
        applyOilStockFromEntry(saved, -1)
      }
      return id
    },
    [applyAttendanceFromEntry, applyCreditLedgerFromEntry, applyEmployeeCreditFromEntry, applyOilStockFromEntry],
  )

  const updateFuelEntry = useCallback(
    (id, entry) => {
      const previous = fuelEntries.find((f) => f.id === id)
      const previousWasFinal = previous && previous.status !== 'draft'
      if (previousWasFinal) applyOilStockFromEntry(previous, 1)
      removeLedgerEntriesBySource(id)
      removeEmployeeCreditEntriesBySource(id)
      const saved = { id, ...entry }
      setFuelEntries((prev) => prev.map((f) => (f.id === id ? saved : f)))
      if (saved.status !== 'draft') {
        applyAttendanceFromEntry(saved)
        applyCreditLedgerFromEntry(saved)
        applyEmployeeCreditFromEntry(saved)
        applyOilStockFromEntry(saved, -1)
      }
    },
    [
      fuelEntries,
      applyOilStockFromEntry,
      removeLedgerEntriesBySource,
      removeEmployeeCreditEntriesBySource,
      applyAttendanceFromEntry,
      applyCreditLedgerFromEntry,
      applyEmployeeCreditFromEntry,
    ],
  )

  const deleteFuelEntry = useCallback(
    (id) => {
      const previous = fuelEntries.find((f) => f.id === id)
      if (previous && previous.status !== 'draft') applyOilStockFromEntry(previous, 1)
      removeLedgerEntriesBySource(id)
      removeEmployeeCreditEntriesBySource(id)
      setFuelEntries((prev) => prev.filter((f) => f.id !== id))
    },
    [fuelEntries, applyOilStockFromEntry, removeLedgerEntriesBySource, removeEmployeeCreditEntriesBySource],
  )

  // ---------- Lubricants ----------
  const addLubricant = useCallback((data) => {
    const id = makeId('l')
    const { rate, stock, purchaseHistory: _ignored, ...rest } = data
    const openingStock = Number(stock) || 0
    const effectiveFrom = todayISO()
    const priceHistory = [{ effectiveFrom, rate: Number(rate) || 0 }]
    // The opening stock entered right here is itself the product's first
    // purchase — recording it as one keeps stockAvailableAtRate's per-price-
    // period counting correct from day one, once the price is ever revised.
    const purchaseHistory = openingStock > 0 ? [{ id: makeId('p'), date: effectiveFrom, qty: openingStock, cost: 0 }] : []
    setLubricants((prev) => [...prev, { id, ...rest, stock: openingStock, priceHistory, purchaseHistory }])
    return id
  }, [])

  const updateLubricant = useCallback((id, data) => {
    setLubricants((prev) => prev.map((l) => (l.id === id ? { ...l, ...data } : l)))
  }, [])

  // Adds (or replaces, if effectiveFrom matches an existing entry) a price
  // history entry — this is how a rate change takes effect from a chosen
  // date rather than overwriting the product's whole price history, so day
  // by day price changes stay on record.
  const reviseLubricantPrice = useCallback((productId, { rate, effectiveFrom }) => {
    setLubricants((prev) =>
      prev.map((l) => {
        if (l.id !== productId) return l
        const history = (l.priceHistory || []).filter((h) => h.effectiveFrom !== effectiveFrom)
        history.push({ effectiveFrom, rate: Number(rate) })
        history.sort((a, b) => a.effectiveFrom.localeCompare(b.effectiveFrom))
        return { ...l, priceHistory: history }
      }),
    )
  }, [])

  const deleteLubricant = useCallback((id) => {
    setLubricants((prev) => prev.filter((l) => l.id !== id))
  }, [])

  // Logs a restock from an outside supplier and adds its quantity onto the
  // product's current stock-on-hand.
  const addPurchase = useCallback((productId, { qty, date, cost }) => {
    setLubricants((prev) =>
      prev.map((l) => {
        if (l.id !== productId) return l
        const entry = { id: makeId('p'), date, qty: Number(qty), cost: Number(cost) || 0 }
        return { ...l, stock: (Number(l.stock) || 0) + Number(qty), purchaseHistory: [...(l.purchaseHistory || []), entry] }
      }),
    )
  }, [])

  // ---------- Credit Customers ----------
  const addCustomer = useCallback((data) => {
    const id = makeId('c')
    setCreditCustomers((prev) => [...prev, { id, ledger: [], openingBalance: 0, ...data }])
    return id
  }, [])

  const updateCustomer = useCallback((id, data) => {
    setCreditCustomers((prev) => prev.map((c) => (c.id === id ? { ...c, ...data } : c)))
  }, [])

  const deleteCustomer = useCallback((id) => {
    setCreditCustomers((prev) => prev.filter((c) => c.id !== id))
  }, [])

  const addLedgerEntry = useCallback((customerId, entry) => {
    const id = makeId('t')
    setCreditCustomers((prev) =>
      prev.map((c) => (c.id === customerId ? { ...c, ledger: [...c.ledger, { id, ...entry }] } : c)),
    )
  }, [])

  // ---------- Expenses ----------
  // One record per day, holding however many line items ({label, amount})
  // the manager logged that day — same day-with-multiple-items shape as a
  // Fuel Entry, just without the pump/reading complexity.
  const addExpenseDay = useCallback((data) => {
    const id = makeId('exp')
    setExpenseDays((prev) => [{ id, ...data }, ...prev])
    return id
  }, [])

  const updateExpenseDay = useCallback((id, data) => {
    setExpenseDays((prev) => prev.map((d) => (d.id === id ? { id, ...data } : d)))
  }, [])

  const deleteExpenseDay = useCallback((id) => {
    setExpenseDays((prev) => prev.filter((d) => d.id !== id))
  }, [])

  const value = useMemo(
    () => ({
      station,
      updateStation,
      fuelRates: FUEL_RATES,
      commissionRates,
      updateCommissionRates,
      isAuthenticated,
      login,
      logout,
      authPassword,
      changePassword,
      employees,
      addEmployee,
      updateEmployee,
      deleteEmployee,
      reviseSalary,
      attendance,
      setAttendanceDay,
      fuelEntries,
      addFuelEntry,
      updateFuelEntry,
      deleteFuelEntry,
      lubricants,
      addLubricant,
      updateLubricant,
      deleteLubricant,
      reviseLubricantPrice,
      addPurchase,
      creditCustomers,
      addCustomer,
      updateCustomer,
      deleteCustomer,
      addLedgerEntry,
      expenseDays,
      addExpenseDay,
      updateExpenseDay,
      deleteExpenseDay,
    }),
    [
      station,
      updateStation,
      commissionRates,
      updateCommissionRates,
      isAuthenticated,
      login,
      logout,
      authPassword,
      changePassword,
      employees,
      addEmployee,
      updateEmployee,
      deleteEmployee,
      reviseSalary,
      attendance,
      setAttendanceDay,
      fuelEntries,
      addFuelEntry,
      updateFuelEntry,
      deleteFuelEntry,
      lubricants,
      addLubricant,
      updateLubricant,
      deleteLubricant,
      reviseLubricantPrice,
      addPurchase,
      creditCustomers,
      addCustomer,
      updateCustomer,
      deleteCustomer,
      addLedgerEntry,
      expenseDays,
      addExpenseDay,
      updateExpenseDay,
      deleteExpenseDay,
    ],
  )

  return <DataContext.Provider value={value}>{children}</DataContext.Provider>
}

export function useData() {
  const ctx = useContext(DataContext)
  if (!ctx) throw new Error('useData must be used within DataProvider')
  return ctx
}
