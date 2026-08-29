import { toISODate } from './format.js'

// Attendance day record shape: { status: 'oneShift' | 'doubleShift' | 'absent' | 'leave' | 'dutyOff' }
//
// - oneShift    -> worked a single 12hr shift (1 shift unit)
// - doubleShift -> worked both shifts back-to-back, a 24hr day (2 shift units) —
//                  choosing this for a date auto-suggests 'dutyOff' for the next day
// - absent      -> did not show up, unexcused
// - leave       -> requested leave
// - dutyOff     -> scheduled rest day (not attendance — not paid, not a leave)

export const STATUS_OPTIONS = ['oneShift', 'doubleShift', 'absent', 'leave', 'dutyOff']

export function shiftUnits(record) {
  if (record?.status === 'oneShift') return 1
  if (record?.status === 'doubleShift') return 2
  return 0
}

export function isPresentRecord(record) {
  return record?.status === 'oneShift' || record?.status === 'doubleShift'
}

export function nextDateISO(dateISO) {
  return toISODate(new Date(new Date(dateISO).getTime() + 86400000))
}
