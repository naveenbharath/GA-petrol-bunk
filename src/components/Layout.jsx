import { useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { LayoutDashboard, Users, CalendarCheck, Fuel, Droplet, Wallet, IndianRupee, Megaphone, Receipt, LogOut, Languages, KeyRound, ChevronLeft, ChevronRight } from 'lucide-react'
import { useData } from '../context/DataContext.jsx'
import { useLanguage } from '../context/LanguageContext.jsx'
import { LAYOUT_TEXT } from '../i18n/layout.js'
import toast from 'react-hot-toast'
import ErrorBoundary from './ErrorBoundary.jsx'
import ConfirmDialog from './ConfirmDialog.jsx'
import Modal from './Modal.jsx'
import { Field, Input, PrimaryButton, SecondaryButton } from './FormControls.jsx'
import AppTooltip from './AppTooltip.jsx'

const NAV_ITEMS = [
  { to: '/dashboard', key: 'dashboard', icon: LayoutDashboard },
  { to: '/employees', key: 'employees', icon: Users },
  { to: '/attendance', key: 'attendance', icon: CalendarCheck },
  { to: '/salary', key: 'salary', icon: IndianRupee },
  { to: '/fuel-entry', key: 'fuelEntry', icon: Fuel },
  { to: '/lubricants', key: 'lubricants', icon: Droplet },
  { to: '/credit-bills', key: 'creditBills', icon: Wallet },
  { to: '/expenses', key: 'expenses', icon: Receipt },
  { to: '/offers', key: 'offers', icon: Megaphone },
]

export default function Layout() {
  const { station, logout, changePassword } = useData()
  const { language, toggleLanguage } = useLanguage()
  const t = LAYOUT_TEXT[language]
  const navigate = useNavigate()
  const location = useLocation()
  const [logoutConfirmOpen, setLogoutConfirmOpen] = useState(false)
  const [collapsed, setCollapsed] = useState(false)
  const [passwordModalOpen, setPasswordModalOpen] = useState(false)
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [passwordErrors, setPasswordErrors] = useState({})

  // Navigating to a page (via a sidebar icon) auto-collapses the sidebar to
  // its icon-only rail, so the page gets the full width. Only reacts to an
  // actual route change, not the initial mount.
  const prevPathRef = useRef(location.pathname)
  useEffect(() => {
    if (prevPathRef.current !== location.pathname) {
      setCollapsed(true)
      prevPathRef.current = location.pathname
    }
  }, [location.pathname])

  function confirmLogout() {
    logout()
    toast.success(t.toastLoggedOut)
    navigate('/')
  }

  function openPasswordModal() {
    setNewPassword('')
    setConfirmPassword('')
    setPasswordErrors({})
    setPasswordModalOpen(true)
  }

  function submitPasswordChange(e) {
    e.preventDefault()
    const errors = {}
    if (newPassword.length < 6) errors.newPassword = t.errorPasswordTooShort
    if (confirmPassword !== newPassword) errors.confirmPassword = t.errorPasswordMismatch
    setPasswordErrors(errors)
    if (Object.keys(errors).length > 0) return
    changePassword(newPassword)
    toast.success(t.toastPasswordChanged)
    setPasswordModalOpen(false)
  }

  const currentKey = NAV_ITEMS.find((n) => location.pathname.startsWith(n.to))?.key || 'dashboard'
  const currentLabel = t.nav[currentKey]

  return (
    <div className="min-h-screen lg:flex lg:h-screen lg:overflow-hidden">
      {/* Desktop sidebar — collapsible icon rail on lg+; phones and tablets
          get the bottom tab bar below instead, so this never needs its own
          mobile/tablet layout. */}
      <aside
        className={`relative hidden shrink-0 border-r border-brand-100 bg-brand-50 shadow-card-hover transition-[width] duration-300 lg:sticky lg:top-0 lg:z-20 lg:flex lg:h-screen lg:flex-col ${
          collapsed ? 'w-[76px]' : 'w-64'
        }`}
      >
        <AppTooltip title={collapsed ? t.expandSidebar : t.collapseSidebar}>
          <button
            onClick={() => setCollapsed((c) => !c)}
            aria-label={collapsed ? t.expandSidebar : t.collapseSidebar}
            className="absolute -right-3 top-6 z-30 flex h-6 w-6 items-center justify-center rounded-full border border-brand-200 bg-white text-slate-500 shadow-sm transition-colors hover:bg-brand-50 hover:text-brand-700"
          >
            {collapsed ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
          </button>
        </AppTooltip>

        <div className={`flex items-center border-b border-brand-100 ${collapsed ? 'justify-center py-3' : 'gap-2.5 px-5 py-4'}`}>
          <div className={`flex shrink-0 items-center justify-center ${collapsed ? 'h-8 w-8' : 'h-10 w-14'}`}>
            <img src={station.logo} alt={station.name} className="h-full w-full object-contain" />
          </div>
          {collapsed ? null : (
            <div className="min-w-0">
              <p className="truncate text-sm font-bold leading-tight text-slate-900">{station.name}</p>
              <p className="text-xs font-medium text-slate-500">{station.dealerType}</p>
            </div>
          )}
        </div>

        <nav className={`flex-1 overflow-y-auto overflow-x-hidden ${collapsed ? 'space-y-2 px-4 py-3' : 'space-y-1 px-3 py-3'}`}>
          {NAV_ITEMS.map((item) => (
            <AppTooltip key={item.to} title={collapsed ? t.nav[item.key] : ''} placement="right">
              {/* MUI Tooltip clones its child to attach hover/ref handlers, which
                  can't merge with NavLink's function-style `className` prop (it
                  gets silently dropped, losing all sizing). Give it a plain
                  span to clone instead and keep NavLink untouched inside. */}
              <span className="block">
                <NavLink
                  to={item.to}
                  className={({ isActive }) =>
                    collapsed
                      ? `mx-auto flex h-10 w-10 items-center justify-center rounded-xl transition-colors ${
                          isActive ? 'bg-white text-brand-700 shadow-sm' : 'bg-white/40 text-slate-600 hover:bg-white/80 hover:text-slate-900'
                        }`
                      : `flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-colors ${
                          isActive ? 'bg-white font-bold text-brand-700 shadow-sm' : 'font-semibold text-slate-600 hover:bg-white/60 hover:text-slate-900'
                        }`
                  }
                >
                  <item.icon size={19} strokeWidth={2} />
                  {collapsed ? null : t.nav[item.key]}
                </NavLink>
              </span>
            </AppTooltip>
          ))}
        </nav>

        <div className={`border-t border-brand-100 py-3 ${collapsed ? 'space-y-2 px-4' : 'space-y-1 px-3'}`}>
          <AppTooltip title={collapsed ? t.changePassword : ''} placement="right">
            <button
              onClick={openPasswordModal}
              className={
                collapsed
                  ? 'mx-auto flex h-10 w-10 items-center justify-center rounded-xl bg-white/40 text-slate-600 transition-colors hover:bg-white/80 hover:text-slate-900 active:scale-[0.98]'
                  : 'flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-slate-600 transition-colors hover:bg-white/60 hover:text-slate-900 active:scale-[0.98]'
              }
            >
              <KeyRound size={18} />
              {collapsed ? null : t.changePassword}
            </button>
          </AppTooltip>
          <AppTooltip title={collapsed ? t.logout : ''} placement="right">
            <button
              onClick={() => setLogoutConfirmOpen(true)}
              className={
                collapsed
                  ? 'mx-auto flex h-10 w-10 items-center justify-center rounded-xl bg-white/40 text-slate-600 transition-colors hover:bg-rose-50 hover:text-rose-600 active:scale-[0.98]'
                  : 'flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-slate-600 transition-colors hover:bg-rose-50 hover:text-rose-600 active:scale-[0.98]'
              }
            >
              <LogOut size={18} />
              {collapsed ? null : t.logout}
            </button>
          </AppTooltip>
        </div>
      </aside>

      <div className="flex min-h-screen flex-1 flex-col lg:h-screen lg:min-h-0 lg:overflow-hidden">
        {/* Top bar */}
        <header className="sticky top-0 z-30 flex items-center justify-between border-b border-brand-100 bg-brand-50 px-4 py-3.5 shadow-card-hover backdrop-blur sm:px-6 lg:px-8">
          <div className="flex items-center gap-2 lg:hidden">
            <div className="flex h-8 w-12 shrink-0 items-center justify-center">
              <img src={station.logo} alt={station.name} className="h-full w-full object-contain" />
            </div>
            <span className="text-sm font-bold text-slate-900">{station.name}</span>
          </div>
          <h1 className="hidden text-base font-semibold text-slate-800 lg:block">{currentLabel}</h1>
          <div className="flex items-center gap-3">
            <button
              onClick={toggleLanguage}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-600 transition-colors hover:border-brand-200 hover:bg-brand-50 hover:text-brand-700 active:scale-95"
            >
              <Languages size={14} />
              {language === 'en' ? 'தமிழ்' : 'English'}
            </button>
            <div className="hidden text-right sm:block">
              <p className="text-xs font-semibold text-slate-900">{t.admin}</p>
              <p className="text-[11px] font-medium text-brand-900">{station.dealerName}</p>
            </div>
            <AppTooltip title={t.changePassword}>
              <button
                onClick={openPasswordModal}
                aria-label={t.changePassword}
                className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-100 text-xs font-bold text-brand-700 transition-transform hover:scale-105 active:scale-95"
              >
                AD
              </button>
            </AppTooltip>
            <AppTooltip title={t.logout}>
              <button
                onClick={() => setLogoutConfirmOpen(true)}
                className="rounded-lg p-2 text-slate-400 transition-colors hover:bg-rose-50 hover:text-rose-600 lg:hidden"
                aria-label={t.logout}
              >
                <LogOut size={18} />
              </button>
            </AppTooltip>
          </div>
        </header>

        <main className="relative flex-1 px-4 pb-24 pt-5 sm:px-6 lg:min-h-0 lg:overflow-y-auto lg:px-8 lg:pb-8">
          <AnimatePresence mode="wait">
            <motion.div
              key={language}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.22, ease: 'easeInOut' }}
            >
              <ErrorBoundary resetKey={location.pathname}>
                <Outlet />
              </ErrorBoundary>
            </motion.div>
          </AnimatePresence>
        </main>
      </div>

      {/* Mobile bottom nav */}
      <nav className="fixed inset-x-0 bottom-0 z-30 flex border-t border-slate-200 bg-white/95 backdrop-blur lg:hidden">
        {NAV_ITEMS.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) =>
              `flex flex-1 flex-col items-center gap-0.5 py-2.5 text-[11px] font-medium transition-colors ${
                isActive ? 'text-brand-600' : 'text-slate-400'
              }`
            }
          >
            {({ isActive }) => (
              <>
                <item.icon size={20} strokeWidth={isActive ? 2.4 : 2} />
                {t.navShort[item.key]}
              </>
            )}
          </NavLink>
        ))}
      </nav>

      <ConfirmDialog
        isOpen={logoutConfirmOpen}
        onClose={() => setLogoutConfirmOpen(false)}
        onConfirm={confirmLogout}
        title={t.logoutTitle}
        description={t.logoutDesc}
        confirmLabel={t.logout}
      />

      <Modal isOpen={passwordModalOpen} onClose={() => setPasswordModalOpen(false)} title={t.changePassword}>
        <form onSubmit={submitPasswordChange} className="space-y-4">
          <Field label={t.fieldNewPassword} required error={passwordErrors.newPassword}>
            <Input
              type="password"
              autoFocus
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              autoComplete="new-password"
            />
          </Field>
          <Field label={t.fieldConfirmPassword} required error={passwordErrors.confirmPassword}>
            <Input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              autoComplete="new-password"
            />
          </Field>
          <div className="flex justify-end gap-2 pt-1">
            <SecondaryButton type="button" onClick={() => setPasswordModalOpen(false)}>
              {t.cancel}
            </SecondaryButton>
            <PrimaryButton type="submit">{t.savePassword}</PrimaryButton>
          </div>
        </form>
      </Modal>
    </div>
  )
}
