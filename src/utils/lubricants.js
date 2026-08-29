import { todayISO } from './format.js'

// priceHistory: [{ effectiveFrom: 'YYYY-MM-DD', rate }] — the entry whose
// effectiveFrom is the latest one on/before a given date is the rate in
// force on that date. Mirrors how employee salaries are tracked (see
// utils/salary.js) so the same product can sell at a different price on
// different days without losing what it used to cost.

export function sortedPriceHistory(product) {
  return [...(product?.priceHistory || [])].sort((a, b) => a.effectiveFrom.localeCompare(b.effectiveFrom))
}

export function rateOnDate(product, dateISO) {
  const history = sortedPriceHistory(product)
  let rate = 0
  for (const entry of history) {
    if (entry.effectiveFrom > dateISO) break
    rate = entry.rate
  }
  return rate
}

export function currentRate(product) {
  return rateOnDate(product, todayISO())
}

// Groups a product's purchase history by cost paid per unit, summing the
// quantity bought at each distinct cost — e.g. "20 units @ ₹260, 10 @ ₹280".
// Highest cost first, since that's usually the most recent restock.
export function purchaseBatchesByCost(product) {
  const totals = new Map()
  for (const entry of product?.purchaseHistory || []) {
    const cost = Number(entry.cost) || 0
    totals.set(cost, (totals.get(cost) || 0) + (Number(entry.qty) || 0))
  }
  return [...totals.entries()]
    .map(([cost, qty]) => ({ cost, qty }))
    .sort((a, b) => b.cost - a.cost)
}

// How much stock is available AT a specific sale rate — restocks purchased
// while that rate was in force (i.e. purchased on/after the date that rate
// took effect, and before the next rate change), capped at whatever is
// still on hand overall. There's no per-batch stock ledger, so this is an
// approximation from price/purchase dates rather than tracked lots — but it
// lets the manager tell "old-priced stock" apart from "new-priced stock".
export function stockAvailableAtRate(product, rate) {
  const history = sortedPriceHistory(product)
  const targetRate = Number(rate)
  const idx = history.findIndex((h) => h.rate === targetRate)
  if (idx === -1) return 0

  // Only one price has ever been set — there's no other period stock could
  // belong to, so all of it is available at this (only) rate. This also
  // covers a product's opening stock, entered before any purchase was ever
  // logged against it, so it isn't undercounted as "0 available" here while
  // Lubricants shows the real stock figure.
  if (history.length === 1) return Math.max(0, Number(product?.stock) || 0)

  const periodStart = history[idx].effectiveFrom
  const next = history.slice(idx + 1).find((h) => h.effectiveFrom !== periodStart)
  const periodEnd = next ? next.effectiveFrom : null // null = this rate is still current

  const purchasedInPeriod = (product?.purchaseHistory || [])
    .filter((p) => p.date >= periodStart && (periodEnd == null || p.date < periodEnd))
    .reduce((sum, p) => sum + (Number(p.qty) || 0), 0)

  return Math.max(0, Math.min(purchasedInPeriod, Number(product?.stock) || 0))
}
