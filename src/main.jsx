import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { ThemeProvider } from '@mui/material/styles'
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider'
import { AdapterDayjs } from '@mui/x-date-pickers/AdapterDayjs'
import 'dayjs/locale/ta'
import App from './App.jsx'
import { DataProvider } from './context/DataContext.jsx'
import { LanguageProvider, useLanguage } from './context/LanguageContext.jsx'
import { registerPrimeReactLocale } from './i18n/primereactLocale.js'
import muiTheme from './muiTheme.js'
import 'primereact/resources/themes/lara-light-amber/theme.css'
import 'primereact/resources/primereact.min.css'
import 'primeicons/primeicons.css'
import './index.css'
import './datatable-theme.css'

registerPrimeReactLocale()

function LocalizedApp() {
  const { language } = useLanguage()
  return (
    <LocalizationProvider dateAdapter={AdapterDayjs} adapterLocale={language === 'ta' ? 'ta' : 'en'}>
      <App />
    </LocalizationProvider>
  )
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <DataProvider>
        <LanguageProvider>
          <ThemeProvider theme={muiTheme}>
            <LocalizedApp />
          </ThemeProvider>
        </LanguageProvider>
      </DataProvider>
    </BrowserRouter>
  </React.StrictMode>,
)
