// Thin fetch wrapper around the FastAPI backend (../../../api). Handles
// token storage, the login/refresh/logout calls, and a generic authenticated
// fetch that transparently retries once via refresh on a 401 — the same
// localStorage prefix DataContext already uses for everything else, so
// clearing app data in devtools clears auth too.

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000/api/v1'
const STORAGE_PREFIX = 'ga-fuel-pump:'
const REFRESH_TOKEN_KEY = STORAGE_PREFIX + 'refreshToken'

// The access token lives in memory only — never localStorage/sessionStorage
// — so it's wiped on refresh/tab-close instead of sitting around
// indefinitely for an XSS payload (or a browser extension reading storage
// at leisure) to scrape later. This does mean a hard refresh always starts
// with no access token, but that's fine: DataContext's restoreSession
// effect silently mints a fresh one from the refresh token below on load.
let accessToken = null

export class ApiError extends Error {
  constructor(message, status) {
    super(message)
    this.name = 'ApiError'
    this.status = status
  }
}

export function getAccessToken() {
  return accessToken
}

export function getRefreshToken() {
  return localStorage.getItem(REFRESH_TOKEN_KEY)
}

function setTokens(newAccessToken, refreshToken) {
  accessToken = newAccessToken
  localStorage.setItem(REFRESH_TOKEN_KEY, refreshToken)
}

export function clearTokens() {
  accessToken = null
  localStorage.removeItem(REFRESH_TOKEN_KEY)
}

async function messageFor(response) {
  try {
    const body = await response.json()
    return body.detail || `Request failed (${response.status})`
  } catch {
    return `Request failed (${response.status})`
  }
}

async function rawFetch(path, options = {}) {
  return fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
  })
}

// `identifier` is whatever the user typed — their account email or their
// display name, either works (see UserRepository.get_by_identifier on the API).
//
// Login is normally two-step: this checks the password and returns an
// `otp_token` (not a real session) — the caller must then call verifyOtp()
// with the code sent to the account's phone (see api/app/core/sms.py) before
// a real access/refresh token pair is issued. While the API's OTP_ENABLED
// flag is temporarily off (no real SMS provider wired up yet), the OTP step
// is skipped server-side and this returns a real token pair directly instead
// — detected here by the presence of access_token, so the caller (DataContext)
// can complete the session immediately rather than waiting for verifyOtp().
export async function login(identifier, password) {
  const response = await rawFetch('/auth/login', { method: 'POST', body: JSON.stringify({ identifier, password }) })
  if (!response.ok) throw new ApiError(await messageFor(response), response.status)
  const data = await response.json()
  if (data.access_token) setTokens(data.access_token, data.refresh_token)
  return data
}

export async function verifyOtp(otpToken, code) {
  const response = await rawFetch('/auth/verify-otp', {
    method: 'POST',
    body: JSON.stringify({ otp_token: otpToken, code }),
  })
  if (!response.ok) throw new ApiError(await messageFor(response), response.status)
  const data = await response.json()
  setTokens(data.access_token, data.refresh_token)
  return data
}

export async function resendOtp(otpToken) {
  const response = await rawFetch('/auth/resend-otp', { method: 'POST', body: JSON.stringify({ otp_token: otpToken }) })
  if (!response.ok) throw new ApiError(await messageFor(response), response.status)
  return response.json()
}

export async function fetchMe(accessToken) {
  const response = await rawFetch('/auth/me', { headers: { Authorization: `Bearer ${accessToken}` } })
  if (!response.ok) throw new ApiError(await messageFor(response), response.status)
  return response.json()
}

export async function refreshTokens() {
  const refreshToken = getRefreshToken()
  if (!refreshToken) throw new ApiError('No active session', 401)
  const response = await rawFetch('/auth/refresh', {
    method: 'POST',
    body: JSON.stringify({ refresh_token: refreshToken }),
  })
  if (!response.ok) {
    clearTokens()
    throw new ApiError(await messageFor(response), response.status)
  }
  const data = await response.json()
  setTokens(data.access_token, data.refresh_token)
  return data
}

export async function logout() {
  const refreshToken = getRefreshToken()
  if (refreshToken) {
    // Best-effort — a network hiccup here shouldn't stop the local session
    // from clearing; the refresh token still expires/rotates out server-side.
    try {
      await rawFetch('/auth/logout', { method: 'POST', body: JSON.stringify({ refresh_token: refreshToken }) })
    } catch {
      /* ignore */
    }
  }
  clearTokens()
}

// Refresh tokens are single-use/rotating (see api/app/services/auth_service.py),
// so if N requests fire in parallel (e.g. the attendance sync effect's
// per-employee-per-month fetches) and all hit a 401 at once, they must NOT
// each call refreshTokens() independently: only the first would succeed,
// every other would fail on an already-rotated token, and a failed refresh
// clears the session — turning a normal "access token just expired" moment
// into an unwanted logout. All concurrent 401s instead await this one
// shared in-flight refresh.
let inFlightRefresh = null

function refreshTokensOnce() {
  if (!inFlightRefresh) {
    inFlightRefresh = refreshTokens().finally(() => {
      inFlightRefresh = null
    })
  }
  return inFlightRefresh
}

// Attaches the access token and retries once via refreshTokensOnce() on a
// 401 (access token expired but the session — judged server-side by idle
// time — may still be valid).
export async function apiFetch(path, options = {}) {
  let response = await rawFetch(path, {
    ...options,
    headers: { ...(options.headers || {}), Authorization: `Bearer ${getAccessToken()}` },
  })
  if (response.status === 401) {
    await refreshTokensOnce()
    response = await rawFetch(path, {
      ...options,
      headers: { ...(options.headers || {}), Authorization: `Bearer ${getAccessToken()}` },
    })
  }
  if (!response.ok) throw new ApiError(await messageFor(response), response.status)
  if (response.status === 204) return null
  return response.json()
}

// ---------- Uploads ----------
// Bill photos/documents — real files saved to the API's local disk (see
// api/app/controllers/upload_controller.py). Bypasses rawFetch()/apiFetch()
// deliberately: rawFetch forces Content-Type: application/json, which would
// break the browser's own multipart/form-data boundary header if applied to
// a FormData body.
export async function uploadFile(file) {
  const formData = new FormData()
  formData.append('file', file)

  async function send() {
    return fetch(`${API_BASE_URL}/uploads`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${getAccessToken()}` },
      body: formData,
    })
  }

  let response = await send()
  if (response.status === 401) {
    await refreshTokensOnce()
    response = await send()
  }
  if (!response.ok) throw new ApiError(await messageFor(response), response.status)
  return response.json()
}

// A bill's file_url from the upload endpoint above is a path relative to the
// API's origin (e.g. "/uploads/xyz.jpg"), not the page's — needs the API's
// origin prepended to be usable directly in <img src>/<a href>. Bills saved
// before this endpoint existed hold a base64 data: URL instead, which (like
// a plain http(s) URL) already works as-is and passes through untouched.
const API_ORIGIN = API_BASE_URL.replace(/\/api\/v1\/?$/, '')

export function resolveFileUrl(url) {
  if (!url) return url
  if (url.startsWith('data:') || /^https?:\/\//.test(url)) return url
  return `${API_ORIGIN}${url}`
}

// ---------- Employees ----------
// Maps the API's snake_case Employee shape to/from the camelCase shape the
// rest of the app (DataContext, Employees/Salary pages) already expects —
// unlike auth, this is a real CRUD resource, so create/update payloads need
// the reverse mapping too.

function toEmployeePayload(data) {
  const payload = {}
  if ('name' in data) payload.name = data.name
  if ('fatherName' in data) payload.father_name = data.fatherName || null
  if ('role' in data) payload.role = data.role
  if ('phone' in data) payload.phone = data.phone || null
  if ('joinDate' in data) payload.join_date = data.joinDate
  if ('active' in data) payload.active = data.active
  if ('notes' in data) payload.notes = data.notes || null
  if ('startingSalary' in data) payload.starting_salary = data.startingSalary
  return payload
}

function normalizeEmployee(raw) {
  return {
    id: raw.id,
    name: raw.name,
    fatherName: raw.father_name || '',
    role: raw.role,
    phone: raw.phone || '',
    joinDate: raw.join_date,
    active: raw.active,
    notes: raw.notes || '',
    salaryHistory: (raw.salary_history || []).map((h) => ({
      effectiveFrom: h.effective_from,
      amount: Number(h.amount),
    })),
    // Written by Fuel Entry's 'employee credit' payment lines — see
    // ---------- Fuel Entries ---------- below. Read-only here; there's no
    // standalone create/update/delete for a credit entry by itself.
    credits: (raw.credits || []).map((c) => ({
      id: c.id,
      date: c.date,
      amount: Number(c.amount),
      note: c.note || '',
      sourceFuelEntryId: c.source_fuel_entry_id || null,
    })),
    createdAt: raw.created_at,
    updatedAt: raw.updated_at,
    createdByName: raw.created_by_name || '',
    updatedByName: raw.updated_by_name || '',
  }
}

export async function listEmployees() {
  const raw = await apiFetch('/employees?limit=200')
  return raw.map(normalizeEmployee)
}

export async function createEmployee(data) {
  const raw = await apiFetch('/employees', { method: 'POST', body: JSON.stringify(toEmployeePayload(data)) })
  return normalizeEmployee(raw)
}

export async function updateEmployee(id, data) {
  const raw = await apiFetch(`/employees/${id}`, { method: 'PATCH', body: JSON.stringify(toEmployeePayload(data)) })
  return normalizeEmployee(raw)
}

export async function deleteEmployee(id) {
  await apiFetch(`/employees/${id}`, { method: 'DELETE' })
}

export async function addSalaryRevision(id, { amount, effectiveFrom }) {
  const raw = await apiFetch(`/employees/${id}/salary-history`, {
    method: 'POST',
    body: JSON.stringify({ effective_from: effectiveFrom, amount: Number(amount) }),
  })
  return normalizeEmployee(raw)
}

// ---------- Lubricants ----------
// Same snake_case/camelCase mapping story as Employees above.

function toLubricantPayload(data) {
  const payload = {}
  if ('name' in data) payload.name = data.name
  if ('unit' in data) payload.unit = data.unit
  if ('packaging' in data) payload.packaging = data.packaging
  if ('openingRate' in data) payload.opening_rate = data.openingRate
  if ('openingStock' in data) payload.opening_stock = data.openingStock
  return payload
}

function normalizeLubricant(raw) {
  return {
    id: raw.id,
    name: raw.name,
    unit: raw.unit,
    packaging: raw.packaging,
    stock: Number(raw.stock),
    priceHistory: (raw.price_history || []).map((h) => ({
      effectiveFrom: h.effective_from,
      rate: Number(h.rate),
    })),
    purchaseHistory: (raw.purchase_history || []).map((h) => ({
      id: h.id,
      date: h.date,
      qty: h.qty,
      cost: Number(h.cost),
    })),
    createdAt: raw.created_at,
    updatedAt: raw.updated_at,
    createdByName: raw.created_by_name || '',
    updatedByName: raw.updated_by_name || '',
  }
}

export async function listLubricants() {
  const raw = await apiFetch('/lubricants?limit=200')
  return raw.map(normalizeLubricant)
}

export async function createLubricant(data) {
  const raw = await apiFetch('/lubricants', { method: 'POST', body: JSON.stringify(toLubricantPayload(data)) })
  return normalizeLubricant(raw)
}

export async function updateLubricant(id, data) {
  const raw = await apiFetch(`/lubricants/${id}`, { method: 'PATCH', body: JSON.stringify(toLubricantPayload(data)) })
  return normalizeLubricant(raw)
}

export async function deleteLubricant(id) {
  await apiFetch(`/lubricants/${id}`, { method: 'DELETE' })
}

export async function addLubricantPriceRevision(id, { rate, effectiveFrom }) {
  const raw = await apiFetch(`/lubricants/${id}/price-history`, {
    method: 'POST',
    body: JSON.stringify({ effective_from: effectiveFrom, rate: Number(rate) }),
  })
  return normalizeLubricant(raw)
}

export async function addLubricantPurchase(id, { qty, date, cost }) {
  const raw = await apiFetch(`/lubricants/${id}/purchases`, {
    method: 'POST',
    body: JSON.stringify({ date, qty: Number(qty), cost: Number(cost) }),
  })
  return normalizeLubricant(raw)
}

// ---------- Expenses ----------
// A day's items are always resubmitted as a whole (the UI has no per-item
// endpoint), so the payload is just { date, items }; no snake_case fields on
// either side beyond the item shape itself.

function toExpenseItemPayload(item) {
  return { label: item.label, amount: Number(item.amount) }
}

function normalizeExpenseDay(raw) {
  return {
    id: raw.id,
    date: raw.date,
    items: (raw.items || []).map((i) => ({ id: i.id, label: i.label, amount: Number(i.amount) })),
    createdAt: raw.created_at,
    updatedAt: raw.updated_at,
    createdByName: raw.created_by_name || '',
    updatedByName: raw.updated_by_name || '',
  }
}

export async function listExpenseDays() {
  const raw = await apiFetch('/expenses?limit=500')
  return raw.map(normalizeExpenseDay)
}

export async function createExpenseDay({ date, items }) {
  const raw = await apiFetch('/expenses', {
    method: 'POST',
    body: JSON.stringify({ date, items: items.map(toExpenseItemPayload) }),
  })
  return normalizeExpenseDay(raw)
}

export async function updateExpenseDay(id, { date, items }) {
  const raw = await apiFetch(`/expenses/${id}`, {
    method: 'PATCH',
    body: JSON.stringify({ date, items: items.map(toExpenseItemPayload) }),
  })
  return normalizeExpenseDay(raw)
}

export async function deleteExpenseDay(id) {
  await apiFetch(`/expenses/${id}`, { method: 'DELETE' })
}

// ---------- Commission Rate History ----------
// The backend stores this as a fully dated, 5-field snapshot (petrol/diesel/
// oil per-litre + oil_packet/oil_cane per-piece — see api/app/models/commission.py),
// but Dashboard's rate-edit form only ever collects 3 of those 5 fields and
// has no date picker. reviseCommissionRates bridges that: it carries
// oil_packet/oil_cane forward from whatever's already current and stamps
// effective_from as today, so the caller can keep submitting just the 3
// fields it has UI for.

function normalizeCommissionRate(raw) {
  return {
    id: raw.id,
    effectiveFrom: raw.effective_from,
    petrol: Number(raw.petrol),
    diesel: Number(raw.diesel),
    oil: Number(raw.oil),
    oilPacket: Number(raw.oil_packet),
    oilCane: Number(raw.oil_cane),
    createdAt: raw.created_at,
    updatedAt: raw.updated_at,
    createdByName: raw.created_by_name || '',
    updatedByName: raw.updated_by_name || '',
  }
}

export async function getCurrentCommissionRate() {
  const raw = await apiFetch('/commission-rates/current')
  return normalizeCommissionRate(raw)
}

export async function reviseCommissionRate({ effectiveFrom, petrol, diesel, oil, oilPacket, oilCane }) {
  const raw = await apiFetch('/commission-rates', {
    method: 'POST',
    body: JSON.stringify({
      effective_from: effectiveFrom,
      petrol,
      diesel,
      oil,
      oil_packet: oilPacket,
      oil_cane: oilCane,
    }),
  })
  return normalizeCommissionRate(raw)
}

// ---------- Credit Customers ----------
// Maps the API's snake_case shape to/from the camelCase shape
// CreditBills.jsx (and ui/src/data/mockData.js's closingBalance(), which
// keeps running unchanged against this same shape) already expect. A bill's
// local id (assigned client-side via CreditBills.jsx's own makeId() before
// it's ever saved) is never sent — bills fully replace on every write, same
// "whole thing resubmitted" pattern as Fuel Entry's bills/payments/oil_rows,
// so the API always assigns fresh ids regardless of which bills are
// actually new.

function toCreditLedgerEntryPayload(entry) {
  return {
    date: entry.date,
    type: entry.type,
    fuel_type: entry.fuelType ? entry.fuelType.toLowerCase() : null,
    litres: entry.ltr != null ? Number(entry.ltr) : null,
    rate: entry.rate != null ? Number(entry.rate) : null,
    amount: Number(entry.amount) || 0,
    mode: entry.mode || null,
    note: entry.note || null,
    bill_file_name: entry.billName || null,
    bill_file_url: entry.billUrl || null,
  }
}

function normalizeCreditLedgerEntry(raw) {
  const fuelLabel = { petrol: 'Petrol', diesel: 'Diesel', oil: 'Oil' }
  return {
    id: raw.id,
    date: raw.date,
    type: raw.type,
    fuelType: raw.fuel_type ? fuelLabel[raw.fuel_type] || raw.fuel_type : null,
    ltr: raw.litres != null ? Number(raw.litres) : null,
    rate: raw.rate != null ? Number(raw.rate) : null,
    // A genuine number, not the numeric string a Decimal always serializes
    // as — mockData.js's closingBalance() (unchanged, still client-side)
    // does plain bal +/- entry.amount arithmetic, which would silently do
    // string concatenation instead of addition otherwise.
    amount: Number(raw.amount),
    mode: raw.mode,
    note: raw.note || '',
    billUrl: raw.bill_file_url || null,
    billName: raw.bill_file_name || null,
    sourceFuelEntryId: raw.source_fuel_entry_id || null,
  }
}

function toCreditCustomerBillPayload(bill) {
  return { file_name: bill.name, file_url: bill.url, uploaded_date: bill.date || todayISO() }
}

function normalizeCreditCustomerBill(raw) {
  return { id: raw.id, name: raw.file_name, url: raw.file_url, date: raw.uploaded_date }
}

function normalizeCreditCustomer(raw) {
  return {
    id: raw.id,
    name: raw.name,
    phone: raw.phone || '',
    openingBalance: Number(raw.opening_balance),
    notes: raw.notes || '',
    ledger: (raw.ledger_entries || []).map(normalizeCreditLedgerEntry),
    bills: (raw.bills || []).map(normalizeCreditCustomerBill),
    createdAt: raw.created_at,
    updatedAt: raw.updated_at,
    createdByName: raw.created_by_name || '',
    updatedByName: raw.updated_by_name || '',
  }
}

export async function listCreditCustomers() {
  const raw = await apiFetch('/credit-customers?limit=1000')
  return raw.map(normalizeCreditCustomer)
}

export async function createCreditCustomer(data) {
  const raw = await apiFetch('/credit-customers', {
    method: 'POST',
    body: JSON.stringify({
      name: data.name,
      phone: data.phone || null,
      opening_balance: Number(data.openingBalance) || 0,
      notes: data.notes || null,
      bills: (data.bills || []).map(toCreditCustomerBillPayload),
    }),
  })
  return normalizeCreditCustomer(raw)
}

export async function updateCreditCustomer(id, data) {
  const payload = {}
  if ('name' in data) payload.name = data.name
  if ('phone' in data) payload.phone = data.phone || null
  if ('openingBalance' in data) payload.opening_balance = Number(data.openingBalance) || 0
  if ('notes' in data) payload.notes = data.notes || null
  if ('bills' in data) payload.bills = (data.bills || []).map(toCreditCustomerBillPayload)
  const raw = await apiFetch(`/credit-customers/${id}`, { method: 'PATCH', body: JSON.stringify(payload) })
  return normalizeCreditCustomer(raw)
}

export async function deleteCreditCustomer(id) {
  await apiFetch(`/credit-customers/${id}`, { method: 'DELETE' })
}

export async function addCreditLedgerEntry(customerId, entry) {
  const raw = await apiFetch(`/credit-customers/${customerId}/ledger`, {
    method: 'POST',
    body: JSON.stringify(toCreditLedgerEntryPayload(entry)),
  })
  return normalizeCreditCustomer(raw)
}

// ---------- Offers ----------
// Only the send-event log is a real backend resource (Offer_Sends /
// Offer_Send_Recipients) — customer_ids must be real Credit_Customers ids,
// which creditCustomers now always are (see DataContext.jsx).

function normalizeOfferSend(raw) {
  return {
    id: raw.id,
    message: raw.message,
    recipients: (raw.recipients || []).map((r) => r.customer_name),
    sentAt: raw.sent_at,
    createdByName: raw.created_by_name || '',
  }
}

export async function listOfferSends() {
  const raw = await apiFetch('/offers?limit=200')
  return raw.map(normalizeOfferSend)
}

export async function createOfferSend({ message, customerIds }) {
  const raw = await apiFetch('/offers', {
    method: 'POST',
    body: JSON.stringify({ message, customer_ids: customerIds }),
  })
  return normalizeOfferSend(raw)
}

// ---------- Fuel Entries ----------
// The shift-entry shape mirrors ui/src/utils/fuelCalc.js exactly — this is
// only the snake_case/camelCase boundary. All liters/amount/total
// calculations stay entirely client-side in fuelCalc.js, unchanged: the API
// also computes and stores its own authoritative totals, but the frontend
// never reads those back, so PumpDayEditor/FuelEntry.jsx need no changes
// here. Numeric leaf fields (opening/closing/testing/rate/amount/stockCount/
// stockRate) are passed through as whatever the API gives (a numeric string,
// same as a Decimal always serializes) — every call site already wraps
// these in Number() before doing arithmetic, exactly like the old mock data
// (which itself mixed plain JS numbers and typed-in strings).

function toReadingPayload(reading) {
  return {
    opening: Number(reading?.opening) || 0,
    closing: Number(reading?.closing) || 0,
    testing: Number(reading?.testing) || 0,
    rate: Number(reading?.rate) || 0,
  }
}

function toNozzlesPayload(nozzles) {
  return { nozzle1: toReadingPayload(nozzles?.nozzle1), nozzle2: toReadingPayload(nozzles?.nozzle2) }
}

function toOilRowPayload(row) {
  return {
    product_id: row.productId || null,
    stock_count: Number(row.stockCount) || 0,
    stock_rate: Number(row.stockRate) || 0,
  }
}

const PAYMENT_TYPE_TO_API = { cash: 'cash', credit: 'credit', employeeCredit: 'employee_credit', expense: 'expense' }
const PAYMENT_TYPE_FROM_API = { cash: 'cash', credit: 'credit', employee_credit: 'employeeCredit', expense: 'expense' }

// A credit line's customerId is a real Credit_Customers id now that Credit
// Bills is fully wired (creditCustomers is no longer mock data).
function toPaymentPayload(p) {
  return {
    label: p.label || '',
    amount: Number(p.amount) || 0,
    type: PAYMENT_TYPE_TO_API[p.type] || 'cash',
    customer_id: p.type === 'credit' ? p.customerId || null : null,
    employee_id: p.type === 'employeeCredit' ? p.employeeId || null : null,
    note: p.note || null,
  }
}

function toBillPayload(bill) {
  return { file_name: bill.name, file_url: bill.url, uploaded_date: bill.date }
}

export function toFuelEntryPayload(entry) {
  const isPump2 = entry.pumpKey === 'pump2'
  return {
    date: entry.date,
    pump_key: entry.pumpKey,
    shift_number: entry.shiftNumber,
    internal_only: !!entry.internalOnly,
    employee_id: entry.employeeId || null,
    status: entry.status || 'draft',
    petrol: toNozzlesPayload(entry.petrol),
    diesel: toNozzlesPayload(entry.diesel),
    oil: isPump2 ? toNozzlesPayload(entry.oil) : null,
    oil_rows: isPump2 ? (entry.oilRows || []).map(toOilRowPayload) : [],
    cane_oil_rows: isPump2 ? (entry.caneOilRows || []).map(toOilRowPayload) : [],
    cane_oil_offer: isPump2 ? Number(entry.caneOilOffer) || 0 : 0,
    payments: (entry.payments || []).map(toPaymentPayload),
    bills: (entry.bills || []).map(toBillPayload),
    notes: entry.notes || null,
  }
}

function normalizeReading(reading) {
  return {
    opening: reading?.opening ?? '',
    closing: reading?.closing ?? '',
    testing: reading?.testing ?? '',
    rate: reading?.rate ?? '',
  }
}

function normalizeNozzles(nozzles) {
  return { nozzle1: normalizeReading(nozzles?.nozzle1), nozzle2: normalizeReading(nozzles?.nozzle2) }
}

function normalizeOilRow(row) {
  return { id: row.id, productId: row.product_id || '', stockCount: row.stock_count, stockRate: row.stock_rate }
}

function normalizePayment(p) {
  return {
    id: p.id,
    label: p.label,
    amount: p.amount,
    type: PAYMENT_TYPE_FROM_API[p.type] || 'cash',
    customerId: p.customer_id || '',
    employeeId: p.employee_id || '',
    note: p.note || '',
  }
}

function normalizeBill(b) {
  return { id: b.id, name: b.file_name, url: b.file_url, date: b.uploaded_date }
}

export function normalizeFuelEntry(raw) {
  const entry = {
    id: raw.id,
    date: raw.date,
    pumpKey: raw.pump_key,
    shiftNumber: raw.shift_number,
    internalOnly: raw.internal_only,
    employeeId: raw.employee_id || '',
    status: raw.status,
    petrol: normalizeNozzles(raw.petrol),
    diesel: normalizeNozzles(raw.diesel),
    payments: (raw.payments || []).map(normalizePayment),
    bills: (raw.bills || []).map(normalizeBill),
    notes: raw.notes || '',
  }
  if (raw.pump_key === 'pump2') {
    entry.oil = normalizeNozzles(raw.oil)
    entry.oilRows = (raw.oil_rows || []).map(normalizeOilRow)
    entry.caneOilRows = (raw.cane_oil_rows || []).map(normalizeOilRow)
    entry.caneOilOffer = raw.cane_oil_offer
  }
  return entry
}

export async function listFuelEntries() {
  const raw = await apiFetch('/fuel-entries?limit=2000')
  return raw.map(normalizeFuelEntry)
}

export async function createFuelEntry(entry) {
  const raw = await apiFetch('/fuel-entries', {
    method: 'POST',
    body: JSON.stringify(toFuelEntryPayload(entry)),
  })
  return normalizeFuelEntry(raw)
}

export async function updateFuelEntry(id, entry) {
  const raw = await apiFetch(`/fuel-entries/${id}`, {
    method: 'PUT',
    body: JSON.stringify(toFuelEntryPayload(entry)),
  })
  return normalizeFuelEntry(raw)
}

export async function deleteFuelEntry(id) {
  await apiFetch(`/fuel-entries/${id}`, { method: 'DELETE' })
}
