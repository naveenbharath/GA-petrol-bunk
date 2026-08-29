// Static seed data for the demo. Everything here is loaded once into React state
// (see src/context/DataContext.jsx) and mutated in-memory by CRUD actions.

import { entryFuelAmount, emptyOilRow, emptyCaneOilRow } from '../utils/fuelCalc.js'

export const STATION = {
  name: 'Ganapathi Murugan Agency',
  brand: 'IndianOil',
  dealerType: 'IOCL Dealer',
  sapNo: '350287',
  gstin: '33DNXPR1842E1ZO',
  dealerName: 'Narayanan Murugaiah',
  addressLines: ['1306/A, NH:208, Madurai Main Road', 'Chinthamani (Village) – 627855', 'Kadayanallur (Tk), Tenkasi (Dist), Tamil Nadu'],
  location: 'Chinthamani, Kadayanallur, Tenkasi District, Tamil Nadu',
  mobiles: ['98425 31354', '77083 51110'],
  email: 'narayananraji1986@gmail.com',
  logo: '/logo.png',
  photo: '/station-photo.jpg',
  // Who the Fuel Entry "Audit" report gets emailed to — editable right from
  // the Audit modal itself, since there's no separate settings screen.
  auditContactEmail: '',
}

export const FUEL_RATES = {
  petrol: 108.6,
  diesel: 100.45,
  oil: 220,
}

// The dealer's standard per-litre commission from the oil company — separate
// from the retail rate above, and the basis for the Dashboard/Fuel Entry
// profit summary (commission earned − expenses, for the selected month).
// Editable from the Dashboard so it stays matched to the station's actual
// OMC agreement, which is renegotiated occasionally.
export const COMMISSION_RATES = {
  petrol: 3,
  diesel: 2,
  oil: 5,
}

function isoDaysAgo(n) {
  const d = new Date()
  d.setHours(0, 0, 0, 0)
  d.setDate(d.getDate() - n)
  const yyyy = d.getFullYear()
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${yyyy}-${mm}-${dd}`
}

// ---------- Employees & Attendance ----------

// salaryHistory: [{ effectiveFrom: 'YYYY-MM-DD', amount }] — the entry whose
// effectiveFrom is the latest one on/before a given date is the salary in
// force on that date. First entry always starts at joinDate. e1 and e4 carry
// an extra revision each so the demo shows the "Revise Salary" feature.
export const EMPLOYEES = [
  {
    id: 'e1', name: 'Murugan S', fatherName: 'Shanmugam', role: 'Pump Operator', phone: '9843211001', joinDate: '2021-03-14', active: true, notes: 'Reliable morning-shift operator, good with customers.',
    salaryHistory: [{ effectiveFrom: '2021-03-14', amount: 12000 }, { effectiveFrom: '2023-04-01', amount: 15000 }],
  },
  {
    id: 'e2', name: 'Karthikeyan R', fatherName: 'Ramasamy', role: 'Pump Operator', phone: '9843211002', joinDate: '2021-06-02', active: true, notes: '',
    salaryHistory: [{ effectiveFrom: '2021-06-02', amount: 15000 }],
  },
  {
    id: 'e3', name: 'Lakshmi Priya', fatherName: 'Duraisamy', role: 'Cashier', phone: '9843211003', joinDate: '2022-01-19', active: true, notes: 'Handles cash reconciliation independently.',
    salaryHistory: [{ effectiveFrom: '2022-01-19', amount: 16000 }],
  },
  {
    id: 'e4', name: 'Selvam Nadar', fatherName: 'Kaliyaperumal Nadar', role: 'Supervisor', phone: '9843211004', joinDate: '2019-11-05', active: true, notes: 'Senior staff, oversees shift handovers.',
    salaryHistory: [{ effectiveFrom: '2019-11-05', amount: 18000 }, { effectiveFrom: '2022-04-01', amount: 22000 }],
  },
  {
    id: 'e5', name: 'Meena K', fatherName: 'Krishnan', role: 'Attendant', phone: '9843211005', joinDate: '2023-02-27', active: true, notes: '',
    salaryHistory: [{ effectiveFrom: '2023-02-27', amount: 12000 }],
  },
  {
    id: 'e6', name: 'Rajesh Kumar', fatherName: 'Govindasamy', role: 'Night Operator', phone: '9843211006', joinDate: '2022-08-11', active: true, notes: 'Often does a double (24hr) shift, then takes the next day off.',
    salaryHistory: [{ effectiveFrom: '2022-08-11', amount: 15000 }],
  },
  {
    id: 'e7', name: 'Suresh Babu', fatherName: 'Marimuthu', role: 'Cleaner', phone: '9843211007', joinDate: '2023-07-09', active: true, notes: '',
    salaryHistory: [{ effectiveFrom: '2023-07-09', amount: 10000 }],
  },
]

// Deterministic pseudo-pattern per employee so the demo looks the same each load
const ATTENDANCE_PATTERNS = {
  e1: ['present', 'present', 'present', 'present', 'present', 'leave', 'present', 'present', 'present', 'present', 'present', 'present', 'absent', 'present'],
  e2: ['present', 'present', 'absent', 'present', 'present', 'present', 'present', 'present', 'leave', 'present', 'present', 'present', 'present', 'present'],
  e3: ['present', 'present', 'present', 'present', 'present', 'present', 'present', 'present', 'present', 'present', 'present', 'present', 'present', 'present'],
  e4: ['present', 'present', 'present', 'leave', 'leave', 'present', 'present', 'present', 'present', 'present', 'present', 'present', 'present', 'present'],
  e5: ['present', 'absent', 'present', 'present', 'present', 'present', 'absent', 'present', 'present', 'present', 'present', 'absent', 'present', 'present'],
  e6: ['present', 'present', 'present', 'present', 'absent', 'present', 'present', 'present', 'present', 'leave', 'present', 'present', 'present', 'present'],
  e7: ['present', 'present', 'present', 'present', 'present', 'present', 'present', 'absent', 'present', 'present', 'present', 'present', 'present', 'present'],
}

// Long enough to cover the current calendar month plus the whole previous
// month, so the monthly attendance view has real data when browsing "Previous".
export const ATTENDANCE_DAYS = 60

// Employees who occasionally work a double (24hr) shift in the seed data —
// each one automatically gets the following day seeded as a duty-off.
const DOUBLE_SHIFT_EMPLOYEES = new Set(['e6'])

const SHIFT_START_TIMES = ['06:00', '07:00', '08:00', '09:00']

// Deterministic filler for days older than the hand-tuned ATTENDANCE_PATTERNS
// (index 0-13) — keeps the seed data reproducible without Math.random.
function fillerStatus(empId, i) {
  const seed = (i * 5 + empId.charCodeAt(1) * 3) % 11
  if (seed === 0) return 'leave'
  if (seed === 1 || seed === 2) return 'absent'
  return 'present'
}

// Builds { [employeeId]: { 'YYYY-MM-DD': { status } } } for the last
// ATTENDANCE_DAYS days. status is one of:
// 'oneShift' | 'doubleShift' | 'absent' | 'leave' | 'dutyOff'
// Processed oldest-to-newest so a doubleShift day correctly cascades into a
// dutyOff seed for the following day.
export function buildAttendance() {
  const record = {}
  for (const emp of EMPLOYEES) {
    const pattern = ATTENDANCE_PATTERNS[emp.id]
    const days = {}
    let forceDutyOff = false
    for (let i = ATTENDANCE_DAYS - 1; i >= 0; i--) {
      const date = isoDaysAgo(i)

      if (forceDutyOff) {
        days[date] = { status: 'dutyOff' }
        forceDutyOff = false
        continue
      }

      const overallStatus = i < pattern.length ? pattern[i] || 'present' : fillerStatus(emp.id, i)
      let status = overallStatus === 'present' ? 'oneShift' : overallStatus
      if (status === 'oneShift' && DOUBLE_SHIFT_EMPLOYEES.has(emp.id) && i % 3 === 0) {
        status = 'doubleShift'
      }
      if (status === 'oneShift' || status === 'doubleShift') {
        days[date] = { status, startTime: SHIFT_START_TIMES[i % SHIFT_START_TIMES.length] }
      } else {
        days[date] = { status }
      }
      forceDutyOff = status === 'doubleShift'
    }
    record[emp.id] = days
  }
  return record
}

// ---------- Daily Fuel Entries ----------
//
// Each day is organised per physical pump island (see utils/fuelCalc.js for
// the shape). Pump 1 sells petrol + diesel; Pump 2 also sells Oil (coolant).
// Meter readings carry forward day-to-day (today's opening = yesterday's
// closing for that pump+fuel), and a day with two employees gets a handover
// reading splitting the day's liters between their two shifts.

// Per-day liters sold, oldest (offset 6) first -> newest (offset 0) last.
// `emp` is a single employeeId (one shift) or [empA, empB] (handover shift).
const PUMP_DAY_TEMPLATES = {
  pump1: [
    { offset: 6, petrol: 610, diesel: 940, emp: 'e1' },
    { offset: 5, petrol: 585, diesel: 905, emp: 'e1' },
    { offset: 4, petrol: 640, diesel: 970, emp: ['e1', 'e2'] },
    { offset: 3, petrol: 560, diesel: 860, emp: 'e2' },
    { offset: 2, petrol: 615, diesel: 930, emp: 'e1' },
    { offset: 1, petrol: 600, diesel: 915, emp: 'e1' },
    { offset: 0, petrol: 590, diesel: 900, emp: ['e1', 'e2'] },
  ],
  pump2: [
    { offset: 6, petrol: 480, diesel: 760, oil: 6, emp: 'e5' },
    { offset: 5, petrol: 505, diesel: 790, oil: 4, emp: 'e5' },
    { offset: 4, petrol: 470, diesel: 745, oil: 5, emp: ['e5', 'e6'] },
    { offset: 3, petrol: 495, diesel: 770, oil: 7, emp: 'e6' },
    { offset: 2, petrol: 460, diesel: 730, oil: 3, emp: 'e5' },
    { offset: 1, petrol: 500, diesel: 780, oil: 5, emp: 'e5' },
    { offset: 0, petrol: 475, diesel: 750, oil: 4, emp: ['e5', 'e6'] },
  ],
}

const TESTING_BY_FUEL = { petrol: 5, diesel: 5, oil: 1 }

// cashDelta = how far the "Cash" payment line drifts from the exact expected
// share — mostly small (realistic near-perfect closings), with one
// intentionally larger shortfall per pump so the reconciliation view has
// something to show.
const CASH_DELTAS = {
  pump1: [180, -420, 90, -1850, 260, -150, 340],
  pump2: [90, -60, 40, -960, -70, 200, -30],
}

function round3(n) {
  return Math.round(n * 1000) / 1000
}

// Each fuel's daily liters are split across its two physical nozzles —
// nozzle1 does the majority of the traffic, nozzle2 the rest.
const NOZZLE_SPLIT = 0.6

// Builds this pump's shift entries for one day — each one a fully
// independent record (own id, own date+pumpKey+shiftNumber) rather than a
// row nested inside a shared day/pump document. Mutates `openings`
// (per-fuel, per-nozzle running meter totals) forward so the next day's
// template starts where this one left off.
function buildPumpShiftEntries(openings, template, fuelKeys, pumpKey, date) {
  const emps = Array.isArray(template.emp) ? template.emp : [template.emp]

  function baseEntry(shiftNumber, employeeId) {
    const entry = {
      id: `f-${template.offset}-${pumpKey}-s${shiftNumber}`,
      date,
      pumpKey,
      shiftNumber,
      internalOnly: false,
      employeeId,
      bills: [],
      notes: '',
      payments: [],
      status: 'final',
    }
    // Pump 2 shifts always carry at least one (empty) Pocket/Cane oil row,
    // same as a freshly-created shift — otherwise the section would render
    // with nothing to click into until "+ Add more" was pressed first.
    if (pumpKey === 'pump2') {
      entry.oilRows = [emptyOilRow('oil')]
      entry.caneOilRows = [emptyCaneOilRow()]
      entry.caneOilOffer = ''
    }
    return entry
  }

  if (emps.length === 1) {
    const entry = baseEntry(1, emps[0])
    for (const fuelKey of fuelKeys) {
      const testing = TESTING_BY_FUEL[fuelKey]
      const n1Ltr = round3(template[fuelKey] * NOZZLE_SPLIT)
      const n2Ltr = round3(template[fuelKey] - n1Ltr)
      const nozzles = {}
      for (const [nozzleKey, ltr] of [['nozzle1', n1Ltr], ['nozzle2', n2Ltr]]) {
        const opening = round3(openings[fuelKey][nozzleKey])
        const closing = round3(opening + ltr + testing)
        nozzles[nozzleKey] = { opening, closing, testing, rate: FUEL_RATES[fuelKey] }
        openings[fuelKey][nozzleKey] = closing
      }
      entry[fuelKey] = nozzles
    }
    return [entry]
  }

  const entry1 = baseEntry(1, emps[0])
  const entry2 = baseEntry(2, emps[1])
  for (const fuelKey of fuelKeys) {
    const testing = TESTING_BY_FUEL[fuelKey]
    const n1Ltr = round3(template[fuelKey] * NOZZLE_SPLIT)
    const n2Ltr = round3(template[fuelKey] - n1Ltr)
    const s1Nozzles = {}
    const s2Nozzles = {}
    for (const [nozzleKey, ltr] of [['nozzle1', n1Ltr], ['nozzle2', n2Ltr]]) {
      const opening = round3(openings[fuelKey][nozzleKey])
      const portion1 = round3(ltr * 0.55)
      const portion2 = round3(ltr - portion1)
      const handover = round3(opening + portion1)
      const closing = round3(handover + portion2 + testing)
      s1Nozzles[nozzleKey] = { opening, closing: handover, testing: 0, rate: FUEL_RATES[fuelKey] }
      s2Nozzles[nozzleKey] = { opening: handover, closing, testing, rate: FUEL_RATES[fuelKey] }
      openings[fuelKey][nozzleKey] = closing
    }
    entry1[fuelKey] = s1Nozzles
    entry2[fuelKey] = s2Nozzles
  }
  return [entry1, entry2]
}

// Common categories first, remainder assigned to Cash — mirrors the flexible
// payment-line list the Fuel Entry page lets a manager edit freely.
function buildPaymentLines(saleAmount, cashDelta) {
  const cardPetrol = Math.round(saleAmount * 0.05)
  const cardDiesel = Math.round(saleAmount * 0.06)
  const qrPetrol = Math.round(saleAmount * 0.12)
  const qrDiesel = Math.round(saleAmount * 0.14)
  const expectedCash = saleAmount - cardPetrol - cardDiesel - qrPetrol - qrDiesel
  const cash = Math.max(0, Math.round(expectedCash + cashDelta))
  return [
    { id: 'pay1', label: 'Cash', amount: cash },
    { id: 'pay2', label: 'Card (Petrol)', amount: cardPetrol },
    { id: 'pay3', label: 'Card (Diesel)', amount: cardDiesel },
    { id: 'pay4', label: 'QR (Petrol)', amount: qrPetrol },
    { id: 'pay5', label: 'QR (Diesel)', amount: qrDiesel },
  ]
}

// Payments live per shift entry — a single-employee day gets the whole
// pump's payment lines on that one entry; a handover day splits each line
// 55/45 (mirroring the same ratio used for liters) between the two
// independent shift entries, so the demo data has something to show in
// both shifts' Payments Received / Bills sections.
function distributePaymentsAcrossEntries(entries, lines) {
  if (entries.length === 1) {
    entries[0].payments = lines.map((l) => ({ ...l }))
    return
  }
  const firstShare = lines.map((l) => ({ ...l, amount: Math.round(l.amount * 0.55) }))
  const secondShare = lines.map((l, i) => ({ ...l, id: `${l.id}b`, amount: l.amount - firstShare[i].amount }))
  entries[0].payments = firstShare
  entries[1].payments = secondShare
}

export function buildFuelEntries() {
  const openings = {
    pump1: {
      petrol: { nozzle1: 260000, nozzle2: 160000 },
      diesel: { nozzle1: 370000, nozzle2: 240000 },
    },
    pump2: {
      petrol: { nozzle1: 190000, nozzle2: 120000 },
      diesel: { nozzle1: 305000, nozzle2: 200000 },
      oil: { nozzle1: 2600, nozzle2: 1600 },
    },
  }

  const entries = []
  for (let i = 0; i < PUMP_DAY_TEMPLATES.pump1.length; i++) {
    const t1 = PUMP_DAY_TEMPLATES.pump1[i]
    const t2 = PUMP_DAY_TEMPLATES.pump2[i]
    const date = isoDaysAgo(t1.offset)

    const pump1Entries = buildPumpShiftEntries(openings.pump1, t1, ['petrol', 'diesel'], 'pump1', date)
    const pump2Entries = buildPumpShiftEntries(openings.pump2, t2, ['petrol', 'diesel', 'oil'], 'pump2', date)

    const pump1Sale = pump1Entries.reduce((sum, e) => sum + ['petrol', 'diesel'].reduce((s, k) => s + entryFuelAmount(e, k), 0), 0)
    const pump2Sale = pump2Entries.reduce((sum, e) => sum + ['petrol', 'diesel', 'oil'].reduce((s, k) => s + entryFuelAmount(e, k), 0), 0)

    distributePaymentsAcrossEntries(pump1Entries, buildPaymentLines(pump1Sale, CASH_DELTAS.pump1[i]))
    distributePaymentsAcrossEntries(pump2Entries, buildPaymentLines(pump2Sale, CASH_DELTAS.pump2[i]))

    entries.push(...pump1Entries, ...pump2Entries)
  }

  // newest first for display — a plain reverse() would also flip each day's
  // internal push order (pump2 before pump1, shift 2 before shift 1), so
  // sort by date instead; Array.sort is stable, so same-date entries keep
  // their insertion order.
  return entries.sort((a, b) => b.date.localeCompare(a.date))
}

// ---------- Lubricants ----------

// `stock` is the current on-hand quantity; `purchaseHistory` logs each
// restock from an outside supplier (qty + cost paid + date) and is what
// accumulates into `stock` over time via DataContext's addPurchase.
//
// `priceHistory`: [{ effectiveFrom: 'YYYY-MM-DD', rate }] — the entry whose
// effectiveFrom is the latest one on/before a given date is the sale rate in
// force on that date (see utils/lubricants.js). l1 carries an extra revision
// so the demo shows the "Revise Price" feature.
export const LUBRICANT_PRODUCTS = [
  {
    id: 'l1', name: 'Servo 2T Oil (1L)', unit: 'Pcs', packaging: 'packet', qtySoldToday: 6, stock: 24,
    priceHistory: [{ effectiveFrom: isoDaysAgo(60), rate: 300 }, { effectiveFrom: isoDaysAgo(20), rate: 320 }],
    purchaseHistory: [{ id: 'p1', date: isoDaysAgo(9), qty: 30, cost: 260 }],
  },
  { id: 'l2', name: 'Servo 4T Eco (1L)', unit: 'Pcs', packaging: 'packet', qtySoldToday: 8, stock: 18, priceHistory: [{ effectiveFrom: isoDaysAgo(60), rate: 380 }], purchaseHistory: [{ id: 'p1', date: isoDaysAgo(11), qty: 25, cost: 310 }] },
  { id: 'l3', name: 'Servo System 20L (Bucket)', unit: 'Pcs', packaging: 'cane', qtySoldToday: 1, stock: 4, priceHistory: [{ effectiveFrom: isoDaysAgo(60), rate: 3450 }], purchaseHistory: [{ id: 'p1', date: isoDaysAgo(14), qty: 5, cost: 2900 }] },
  { id: 'l4', name: 'Servo HS Density (1L)', unit: 'Pcs', packaging: 'packet', qtySoldToday: 3, stock: 12, priceHistory: [{ effectiveFrom: isoDaysAgo(60), rate: 410 }], purchaseHistory: [{ id: 'p1', date: isoDaysAgo(8), qty: 15, cost: 340 }] },
  { id: 'l5', name: 'Servo Prime 20W40 (1L)', unit: 'Pcs', packaging: 'packet', qtySoldToday: 5, stock: 16, priceHistory: [{ effectiveFrom: isoDaysAgo(60), rate: 360 }], purchaseHistory: [{ id: 'p1', date: isoDaysAgo(10), qty: 20, cost: 300 }] },
  { id: 'l6', name: 'Servo Diesel Additive', unit: 'Pcs', packaging: 'packet', qtySoldToday: 2, stock: 9, priceHistory: [{ effectiveFrom: isoDaysAgo(60), rate: 250 }], purchaseHistory: [{ id: 'p1', date: isoDaysAgo(7), qty: 12, cost: 205 }] },
  { id: 'l7', name: 'Coolant Top-Up (1L)', unit: 'Pcs', packaging: 'packet', qtySoldToday: 4, stock: 14, priceHistory: [{ effectiveFrom: isoDaysAgo(60), rate: 220 }], purchaseHistory: [{ id: 'p1', date: isoDaysAgo(6), qty: 18, cost: 180 }] },
  { id: 'l8', name: 'Brake Fluid DOT 3 (500ml)', unit: 'Pcs', packaging: 'packet', qtySoldToday: 2, stock: 7, priceHistory: [{ effectiveFrom: isoDaysAgo(60), rate: 180 }], purchaseHistory: [{ id: 'p1', date: isoDaysAgo(12), qty: 10, cost: 145 }] },
  { id: 'l9', name: 'Chain Lube Spray', unit: 'Pcs', packaging: 'packet', qtySoldToday: 1, stock: 6, priceHistory: [{ effectiveFrom: isoDaysAgo(60), rate: 260 }], purchaseHistory: [{ id: 'p1', date: isoDaysAgo(9), qty: 8, cost: 210 }] },
  { id: 'l10', name: 'Servo Gear Oil 90 (1L)', unit: 'Pcs', packaging: 'packet', qtySoldToday: 3, stock: 11, priceHistory: [{ effectiveFrom: isoDaysAgo(60), rate: 340 }], purchaseHistory: [{ id: 'p1', date: isoDaysAgo(13), qty: 14, cost: 285 }] },
  { id: 'l11', name: 'Air Filter (Two Wheeler)', unit: 'Pcs', packaging: 'packet', qtySoldToday: 2, stock: 10, priceHistory: [{ effectiveFrom: isoDaysAgo(60), rate: 150 }], purchaseHistory: [{ id: 'p1', date: isoDaysAgo(5), qty: 12, cost: 120 }] },
]

// ---------- Credit Customers / Ledger ----------

// type: 'credit' (fuel taken on account) or 'payment' (settlement received)
function credit(id, date, fuelType, ltr, rate) {
  return { id, date, type: 'credit', fuelType, ltr, rate, amount: Math.round(ltr * rate), mode: null }
}
function payment(id, date, amount, mode) {
  return { id, date, type: 'payment', fuelType: null, ltr: null, rate: null, amount, mode }
}

export const CREDIT_CUSTOMERS = [
  {
    id: 'c1', name: 'Murugan Transports', phone: '9894410011', openingBalance: 42500,
    notes: 'Regular fleet customer, settles monthly. Pays via cash mostly.',
    ledger: [credit('t1', isoDaysAgo(6), 'Diesel', 400, 100.45), credit('t2', isoDaysAgo(3), 'Diesel', 320, 100.45), payment('t3', isoDaysAgo(1), 20000, 'Cash')],
  },
  {
    id: 'c2', name: 'SRM Lorries', phone: '9894410012', openingBalance: 68200,
    ledger: [credit('t1', isoDaysAgo(7), 'Diesel', 600, 100.45), credit('t2', isoDaysAgo(4), 'Diesel', 500, 100.45)],
  },
  {
    id: 'c3', name: 'Nadar Higher Secondary School', phone: '9894410013', openingBalance: 8600,
    ledger: [credit('t1', isoDaysAgo(5), 'Diesel', 80, 100.45), payment('t2', isoDaysAgo(2), 8600, 'Online')],
  },
  {
    id: 'c4', name: 'Palani Bus Service', phone: '9894410014', openingBalance: 21400,
    ledger: [credit('t1', isoDaysAgo(6), 'Diesel', 250, 100.45), credit('t2', isoDaysAgo(2), 'Diesel', 210, 100.45)],
  },
  {
    id: 'c5', name: 'Vairavan Agro Traders', phone: '9894410015', openingBalance: 0,
    ledger: [credit('t1', isoDaysAgo(3), 'Diesel', 150, 100.45), payment('t2', isoDaysAgo(1), 15068, 'Cash')],
  },
  {
    id: 'c6', name: 'Kamaraj Lorry Owners', phone: '9894410016', openingBalance: 55300,
    ledger: [credit('t1', isoDaysAgo(5), 'Diesel', 450, 100.45)],
  },
  {
    id: 'c7', name: 'Puliyangudi Municipality', phone: '9894410017', openingBalance: 14200,
    ledger: [credit('t1', isoDaysAgo(4), 'Petrol', 60, 108.6), credit('t2', isoDaysAgo(1), 'Diesel', 90, 100.45)],
  },
  {
    id: 'c8', name: 'Sankaralinga Transports', phone: '9894410018', openingBalance: 31800,
    ledger: [credit('t1', isoDaysAgo(6), 'Diesel', 320, 100.45), payment('t2', isoDaysAgo(3), 10000, 'Card')],
  },
  {
    id: 'c9', name: 'Alagappa Rice Mill', phone: '9894410019', openingBalance: 0,
    ledger: [credit('t1', isoDaysAgo(2), 'Diesel', 200, 100.45)],
  },
  {
    id: 'c10', name: 'Nellai Borewell Services', phone: '9894410020', openingBalance: 9700,
    ledger: [credit('t1', isoDaysAgo(5), 'Diesel', 95, 100.45)],
  },
  {
    id: 'c11', name: 'Sri Ranga Poultry Farm', phone: '9894410021', openingBalance: 4200,
    ledger: [credit('t1', isoDaysAgo(3), 'Petrol', 20, 108.6), credit('t2', isoDaysAgo(1), 'Diesel', 20, 100.45)],
  },
  {
    id: 'c12', name: 'Meenakshi Travels', phone: '9894410022', openingBalance: 18900,
    ledger: [credit('t1', isoDaysAgo(4), 'Diesel', 180, 100.45), payment('t2', isoDaysAgo(2), 5000, 'Online')],
  },
  {
    id: 'c13', name: 'Kovilpatti Cotton Mills', phone: '9894410023', openingBalance: 76500,
    notes: 'Large account — verify against their purchase order before extending further credit.',
    ledger: [credit('t1', isoDaysAgo(7), 'Diesel', 700, 100.45), credit('t2', isoDaysAgo(3), 'Diesel', 350, 100.45)],
  },
  {
    id: 'c14', name: 'Sivan Textiles', phone: '9894410024', openingBalance: 0,
    ledger: [],
  },
  {
    id: 'c15', name: 'Amman Flour Mill', phone: '9894410025', openingBalance: 6300,
    ledger: [credit('t1', isoDaysAgo(2), 'Diesel', 60, 100.45)],
  },
  {
    id: 'c16', name: 'Tenkasi RTO Fleet', phone: '9894410026', openingBalance: 12800,
    ledger: [credit('t1', isoDaysAgo(6), 'Petrol', 90, 108.6), payment('t2', isoDaysAgo(1), 6000, 'Cash')],
  },
  {
    id: 'c17', name: 'Sengunthar Weavers Co-op', phone: '9894410027', openingBalance: 3100,
    ledger: [],
  },
]

export function closingBalance(customer) {
  return customer.ledger.reduce((bal, entry) => {
    return entry.type === 'credit' ? bal + entry.amount : bal - entry.amount
  }, customer.openingBalance)
}

// ---------- Daily Expenses ----------
// One record per day, holding however many line items were spent that day —
// the manager adds/removes items freely rather than being limited to a fixed set.
function expenseItem(id, label, amount) {
  return { id, label, amount }
}

export const EXPENSE_DAYS = [
  {
    id: 'exp1',
    date: isoDaysAgo(5),
    items: [expenseItem('i1', 'Tea & Snacks', 200), expenseItem('i2', 'Cleaning Supplies', 350)],
  },
  {
    id: 'exp2',
    date: isoDaysAgo(3),
    items: [
      expenseItem('i1', 'Tea & Snacks', 180),
      expenseItem('i2', 'Diesel for Generator', 1200),
      expenseItem('i3', 'Delivery Boy', 150),
    ],
  },
  {
    id: 'exp3',
    date: isoDaysAgo(1),
    items: [expenseItem('i1', 'Tea & Snacks', 220), expenseItem('i2', 'Stationery', 450)],
  },
]
