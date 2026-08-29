import { shiftUnits } from './attendance.js'
import { toISODate, todayISO } from './format.js'

// Salary history entry shape: { effectiveFrom: 'YYYY-MM-DD', amount: number }
// The entry with the latest effectiveFrom <= a given date is the one in force
// on that date, so a mid-month revision splits pay correctly across the change.

export function sortedSalaryHistory(employee) {
  return [...(employee.salaryHistory || [])].sort((a, b) => a.effectiveFrom.localeCompare(b.effectiveFrom))
}

export function salaryOnDate(employee, dateISO) {
  const history = sortedSalaryHistory(employee)
  let amount = 0
  for (const entry of history) {
    if (entry.effectiveFrom > dateISO) break
    amount = entry.amount
  }
  return amount
}

export function currentSalary(employee) {
  return salaryOnDate(employee, todayISO())
}

// An employee's "employee credit" entries (fuel/oil taken on credit at the
// pump, recorded via Fuel Entry — each with its own date/amount/reason) that
// fall within one calendar month, most recent first.
export function monthlyCreditEntries(employee, year, monthIdx) {
  const dates = isoDatesInMonth(year, monthIdx)
  const monthStart = dates[0]
  const monthEnd = dates[dates.length - 1]
  return [...(employee?.credits || [])]
    .filter((c) => c.date >= monthStart && c.date <= monthEnd)
    .sort((a, b) => b.date.localeCompare(a.date))
}

// Sum of the above — the amount owed back against that month's pay.
export function monthlyCreditTotal(employee, year, monthIdx) {
  return monthlyCreditEntries(employee, year, monthIdx).reduce((sum, c) => sum + (Number(c.amount) || 0), 0)
}

export function daysInMonth(year, monthIdx) {
  return new Date(year, monthIdx + 1, 0).getDate()
}

export function isoDatesInMonth(year, monthIdx) {
  const total = daysInMonth(year, monthIdx)
  const dates = []
  for (let day = 1; day <= total; day++) {
    dates.push(toISODate(new Date(year, monthIdx, day)))
  }
  return dates
}

// Pay for one calendar month, prorated by shift units completed so far against
// the days elapsed. Each day is priced at whichever salary was in force on
// that date, divided by the number of days in the month — so on day 15 of a
// 30-day month, an employee who has done all 15 shifts so far shows half the
// monthly salary; one who missed a few days shows proportionally less.
export function computeMonthlyPay(employee, attendanceForEmployee, year, monthIdx) {
  const totalDays = daysInMonth(year, monthIdx)
  const dates = isoDatesInMonth(year, monthIdx)
  const today = todayISO()
  const monthStart = dates[0]
  const monthEnd = dates[totalDays - 1]

  let elapsedDays
  if (today < monthStart) elapsedDays = 0
  else if (today > monthEnd) elapsedDays = totalDays
  else elapsedDays = Number(today.slice(-2))

  let earned = 0
  let shiftUnitsCompleted = 0
  for (let i = 0; i < elapsedDays; i++) {
    const date = dates[i]
    const units = shiftUnits(attendanceForEmployee?.[date])
    shiftUnitsCompleted += units
    earned += (salaryOnDate(employee, date) / totalDays) * units
  }

  return {
    totalDays,
    elapsedDays,
    expectedShiftUnits: elapsedDays,
    shiftUnitsCompleted,
    // Rounded to 2 decimal places (not to a whole rupee) — precise enough to
    // avoid floating-point noise while never approximating the real figure.
    earnedAmount: Math.round(earned * 100) / 100,
    fullMonthSalary: salaryOnDate(employee, monthEnd),
    isComplete: elapsedDays === totalDays,
    isMatched: elapsedDays > 0 && shiftUnitsCompleted >= elapsedDays,
  }
}
