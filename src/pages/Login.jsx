import { useEffect, useRef, useState } from 'react'
import { motion, AnimatePresence, MotionConfig } from 'framer-motion'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, CheckCircle2, Eye, EyeOff, Fuel, Lock, UserRound } from 'lucide-react'
import { useData } from '../context/DataContext.jsx'
import { ApiError } from '../lib/apiClient.js'
import AppTooltip from '../components/AppTooltip.jsx'

const RESEND_SECONDS = 30

const inputBase =
  'w-full rounded-[10px] border-[1.5px] bg-white py-3 text-sm text-slate-800 outline-none transition-all placeholder:text-slate-400'
const inputNormal = 'border-slate-200 focus:border-brand-500 focus:shadow-[0_0_0_3px_rgba(201,145,28,0.15)]'
const inputError = 'border-rose-400 focus:shadow-[0_0_0_3px_rgba(244,63,94,0.15)]'

export default function Login() {
  const { login, verifyOtp, resendOtp, station } = useData()
  const navigate = useNavigate()

  const [step, setStep] = useState('credentials') // 'credentials' | 'otp' | 'success'

  // ---------- Step 1: credentials ----------
  // `identifier` is either the account's email or its display name — the
  // API accepts both (see UserRepository.get_by_identifier).
  const [identifier, setIdentifier] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [identifierError, setIdentifierError] = useState('')
  const [passError, setPassError] = useState('')
  const [identifierShakeKey, setIdentifierShakeKey] = useState(0)
  const [passShakeKey, setPassShakeKey] = useState(0)
  const [submitting, setSubmitting] = useState(false)

  function triggerFieldError(which, message) {
    if (which === 'identifier') {
      setIdentifierError(message)
      setIdentifierShakeKey((k) => k + 1)
    } else {
      setPassError(message)
      setPassShakeKey((k) => k + 1)
    }
  }

  async function handleCredentialsSubmit(e) {
    e.preventDefault()
    if (submitting) return
    let valid = true

    if (!identifier.trim()) {
      triggerFieldError('identifier', 'Please enter your email or name.')
      valid = false
    } else {
      setIdentifierError('')
    }

    if (!password) {
      triggerFieldError('pass', 'Please enter your password.')
      valid = false
    } else {
      setPassError('')
    }

    if (!valid) return

    setSubmitting(true)
    try {
      const result = await login(identifier.trim(), password)
      if (result.skippedOtp) {
        // OTP step is temporarily disabled server-side — the session is
        // already complete, so skip straight to the success screen.
        setStep('success')
        setTimeout(() => navigate('/dashboard'), 900)
      } else {
        setOtpToken(result.otpToken)
        setSecondsLeft(Math.min(RESEND_SECONDS, result.expiresInSeconds))
        setStep('otp')
      }
    } catch (err) {
      const message = err instanceof ApiError ? err.message : 'Unable to reach the server. Please try again.'
      triggerFieldError('identifier', message)
      triggerFieldError('pass', message)
    } finally {
      setSubmitting(false)
    }
  }

  // ---------- Step 2: OTP ----------
  const [otpToken, setOtpToken] = useState(null)
  const [otp, setOtp] = useState(['', '', '', '', '', ''])
  const [otpError, setOtpError] = useState('')
  const [otpShakeKey, setOtpShakeKey] = useState(0)
  const [poppingIndex, setPoppingIndex] = useState(-1)
  const [secondsLeft, setSecondsLeft] = useState(RESEND_SECONDS)
  const [verifying, setVerifying] = useState(false)
  const [resending, setResending] = useState(false)
  const otpRefs = useRef([])

  useEffect(() => {
    if (step !== 'otp' || secondsLeft <= 0) return
    const t = setTimeout(() => setSecondsLeft((s) => s - 1), 1000)
    return () => clearTimeout(t)
  }, [step, secondsLeft])

  useEffect(() => {
    if (step === 'otp') otpRefs.current[0]?.focus()
  }, [step])

  function handleOtpChange(index, rawValue) {
    const value = rawValue.replace(/[^0-9]/g, '').slice(-1)
    setOtp((prev) => {
      const next = [...prev]
      next[index] = value
      return next
    })
    setOtpError('')
    if (value) {
      setPoppingIndex(index)
      setTimeout(() => setPoppingIndex(-1), 250)
      if (index < 5) otpRefs.current[index + 1]?.focus()
    }
  }

  function handleOtpKeyDown(index, e) {
    if (e.key === 'Backspace' && !otp[index] && index > 0) {
      otpRefs.current[index - 1]?.focus()
    }
  }

  function handleOtpPaste(e) {
    e.preventDefault()
    const text = e.clipboardData.getData('text').replace(/[^0-9]/g, '').slice(0, 6)
    if (!text) return
    const digits = text.split('')
    setOtp((prev) => {
      const next = [...prev]
      digits.forEach((d, i) => {
        next[i] = d
      })
      return next
    })
    const lastIndex = Math.min(digits.length, 6) - 1
    if (lastIndex >= 0) otpRefs.current[lastIndex]?.focus()
  }

  async function handleVerifyOtp() {
    const entered = otp.join('')
    if (entered.length < 6 || verifying) {
      if (entered.length < 6) {
        setOtpError('Enter the 6-digit code.')
        setOtpShakeKey((k) => k + 1)
      }
      return
    }

    setVerifying(true)
    try {
      await verifyOtp(otpToken, entered)
      setStep('success')
      setTimeout(() => navigate('/dashboard'), 900)
    } catch (err) {
      const message = err instanceof ApiError ? err.message : 'Unable to reach the server. Please try again.'
      setOtpError(message)
      setOtpShakeKey((k) => k + 1)
      setOtp(['', '', '', '', '', ''])
      otpRefs.current[0]?.focus()
    } finally {
      setVerifying(false)
    }
  }

  async function handleResend() {
    if (secondsLeft > 0 || resending) return
    setResending(true)
    try {
      const { otpToken: token, expiresInSeconds } = await resendOtp(otpToken)
      setOtpToken(token)
      setOtp(['', '', '', '', '', ''])
      setOtpError('')
      setSecondsLeft(Math.min(RESEND_SECONDS, expiresInSeconds))
      otpRefs.current[0]?.focus()
    } catch (err) {
      setOtpError(err instanceof ApiError ? err.message : 'Unable to reach the server. Please try again.')
    } finally {
      setResending(false)
    }
  }

  function backToCredentials() {
    setStep('credentials')
    setOtpToken(null)
    setOtp(['', '', '', '', '', ''])
    setOtpError('')
  }

  return (
    <MotionConfig reducedMotion="user">
      <div className="flex h-screen items-center justify-center overflow-hidden bg-brand-50 px-4 py-4">
        <div className="relative w-full max-w-[420px]">
          <div className="relative overflow-hidden rounded-2xl p-[2.5px] shadow-[0_20px_45px_-12px_rgba(0,0,0,0.2)]">
            <motion.div
              className="absolute inset-[-150%]"
              style={{
                background:
                  step === 'success'
                    ? 'conic-gradient(from 0deg, transparent 0deg, transparent 260deg, #43A047 300deg, #7be3a0 320deg, #43A047 340deg, transparent 360deg)'
                    : 'conic-gradient(from 0deg, transparent 0deg, transparent 260deg, #c46f36 300deg, #f1c5a0 320deg, #c46f36 340deg, transparent 360deg)',
              }}
              animate={{ rotate: 360 }}
              transition={{ duration: 3.5, repeat: Infinity, ease: 'linear' }}
            />

            <motion.div
              initial={{ opacity: 0, y: 20, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{ duration: 0.45, ease: 'easeOut' }}
              className="relative overflow-hidden rounded-[14px] bg-white px-8 py-9"
            >
            <div className="mb-7 flex flex-col items-center text-center">
              <div className="mb-3.5 flex h-14 w-14 items-center justify-center rounded-full bg-slate-950">
                <Fuel size={24} className="text-brand-400" />
              </div>
              <h1 className="font-cinzel bg-gradient-to-r from-slate-900 to-brand-600 bg-clip-text text-lg font-bold uppercase tracking-[2px] text-transparent">
                {station.name}
              </h1>
              <p className="mt-1.5 text-xs text-slate-500">
                {station.dealerType} &middot; SAP No: {station.sapNo}
              </p>
            </div>

            <AnimatePresence mode="wait">
              {step === 'credentials' && (
                <motion.form
                  key="credentials"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  transition={{ duration: 0.35 }}
                  onSubmit={handleCredentialsSubmit}
                >
                  <div className="mb-[18px]">
                    <label className="mb-[7px] block text-[12.5px] font-semibold text-slate-600">Email or Name</label>
                    <motion.div key={identifierShakeKey} animate={identifierError ? { x: [0, -8, 8, -5, 5, 0] } : {}} transition={{ duration: 0.45 }}>
                      <div className="relative flex items-center">
                        <UserRound size={17} className="pointer-events-none absolute left-[13px] text-slate-400" />
                        <input
                          type="text"
                          value={identifier}
                          onChange={(e) => {
                            setIdentifier(e.target.value)
                            setIdentifierError('')
                          }}
                          placeholder="you@example.com or your name"
                          autoComplete="username"
                          className={`${inputBase} pl-10 pr-3.5 ${identifierError ? inputError : inputNormal}`}
                        />
                      </div>
                    </motion.div>
                    {identifierError ? <p className="mt-1.5 text-xs text-rose-500">{identifierError}</p> : null}
                  </div>

                  <div className="mb-[18px]">
                    <label className="mb-[7px] block text-[12.5px] font-semibold text-slate-600">Password</label>
                    <motion.div key={passShakeKey} animate={passError ? { x: [0, -8, 8, -5, 5, 0] } : {}} transition={{ duration: 0.45 }}>
                      <div className="relative flex items-center">
                        <Lock size={17} className="pointer-events-none absolute left-[13px] text-slate-400" />
                        <input
                          type={showPassword ? 'text' : 'password'}
                          value={password}
                          onChange={(e) => {
                            setPassword(e.target.value)
                            setPassError('')
                          }}
                          placeholder="••••••••"
                          autoComplete="current-password"
                          className={`${inputBase} pl-10 pr-11 ${passError ? inputError : inputNormal}`}
                        />
                        <AppTooltip title={showPassword ? 'Hide password' : 'Show password'}>
                          <button
                            type="button"
                            onClick={() => setShowPassword((v) => !v)}
                            aria-label={showPassword ? 'Hide password' : 'Show password'}
                            className="absolute right-3 flex text-slate-400 transition-all hover:scale-110 hover:text-brand-600"
                          >
                            {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                          </button>
                        </AppTooltip>
                      </div>
                    </motion.div>
                    {passError ? <p className="mt-1.5 text-xs text-rose-500">{passError}</p> : null}
                  </div>

                  <div className="mb-[22px] flex justify-end">
                    <a href="#" className="text-[13px] font-medium text-brand-700 hover:underline">
                      Forgot password?
                    </a>
                  </div>

                  <GoldButton type="submit" disabled={submitting}>
                    {submitting ? 'Sending code…' : 'Sign In'}
                  </GoldButton>
                </motion.form>
              )}

              {step === 'otp' && (
                <motion.div
                  key="otp"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  transition={{ duration: 0.35 }}
                >
                  <button
                    type="button"
                    onClick={backToCredentials}
                    className="mb-[18px] inline-flex items-center gap-1 text-[13px] text-slate-500 transition-colors hover:text-brand-700"
                  >
                    <ArrowLeft size={15} /> Back
                  </button>

                  <h2 className="mb-2 text-lg font-bold text-slate-900">Verify Your Identity</h2>
                  <p className="mb-[22px] text-[13px] leading-relaxed text-slate-500">
                    Enter the 6-digit code sent to your registered phone
                  </p>

                  <motion.div
                    key={otpShakeKey}
                    animate={otpError ? { x: [0, -8, 8, -5, 5, 0] } : {}}
                    transition={{ duration: 0.45 }}
                    className="mb-2 flex justify-center gap-2"
                  >
                    {otp.map((digit, i) => (
                      <input
                        key={i}
                        ref={(el) => (otpRefs.current[i] = el)}
                        type="text"
                        inputMode="numeric"
                        maxLength={1}
                        value={digit}
                        onChange={(e) => handleOtpChange(i, e.target.value)}
                        onKeyDown={(e) => handleOtpKeyDown(i, e)}
                        onPaste={handleOtpPaste}
                        disabled={verifying}
                        className={`h-14 w-12 rounded-[10px] border-[1.5px] bg-white text-center text-xl font-bold text-slate-800 outline-none transition-transform disabled:opacity-60 ${
                          otpError ? inputError : inputNormal
                        } ${poppingIndex === i ? 'animate-pop' : ''}`}
                      />
                    ))}
                  </motion.div>
                  {otpError ? <p className="mb-[18px] text-center text-[12.5px] text-rose-500">{otpError}</p> : <div className="mb-[18px]" />}

                  <div className="mb-[22px] text-center text-[13px]">
                    {secondsLeft > 0 ? (
                      <span className="text-slate-400">Resend in {secondsLeft}s</span>
                    ) : (
                      <button type="button" onClick={handleResend} disabled={resending} className="font-semibold text-brand-700 hover:underline disabled:opacity-60">
                        {resending ? 'Resending…' : 'Resend OTP'}
                      </button>
                    )}
                  </div>

                  <GoldButton type="button" onClick={handleVerifyOtp} disabled={verifying}>
                    {verifying ? 'Verifying…' : 'Verify OTP'}
                  </GoldButton>
                </motion.div>
              )}

              {step === 'success' && (
                <motion.div
                  key="success"
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.4 }}
                  className="flex flex-col items-center py-1 text-center"
                >
                  <div className="mb-[18px] flex h-16 w-16 items-center justify-center rounded-full border border-emerald-300 bg-emerald-50">
                    <CheckCircle2 size={30} className="text-emerald-600" />
                  </div>
                  <h3 className="font-cinzel mb-2 bg-gradient-to-r from-slate-900 to-brand-600 bg-clip-text text-[19px] tracking-wide text-transparent">
                    Login Successful!
                  </h3>
                  <p className="text-[13.5px] text-slate-500">Redirecting to your dashboard&hellip;</p>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
          </div>
        </div>
      </div>
    </MotionConfig>
  )
}

function GoldButton({ children, className = '', ...props }) {
  return (
    <button
      className={`group relative w-full overflow-hidden rounded-[10px] bg-gradient-to-r from-brand-500 to-brand-700 py-[13px] text-[15px] font-bold text-white shadow-md shadow-brand-600/30 transition-all hover:-translate-y-0.5 hover:from-brand-600 hover:to-brand-800 hover:shadow-lg active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-60 ${className}`}
      {...props}
    >
      <span className="pointer-events-none absolute inset-y-0 -left-3/4 w-1/2 -skew-x-[20deg] bg-gradient-to-r from-transparent via-white/30 to-transparent transition-all duration-500 group-hover:left-full" />
      {children}
    </button>
  )
}
