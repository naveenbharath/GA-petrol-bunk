// What's left here are genuine local-only concepts, not demo/seed data —
// every module that used to seed its state from a mock array here now loads
// from the real API (see src/context/DataContext.jsx). See git history if
// the old seed generators (buildAttendance/buildFuelEntries/EMPLOYEES/
// LUBRICANT_PRODUCTS/CREDIT_CUSTOMERS/EXPENSE_DAYS) are ever needed again.

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

// A brand-new Fuel Entry shift card's default nozzle rate before anything's
// been typed — not itself a tracked/versioned concept server-side, since
// each reading's rate is independently editable and persisted per-shift.
export const FUEL_RATES = {
  petrol: 108.6,
  diesel: 100.45,
  oil: 220,
}

// The dealer's standard per-litre commission from the oil company — separate
// from the retail rate above, and the basis for the Dashboard/Fuel Entry
// profit summary (commission earned − expenses, for the selected month).
// Local fallback shown only until Commission Rate History's real API value
// loads (or if none has ever been set yet) — see DataContext.jsx.
export const COMMISSION_RATES = {
  petrol: 3,
  diesel: 2,
  oil: 5,
}

// mockData.js used to also export closingBalance() (a customer's opening
// balance + credits − payments), but that's pure calculation logic, not
// data — it now lives in ui/src/utils/creditCustomer.js instead.
