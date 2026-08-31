// Bridges the Attendance page's existing camelCase attendance shape to the
// real API's snake_case status values — kept entirely out of
// DataContext/Attendance.jsx's own logic so neither needed to change to pick
// up the real backend. Employee ids need no translation: `employees` in
// DataContext already comes straight from the real API (see its
// listEmployees()/apiCreateEmployee() wiring), so emp.id IS the backend UUID.
import { apiFetch } from './apiClient.js'

export const JS_TO_API_STATUS = {
  oneShift: 'one_shift',
  doubleShift: 'double_shift',
  absent: 'absent',
  leave: 'leave',
  dutyOff: 'duty_off',
}

export const API_TO_JS_STATUS = Object.fromEntries(Object.entries(JS_TO_API_STATUS).map(([k, v]) => [v, k]))

const SHIFT_STATUSES = new Set(['one_shift', 'double_shift'])

export async function fetchAttendanceMonth(employeeId, year, month) {
  const records = await apiFetch(`/attendance/${employeeId}?year=${year}&month=${month}`)
  return records.map((r) => ({
    date: r.date,
    status: API_TO_JS_STATUS[r.status] || r.status,
    // API includes seconds ("08:00:00"); the rest of the app only ever
    // works with "HH:MM".
    startTime: r.start_time ? r.start_time.slice(0, 5) : undefined,
    updatedAt: r.updated_at,
    updatedByName: r.updated_by_name || undefined,
  }))
}

// Create-or-update in one call: the caller (DataContext) doesn't reliably
// know whether a record already exists server-side (its local cache may not
// have loaded that date yet), so this tries a create first and falls back
// to an update on a 409 Conflict rather than trusting local state.
export async function upsertAttendance(employeeId, date, jsStatus, startTime) {
  const apiStatus = JS_TO_API_STATUS[jsStatus] || jsStatus
  const start_time = SHIFT_STATUSES.has(apiStatus) ? startTime || '08:00' : null

  try {
    return await apiFetch('/attendance', {
      method: 'POST',
      body: JSON.stringify({ employee_id: employeeId, date, status: apiStatus, start_time }),
    })
  } catch (err) {
    if (err.status === 409) {
      return await apiFetch(`/attendance/${employeeId}/${date}`, {
        method: 'PATCH',
        body: JSON.stringify({ status: apiStatus, start_time }),
      })
    }
    throw err
  }
}

export async function deleteAttendance(employeeId, date) {
  return apiFetch(`/attendance/${employeeId}/${date}`, { method: 'DELETE' })
}
