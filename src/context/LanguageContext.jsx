import { createContext, useContext, useEffect, useMemo, useState } from 'react'
import { locale as setPrimeReactLocale } from 'primereact/api'

const LanguageContext = createContext(null)

export function LanguageProvider({ children }) {
  const [language, setLanguage] = useState('en')

  // PrimeReact's own built-in strings (column filter menu, etc.) are driven by
  // a global locale setting, not a per-component prop — keep it in sync here
  // so every DataTable instance picks up the change automatically.
  useEffect(() => {
    setPrimeReactLocale(language === 'ta' ? 'ta' : 'en')
  }, [language])

  const value = useMemo(
    () => ({
      language,
      setLanguage,
      toggleLanguage: () => setLanguage((prev) => (prev === 'en' ? 'ta' : 'en')),
    }),
    [language],
  )

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>
}

export function useLanguage() {
  const ctx = useContext(LanguageContext)
  if (!ctx) throw new Error('useLanguage must be used within LanguageProvider')
  return ctx
}
