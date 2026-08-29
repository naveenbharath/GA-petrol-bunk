import { useEffect, useState } from 'react'

// Plain native time input. Kept deliberately simple (an earlier MUI sectioned
// TimePicker version proved fragile to resize and broke click-to-edit once
// shrunk). Its value is already plain "HH:MM" (24hr), matching what we store.
//
// The input keeps its own local draft value instead of being fully
// controlled by `value` on every keystroke — while the browser reports an
// intermediate/incomplete time (e.g. hour picked but not minute yet), it
// reports an empty string, and re-rendering with the last *complete* value
// would snap the field back mid-edit and swallow further input. Local draft
// state avoids that: only a complete value is ever propagated upward.
export default function AppTimePicker({ value, onChange, className = '', disabled }) {
  const [draft, setDraft] = useState(value || '')

  useEffect(() => {
    setDraft(value || '')
  }, [value])

  function handleChange(e) {
    const next = e.target.value
    setDraft(next)
    if (next) {
      onChange(next)
    }
  }

  return (
    <input
      type="time"
      value={draft}
      onChange={handleChange}
      disabled={disabled}
      className={`rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-sm text-slate-800 outline-none transition-colors focus:border-brand-500 focus:ring-2 focus:ring-brand-100 ${className}`}
    />
  )
}
