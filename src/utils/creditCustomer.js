// A customer's running balance = opening balance + every credit sale (fuel
// taken on account) − every payment received. Works the same whether the
// ledger came from the real API (ui/src/lib/apiClient.js's
// normalizeCreditLedgerEntry) or straight off a CreditCustomer as loaded.
export function closingBalance(customer) {
  return (customer.ledger || []).reduce((bal, entry) => {
    return entry.type === 'credit' ? bal + entry.amount : bal - entry.amount
  }, customer.openingBalance)
}
