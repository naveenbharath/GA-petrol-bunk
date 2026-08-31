import React, { createContext, useContext, useMemo, useState, useCallback, useEffect, useRef } from 'react'
import toast from 'react-hot-toast'
import {
  FUEL_RATES,
  COMMISSION_RATES,
  STATION,
} from '../data/mockData.js'
import { todayISO } from '../utils/format.js'
import {
  login as apiLogin,
  verifyOtp as apiVerifyOtp,
  resendOtp as apiResendOtp,
  logout as apiLogout,
  refreshTokens,
  fetchMe,
  getAccessToken,
  getRefreshToken,
  clearTokens,
  listEmployees,
  createEmployee as apiCreateEmployee,
  updateEmployee as apiUpdateEmployee,
  deleteEmployee as apiDeleteEmployee,
  addSalaryRevision as apiAddSalaryRevision,
  listLubricants,
  createLubricant as apiCreateLubricant,
  updateLubricant as apiUpdateLubricant,
  deleteLubricant as apiDeleteLubricant,
  addLubricantPriceRevision as apiAddLubricantPriceRevision,
  addLubricantPurchase as apiAddLubricantPurchase,
  listExpenseDays,
  createExpenseDay as apiCreateExpenseDay,
  updateExpenseDay as apiUpdateExpenseDay,
  deleteExpenseDay as apiDeleteExpenseDay,
  getCurrentCommissionRate,
  reviseCommissionRate as apiReviseCommissionRate,
  listCreditCustomers,
  createCreditCustomer as apiCreateCreditCustomer,
  updateCreditCustomer as apiUpdateCreditCustomer,
  deleteCreditCustomer as apiDeleteCreditCustomer,
  addCreditLedgerEntry as apiAddCreditLedgerEntry,
  listOfferSends,
  createOfferSend as apiCreateOfferSend,
  listFuelEntries,
  createFuelEntry as apiCreateFuelEntry,
  updateFuelEntry as apiUpdateFuelEntry,
  deleteFuelEntry as apiDeleteFuelEntry,
} from '../lib/apiClient.js'
import { fetchAttendanceMonth, upsertAttendance } from '../lib/attendanceApi.js'

const DataContext = createContext(null)

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
  // True once the initial "is there already a valid session?" check has
  // resolved — lets the router avoid flashing to /login while that first
  // refresh+me round trip is still in flight on a hard page reload.
  const [authChecked, setAuthChecked] = useState(false)
  const [currentUser, setCurrentUser] = useState(null)
  const [authPassword, setAuthPassword] = useState('admin123')

  const [employeesData, setEmployeesData] = useState([])
  const [employeesLoading, setEmployeesLoading] = useState(true)
  // Starts empty (not seeded with fake history) — real records arrive via
  // refreshAttendanceForEmployees below shortly after login. A fake-data
  // fallback here would never fully clear itself: the merge below only
  // adds/overwrites dates the API actually returns, so any seeded date with
  // no real backend record would sit there indefinitely looking real.
  const [attendance, setAttendanceState] = usePersistedState('attendance', () => ({}))
  const [fuelEntries, setFuelEntriesData] = useState([])
  const [fuelEntriesLoading, setFuelEntriesLoading] = useState(true)
  const [lubricants, setLubricants] = useState([])
  const [lubricantsLoading, setLubricantsLoading] = useState(true)
  const [creditCustomers, setCreditCustomersData] = useState([])
  const [creditCustomersLoading, setCreditCustomersLoading] = useState(true)
  // Offers' "Recently Sent" log — backed by the real Offer_Sends table (see
  // ../lib/apiClient.js).
  const [sentLog, setSentLog] = useState([])
  const [expenseDays, setExpenseDays] = useState([])
  const [expenseDaysLoading, setExpenseDaysLoading] = useState(true)
  const [station, setStation] = usePersistedState('station', () => STATION)
  // Local fallback until the real rate loads (or if none has ever been set) —
  // oilPacket/oilCane default to 0 since the mock data never had them.
  const [commissionRates, setCommissionRates] = useState(() => ({ ...COMMISSION_RATES, oilPacket: 0, oilCane: 0 }))
  const [commissionRatesLoading, setCommissionRatesLoading] = useState(true)

  // ---------- Auth ----------
  // On mount, if a refresh token survived from a previous visit, silently
  // renew the session (refresh -> me) instead of forcing a fresh login on
  // every page reload. A failure here (expired/idle-timed-out/revoked)
  // just leaves the user logged out — never surfaced as an error.
  useEffect(() => {
    let cancelled = false
    async function restoreSession() {
      if (!getRefreshToken()) {
        setAuthChecked(true)
        return
      }
      try {
        await refreshTokens()
        const me = await fetchMe(getAccessToken())
        if (!cancelled) {
          setCurrentUser(me)
          setIsAuthenticated(true)
        }
      } catch {
        clearTokens()
      } finally {
        if (!cancelled) setAuthChecked(true)
      }
    }
    restoreSession()
    return () => {
      cancelled = true
    }
  }, [])

  // Login is two-step: this only checks the password and returns
  // { otpToken, expiresInSeconds } — the Login page then collects the code
  // (sent to the account's phone; see api/app/core/sms.py) and calls
  // verifyOtp() below to actually complete the session. Throws ApiError on
  // failure (invalid credentials, deactivated account, etc.) — the Login
  // page catches it and shows the message inline.
  const login = useCallback(async (identifier, password) => {
    const data = await apiLogin(identifier, password)
    // OTP_ENABLED is temporarily off server-side — /auth/login already
    // returned a real session (see apiClient.login), so there's no OTP step
    // to go through; complete the session immediately.
    if (data.access_token) {
      const me = await fetchMe(data.access_token)
      setCurrentUser(me)
      setIsAuthenticated(true)
      return { skippedOtp: true }
    }
    return { otpToken: data.otp_token, expiresInSeconds: data.expires_in_seconds }
  }, [])

  // Throws ApiError on failure (wrong/expired code, too many attempts) —
  // the Login page catches it and shows the message inline.
  const verifyOtp = useCallback(async (otpToken, code) => {
    const tokens = await apiVerifyOtp(otpToken, code)
    const me = await fetchMe(tokens.access_token)
    setCurrentUser(me)
    setIsAuthenticated(true)
  }, [])

  // Returns a fresh { otpToken, expiresInSeconds } — the old otpToken (and
  // the code it was paired with) stops working the moment this succeeds
  // (see AuthService.start_otp_login's invalidate_for_user).
  const resendOtp = useCallback(async (otpToken) => {
    const data = await apiResendOtp(otpToken)
    return { otpToken: data.otp_token, expiresInSeconds: data.expires_in_seconds }
  }, [])

  const logout = useCallback(async () => {
    await apiLogout()
    setCurrentUser(null)
    setIsAuthenticated(false)
  }, [])

  const changePassword = useCallback((newPassword) => setAuthPassword(newPassword), [])

  const updateStation = useCallback((patch) => {
    setStation((prev) => ({ ...prev, ...patch }))
  }, [])

  // Dashboard's edit form only collects petrol/diesel/oil — it has no field
  // for oilPacket/oilCane or a revision date, so those are carried forward
  // from the current rate and effectiveFrom is stamped as today. Wired to
  // the real API (see ../lib/apiClient.js); Dashboard.jsx is unchanged.
  const updateCommissionRates = useCallback(
    async (patch) => {
      const merged = { ...commissionRates, ...patch }
      const updated = await apiReviseCommissionRate({
        effectiveFrom: todayISO(),
        petrol: merged.petrol,
        diesel: merged.diesel,
        oil: merged.oil,
        oilPacket: merged.oilPacket,
        oilCane: merged.oilCane,
      })
      setCommissionRates(updated)
    },
    [commissionRates],
  )

  // ---------- Employees & Attendance ----------
  // Employees is the one module wired to the real API (see ../lib/apiClient.js)
  // — everything else in this file is still local mock/demo state.
  // "Employee credit" (fuel/oil taken on credit at the pump) has no backing
  // endpoint yet, so it stays a locally persisted overlay keyed by employee
  // id and merged onto whatever the API returns.
  const loadEmployees = useCallback(async () => {
    setEmployeesLoading(true)
    try {
      const list = await listEmployees()
      setEmployeesData(list)
    } catch {
      // Leaves whatever was last loaded — there's no dedicated error state
      // for this list today, and a stale list beats a blank one.
    } finally {
      setEmployeesLoading(false)
    }
  }, [])

  useEffect(() => {
    if (isAuthenticated) loadEmployees()
  }, [isAuthenticated, loadEmployees])

  // Lubricants is also wired to the real API (see ../lib/apiClient.js).
  const loadLubricants = useCallback(async () => {
    setLubricantsLoading(true)
    try {
      const list = await listLubricants()
      setLubricants(list)
    } catch {
      // Same reasoning as loadEmployees above — leave the stale list in place.
    } finally {
      setLubricantsLoading(false)
    }
  }, [])

  useEffect(() => {
    if (isAuthenticated) loadLubricants()
  }, [isAuthenticated, loadLubricants])

  // Expenses is also wired to the real API (see ../lib/apiClient.js).
  const loadExpenseDays = useCallback(async () => {
    setExpenseDaysLoading(true)
    try {
      const list = await listExpenseDays()
      setExpenseDays(list)
    } catch {
      // Same reasoning as loadEmployees above — leave the stale list in place.
    } finally {
      setExpenseDaysLoading(false)
    }
  }, [])

  useEffect(() => {
    if (isAuthenticated) loadExpenseDays()
  }, [isAuthenticated, loadExpenseDays])

  // Commission Rate History is also wired to the real API. A 404 (no rate
  // ever set yet) is expected on a brand-new station and just leaves the
  // local fallback in place — Dashboard's math treats zeros as "not set up",
  // and the very first revise call establishes it.
  const loadCommissionRates = useCallback(async () => {
    setCommissionRatesLoading(true)
    try {
      const rate = await getCurrentCommissionRate()
      setCommissionRates(rate)
    } catch {
      // leave the fallback in place
    } finally {
      setCommissionRatesLoading(false)
    }
  }, [])

  useEffect(() => {
    if (isAuthenticated) loadCommissionRates()
  }, [isAuthenticated, loadCommissionRates])

  // Credit Bills is also wired to the real API (see ../lib/apiClient.js).
  const loadCreditCustomers = useCallback(async () => {
    setCreditCustomersLoading(true)
    try {
      const list = await listCreditCustomers()
      setCreditCustomersData(list)
    } catch {
      // Same reasoning as loadEmployees above — leave the stale list in place.
    } finally {
      setCreditCustomersLoading(false)
    }
  }, [])

  useEffect(() => {
    if (isAuthenticated) loadCreditCustomers()
  }, [isAuthenticated, loadCreditCustomers])

  // Offers is also wired to the real API (see ../lib/apiClient.js).
  const loadOfferSends = useCallback(async () => {
    try {
      const list = await listOfferSends()
      setSentLog(list)
    } catch {
      // leave the stale list in place
    }
  }, [])

  useEffect(() => {
    if (isAuthenticated) loadOfferSends()
  }, [isAuthenticated, loadOfferSends])

  // employeesData already carries each employee's `credits` (written by
  // Fuel Entry's 'employee credit' payment lines — see FuelEntryService and
  // normalizeEmployee in ../lib/apiClient.js), so this no longer needs a
  // separate local overlay merged on top.
  const employees = employeesData

  // Attendance is now backed by the real Attendance_Records table (see
  // ../lib/attendanceApi.js) — employees' ids are already real backend UUIDs
  // (see loadEmployees above), so no id translation is needed here. Loads a
  // rolling 2-month window (current + previous) per employee once they're
  // available, merged on top of whatever's already in local state so there's
  // no empty flash before this resolves.
  //
  // Guarded by a ref (rather than the usual cleanup/cancelled-flag pattern)
  // so each employee is hydrated from the backend exactly once per session:
  // this effect depends on `employeesData`, and StrictMode's dev-mode
  // double-invocation — or `employeesData` changing later for an unrelated
  // reason, e.g. a new employee being added — would otherwise re-run the
  // whole fetch-and-merge. A second pass landing *after* a user's own edit
  // (setAttendanceDay) but reflecting data fetched *before* it would silently
  // clobber that fresh write with stale data.
  const syncedAttendanceEmployeeIdsRef = useRef(new Set())
  // Belt-and-suspenders against the same class of race even on the FIRST
  // (necessary, not a duplicate) hydration pass: that fetch can still be
  // in flight when the user acts, and if it resolves after a local write,
  // it must not overwrite it. Every key setAttendanceDay has written this
  // session is recorded here and skipped by the merge below, permanently —
  // once the user has explicitly set a day's status, that's authoritative
  // over anything a background hydration might fetch for it.
  const dirtyAttendanceKeysRef = useRef(new Set())

  // Shared by the initial per-employee hydration below AND by Fuel Entry's
  // save/delete (its attendance auto-mark now happens server-side — see
  // FuelEntryService — so the only thing left to do here is pull the fresh
  // result back down for whichever employee it just touched).
  const refreshAttendanceForEmployees = useCallback(async (employeeIds) => {
    if (employeeIds.length === 0) return
    const now = new Date()
    const months = [
      { year: now.getFullYear(), month: now.getMonth() + 1 },
      now.getMonth() === 0
        ? { year: now.getFullYear() - 1, month: 12 }
        : { year: now.getFullYear(), month: now.getMonth() },
    ]

    const results = await Promise.all(
      employeeIds.flatMap((employeeId) =>
        months.map(({ year, month }) =>
          fetchAttendanceMonth(employeeId, year, month)
            .then((records) => ({ employeeId, records }))
            .catch(() => ({ employeeId, records: [] })),
        ),
      ),
    )

    setAttendanceState((prev) => {
      const next = { ...prev }
      for (const { employeeId, records } of results) {
        if (records.length === 0) continue
        const dayMap = { ...next[employeeId] }
        for (const r of records) {
          if (dirtyAttendanceKeysRef.current.has(`${employeeId}|${r.date}`)) continue
          dayMap[r.date] = {
            status: r.status,
            ...(r.startTime ? { startTime: r.startTime } : {}),
            ...(r.updatedAt ? { updatedAt: r.updatedAt, updatedByName: r.updatedByName } : {}),
          }
        }
        next[employeeId] = dayMap
      }
      return next
    })
  }, [])

  useEffect(() => {
    if (!isAuthenticated || employeesData.length === 0) return
    const pending = employeesData.filter((emp) => !syncedAttendanceEmployeeIdsRef.current.has(emp.id))
    if (pending.length === 0) return
    for (const emp of pending) syncedAttendanceEmployeeIdsRef.current.add(emp.id)
    refreshAttendanceForEmployees(pending.map((emp) => emp.id))
  }, [isAuthenticated, employeesData, refreshAttendanceForEmployees])

  const addEmployee = useCallback(async (data) => {
    const { monthlySalary, ...rest } = data
    const created = await apiCreateEmployee({ ...rest, startingSalary: Number(monthlySalary) || 0 })
    setEmployeesData((prev) => [...prev, created])
    setAttendanceState((prev) => ({ ...prev, [created.id]: {} }))
    return created.id
  }, [])

  const updateEmployee = useCallback(async (id, data) => {
    const updated = await apiUpdateEmployee(id, data)
    setEmployeesData((prev) => prev.map((e) => (e.id === id ? updated : e)))
  }, [])

  // Adds (or replaces, if effectiveFrom matches an existing entry) a salary
  // history entry — the API does the same replace-in-place the old mock data
  // did, rather than rejecting a second revision on the same date.
  const reviseSalary = useCallback(async (employeeId, { amount, effectiveFrom }) => {
    const updated = await apiAddSalaryRevision(employeeId, { amount, effectiveFrom })
    setEmployeesData((prev) => prev.map((e) => (e.id === employeeId ? updated : e)))
  }, [])

  const deleteEmployee = useCallback(async (id) => {
    await apiDeleteEmployee(id)
    setEmployeesData((prev) => prev.filter((e) => e.id !== id))
    setAttendanceState((prev) => {
      const next = { ...prev }
      delete next[id]
      return next
    })
  }, [])

  // Merges a partial day record — { status: 'oneShift'|'doubleShift'|'absent'|
  // 'leave'|'dutyOff' } — into whatever is already stored for that employee/date.
  // Updates local state immediately (same synchronous feel as before this was
  // backed by a real API) and persists in the background; a failure rolls
  // the optimistic update back and surfaces a toast, since the caller
  // (Attendance.jsx) doesn't await this call or check a return value.
  const setAttendanceDay = useCallback(
    (employeeId, date, patch) => {
      // Read from the current `attendance` state directly rather than
      // inside setAttendanceState's updater — React 18 batches/defers that
      // updater, so anything computed inside it isn't available to code
      // right after the call (it would still be undefined here).
      const previousRecord = attendance[employeeId]?.[date]
      const mergedRecord = { ...previousRecord, ...patch }
      dirtyAttendanceKeysRef.current.add(`${employeeId}|${date}`)

      setAttendanceState((prev) => ({
        ...prev,
        [employeeId]: { ...prev[employeeId], [date]: mergedRecord },
      }))

      upsertAttendance(employeeId, date, mergedRecord.status, mergedRecord.startTime).catch((err) => {
        toast.error(`Couldn't save attendance to the server: ${err.message}`)
        setAttendanceState((prev) => ({
          ...prev,
          [employeeId]: { ...prev[employeeId], [date]: previousRecord },
        }))
      })
    },
    [attendance],
  )

  // ---------- Fuel Entries ----------
  // Wired to the real API (see ../lib/apiClient.js) — a fuel entry's
  // cascade into three other screens (attendance auto-mark, credit ledger,
  // employee credit, lubricant stock) is now computed and applied entirely
  // server-side, transactionally, by FuelEntryService — see its class
  // docstring for the exact rules being replicated (only a 'final' save
  // fires them, drafts never do; attendance is only ever forward re-derived,
  // never reversed for a previous employee, matching the original mock's
  // accepted behavior). This file's job is just to load the list and, after
  // a save/delete that could have changed one of those three screens,
  // refresh them so this session sees the result without a hard reload.
  const loadFuelEntries = useCallback(async () => {
    setFuelEntriesLoading(true)
    try {
      const list = await listFuelEntries()
      setFuelEntriesData(list)
    } catch {
      // Leaves whatever was last loaded — same reasoning as loadEmployees.
    } finally {
      setFuelEntriesLoading(false)
    }
  }, [])

  useEffect(() => {
    if (isAuthenticated) loadFuelEntries()
  }, [isAuthenticated, loadFuelEntries])

  const addFuelEntry = useCallback(
    async (entry) => {
      const created = await apiCreateFuelEntry(entry)
      setFuelEntriesData((prev) => [created, ...prev])
      if (created.status === 'final') {
        loadEmployees()
        loadLubricants()
        loadCreditCustomers()
        if (created.employeeId && !created.internalOnly) refreshAttendanceForEmployees([created.employeeId])
      }
      return created.id
    },
    [loadEmployees, loadLubricants, loadCreditCustomers, refreshAttendanceForEmployees],
  )

  const updateFuelEntry = useCallback(
    async (id, entry) => {
      const previous = fuelEntries.find((f) => f.id === id)
      const updated = await apiUpdateFuelEntry(id, entry)
      setFuelEntriesData((prev) => prev.map((f) => (f.id === id ? updated : f)))
      // A final->draft downgrade still reverses last save's side effects
      // server-side even though the new status itself isn't final — refresh
      // whenever either side of the transition was final.
      if (previous?.status === 'final' || updated.status === 'final') {
        loadEmployees()
        loadLubricants()
        loadCreditCustomers()
        if (updated.employeeId && !updated.internalOnly) refreshAttendanceForEmployees([updated.employeeId])
      }
    },
    [fuelEntries, loadEmployees, loadLubricants, loadCreditCustomers, refreshAttendanceForEmployees],
  )

  const deleteFuelEntry = useCallback(
    async (id) => {
      const previous = fuelEntries.find((f) => f.id === id)
      await apiDeleteFuelEntry(id)
      setFuelEntriesData((prev) => prev.filter((f) => f.id !== id))
      if (previous?.status === 'final') {
        loadEmployees()
        loadLubricants()
        loadCreditCustomers()
        if (previous.employeeId && !previous.internalOnly) refreshAttendanceForEmployees([previous.employeeId])
      }
    },
    [fuelEntries, loadEmployees, loadLubricants, loadCreditCustomers, refreshAttendanceForEmployees],
  )

  // ---------- Lubricants ----------
  const addLubricant = useCallback(async (data) => {
    const { rate, stock, purchaseHistory: _ignored, ...rest } = data
    const created = await apiCreateLubricant({
      ...rest,
      openingRate: Number(rate) || 0,
      openingStock: Number(stock) || 0,
    })
    setLubricants((prev) => [...prev, created])
    return created.id
  }, [])

  const updateLubricant = useCallback(async (id, data) => {
    const updated = await apiUpdateLubricant(id, data)
    setLubricants((prev) => prev.map((l) => (l.id === id ? updated : l)))
  }, [])

  // Adds (or replaces, if effectiveFrom matches an existing entry) a price
  // history entry — the API does the same replace-in-place the old mock data
  // did, rather than rejecting a second revision on the same date.
  const reviseLubricantPrice = useCallback(async (productId, { rate, effectiveFrom }) => {
    const updated = await apiAddLubricantPriceRevision(productId, { rate, effectiveFrom })
    setLubricants((prev) => prev.map((l) => (l.id === productId ? updated : l)))
  }, [])

  const deleteLubricant = useCallback(async (id) => {
    await apiDeleteLubricant(id)
    setLubricants((prev) => prev.filter((l) => l.id !== id))
  }, [])

  // Logs a restock from an outside supplier and adds its quantity onto the
  // product's current stock-on-hand (done server-side, atomically with the
  // purchase row itself — see LubricantService.add_purchase).
  const addPurchase = useCallback(async (productId, { qty, date, cost }) => {
    const updated = await apiAddLubricantPurchase(productId, { qty, date, cost })
    setLubricants((prev) => prev.map((l) => (l.id === productId ? updated : l)))
  }, [])

  // ---------- Credit Customers ----------
  // Wired to the real API (see ../lib/apiClient.js) — the same pattern as
  // Employees/Lubricants/Expenses.
  const addCustomer = useCallback(async (data) => {
    const created = await apiCreateCreditCustomer(data)
    setCreditCustomersData((prev) => [...prev, created])
    return created.id
  }, [])

  const updateCustomer = useCallback(async (id, data) => {
    const updated = await apiUpdateCreditCustomer(id, data)
    setCreditCustomersData((prev) => prev.map((c) => (c.id === id ? updated : c)))
  }, [])

  const deleteCustomer = useCallback(async (id) => {
    await apiDeleteCreditCustomer(id)
    setCreditCustomersData((prev) => prev.filter((c) => c.id !== id))
  }, [])

  const addLedgerEntry = useCallback(async (customerId, entry) => {
    const updated = await apiAddCreditLedgerEntry(customerId, entry)
    setCreditCustomersData((prev) => prev.map((c) => (c.id === customerId ? updated : c)))
  }, [])

  // Offers.jsx builds this entry itself ({ id, recipients: [name, ...],
  // message, sentAt }) exactly as before — this just also persists it to
  // Offer_Sends so "Recently Sent" survives a refresh. creditCustomers is
  // real data now, so a recipient's real id is just looked up by name here
  // rather than through a separate id-resolution map.
  const recordOfferSend = useCallback(
    (entry) => {
      setSentLog((prev) => [entry, ...prev])
      const customerIds = entry.recipients
        .map((name) => creditCustomers.find((c) => c.name === name)?.id)
        .filter(Boolean)
      if (customerIds.length === 0) return
      apiCreateOfferSend({ message: entry.message, customerIds }).catch(() => {
        // best-effort — the local entry above already reflects the send
      })
    },
    [creditCustomers],
  )

  // ---------- Expenses ----------
  // One record per day, holding however many line items ({label, amount})
  // the manager logged that day — same day-with-multiple-items shape as a
  // Fuel Entry, just without the pump/reading complexity. Wired to the real
  // API (see ../lib/apiClient.js) — the same pattern as Employees/Lubricants.
  const addExpenseDay = useCallback(async (data) => {
    const created = await apiCreateExpenseDay(data)
    setExpenseDays((prev) => [created, ...prev])
    return created.id
  }, [])

  const updateExpenseDay = useCallback(async (id, data) => {
    const updated = await apiUpdateExpenseDay(id, data)
    setExpenseDays((prev) => prev.map((d) => (d.id === id ? updated : d)))
  }, [])

  const deleteExpenseDay = useCallback(async (id) => {
    await apiDeleteExpenseDay(id)
    setExpenseDays((prev) => prev.filter((d) => d.id !== id))
  }, [])

  const value = useMemo(
    () => ({
      station,
      updateStation,
      fuelRates: FUEL_RATES,
      commissionRates,
      commissionRatesLoading,
      updateCommissionRates,
      isAuthenticated,
      authChecked,
      currentUser,
      login,
      verifyOtp,
      resendOtp,
      logout,
      authPassword,
      changePassword,
      employees,
      employeesLoading,
      addEmployee,
      updateEmployee,
      deleteEmployee,
      reviseSalary,
      attendance,
      setAttendanceDay,
      fuelEntries,
      fuelEntriesLoading,
      addFuelEntry,
      updateFuelEntry,
      deleteFuelEntry,
      lubricants,
      lubricantsLoading,
      addLubricant,
      updateLubricant,
      deleteLubricant,
      reviseLubricantPrice,
      addPurchase,
      creditCustomers,
      creditCustomersLoading,
      addCustomer,
      updateCustomer,
      deleteCustomer,
      addLedgerEntry,
      sentLog,
      recordOfferSend,
      expenseDays,
      expenseDaysLoading,
      addExpenseDay,
      updateExpenseDay,
      deleteExpenseDay,
    }),
    [
      station,
      updateStation,
      commissionRates,
      commissionRatesLoading,
      updateCommissionRates,
      isAuthenticated,
      authChecked,
      currentUser,
      login,
      verifyOtp,
      resendOtp,
      logout,
      authPassword,
      changePassword,
      employees,
      employeesLoading,
      addEmployee,
      updateEmployee,
      deleteEmployee,
      reviseSalary,
      attendance,
      setAttendanceDay,
      fuelEntries,
      fuelEntriesLoading,
      addFuelEntry,
      updateFuelEntry,
      deleteFuelEntry,
      lubricants,
      lubricantsLoading,
      addLubricant,
      updateLubricant,
      deleteLubricant,
      reviseLubricantPrice,
      addPurchase,
      creditCustomers,
      creditCustomersLoading,
      addCustomer,
      updateCustomer,
      deleteCustomer,
      addLedgerEntry,
      sentLog,
      recordOfferSend,
      expenseDays,
      expenseDaysLoading,
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
