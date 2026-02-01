import { useState, useEffect } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { superAdminApi, handleApiError } from '../lib/api'
import { useAdminStore } from '../lib/store'
import { Shield, Mail, Lock, ArrowLeft, KeyRound } from 'lucide-react'

type LoginStep = 'credentials' | '2fa'

export default function SuperAdminLoginPage() {
  const [step, setStep] = useState<LoginStep>('credentials')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [code, setCode] = useState(['', '', '', '', '', ''])
  const [sessionId, setSessionId] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [countdown, setCountdown] = useState(0)
  const [mounted, setMounted] = useState(false)

  const navigate = useNavigate()
  const setAuth = useAdminStore((s) => s.setAuth)

  useEffect(() => {
    setMounted(true)
  }, [])

  // Countdown timer for resend button
  useEffect(() => {
    if (countdown > 0) {
      const timer = setTimeout(() => setCountdown(countdown - 1), 1000)
      return () => clearTimeout(timer)
    }
  }, [countdown])

  const handleCredentialsSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setLoading(true)

    try {
      const response = await superAdminApi.login(email, password)
      setSessionId(response.session_id)
      setStep('2fa')
      setCountdown(60) // 60 seconds until can resend
    } catch (err: any) {
      setError(handleApiError(err))
    } finally {
      setLoading(false)
    }
  }

  const handleCodeChange = (index: number, value: string) => {
    // Only allow digits
    if (value && !/^\d$/.test(value)) return

    const newCode = [...code]
    newCode[index] = value
    setCode(newCode)

    // Auto-focus next input
    if (value && index < 5) {
      const nextInput = document.getElementById(`code-${index + 1}`)
      nextInput?.focus()
    }

    // Auto-submit when complete
    if (value && index === 5) {
      const fullCode = newCode.join('')
      if (fullCode.length === 6) {
        handleVerify2FA(fullCode)
      }
    }
  }

  const handleCodeKeyDown = (index: number, e: React.KeyboardEvent) => {
    if (e.key === 'Backspace' && !code[index] && index > 0) {
      const prevInput = document.getElementById(`code-${index - 1}`)
      prevInput?.focus()
    }
  }

  const handleCodePaste = (e: React.ClipboardEvent) => {
    e.preventDefault()
    const pastedData = e.clipboardData.getData('text').slice(0, 6)
    if (/^\d+$/.test(pastedData)) {
      const newCode = pastedData.split('').concat(Array(6).fill('')).slice(0, 6)
      setCode(newCode)
      if (pastedData.length === 6) {
        handleVerify2FA(pastedData)
      }
    }
  }

  const handleVerify2FA = async (fullCode?: string) => {
    const codeToVerify = fullCode || code.join('')
    if (codeToVerify.length !== 6) {
      setError('Please enter the complete 6-digit code')
      return
    }

    setError(null)
    setLoading(true)

    try {
      const response = await superAdminApi.verify2FA(sessionId, codeToVerify)
      const { user, access_token } = response

      // Verify this is actually a super admin
      if (user.role !== 'superadmin') {
        setError('This account is not authorized for super admin access.')
        setLoading(false)
        return
      }

      setAuth(user, access_token)
      navigate('/superadmin')
    } catch (err: any) {
      setError(handleApiError(err))
      // Clear code on error
      setCode(['', '', '', '', '', ''])
      document.getElementById('code-0')?.focus()
    } finally {
      setLoading(false)
    }
  }

  const handleResendCode = async () => {
    if (countdown > 0) return

    setError(null)
    setLoading(true)

    try {
      const response = await superAdminApi.resendCode(sessionId)
      setSessionId(response.session_id)
      setCountdown(60)
      setCode(['', '', '', '', '', ''])
    } catch (err: any) {
      setError(handleApiError(err))
    } finally {
      setLoading(false)
    }
  }

  const handleBack = () => {
    setStep('credentials')
    setCode(['', '', '', '', '', ''])
    setSessionId('')
    setError(null)
  }

  return (
    <div className="fixed inset-0 flex">
      {/* Left Panel - Background Image */}
      <div className="hidden lg:flex lg:w-1/2 xl:w-[55%] relative overflow-hidden">
        <img
          src="/assets/superadmin_login.jpg"
          alt="Super Admin Login"
          className="absolute inset-0 h-full w-full object-cover object-center"
        />
        <div className="absolute inset-0 bg-gradient-to-br from-purple-900/60 via-blue-900/50 to-black/60" />

        {/* Zambales Province Logo Watermark */}
        <div className="absolute inset-0 flex items-center justify-center">
          <motion.img
            src="/logos/provinces/zambales.png"
            alt="Zambales Province Seal"
            className="w-[500px] h-[500px] object-contain opacity-10"
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 0.1, scale: 1 }}
            transition={{ duration: 0.8 }}
            onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }}
          />
        </div>

        {/* Grid overlay */}
        <div className="absolute inset-0 bg-grid-pattern opacity-[0.05]" />

        {/* Content */}
        <div className="relative z-10 flex flex-col justify-center px-12 xl:px-20">
          <div className="max-w-lg">

            {/* Logo mark */}
            <motion.div
              className="mb-8"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.6, delay: 0.2 }}
            >
              <span className="text-4xl xl:text-5xl font-serif font-bold text-white tracking-tight drop-shadow-lg">MunLink</span>
            </motion.div>

            <motion.div
              className="mb-6"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.6, delay: 0.3 }}
            >
              <div className="inline-flex items-center gap-3 bg-white/10 backdrop-blur-sm rounded-2xl px-6 py-3 border border-white/20">
                <Shield className="w-8 h-8 text-white" />
                <span className="text-white font-semibold text-lg">Super Admin Portal</span>
              </div>
            </motion.div>

            <motion.h1
              className="text-4xl xl:text-5xl font-serif font-bold text-white leading-tight mb-6 drop-shadow-lg"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.4 }}
            >
              {step === 'credentials' ? 'Secure Authentication' : 'Verify Your Identity'}
            </motion.h1>

            <motion.p
              className="text-white/90 text-lg leading-relaxed mb-10 drop-shadow"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.5 }}
            >
              {step === 'credentials'
                ? 'Protected by two-factor authentication. Manage administrator accounts and oversee platform operations.'
                : `We've sent a 6-digit verification code to ${email}. Enter it below to complete your login.`
              }
            </motion.p>

            {/* Security Features */}
            <motion.div
              className="space-y-3"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.6 }}
            >
              <div className="flex items-center gap-3 text-white/80">
                <div className="w-2 h-2 bg-green-400 rounded-full"></div>
                <span className="text-sm">2-Factor Authentication Required</span>
              </div>
              <div className="flex items-center gap-3 text-white/80">
                <div className="w-2 h-2 bg-green-400 rounded-full"></div>
                <span className="text-sm">Audit Logging Enabled</span>
              </div>
              <div className="flex items-center gap-3 text-white/80">
                <div className="w-2 h-2 bg-green-400 rounded-full"></div>
                <span className="text-sm">Session Monitoring Active</span>
              </div>
            </motion.div>
          </div>
        </div>

        {/* Bottom gradient fade */}
        <div className="absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-black/50 to-transparent" />
      </div>

      {/* Right Panel - Login Form */}
      <div className="w-full lg:w-1/2 xl:w-[45%] flex items-center justify-center bg-gradient-to-br from-slate-50 via-white to-slate-100 relative">
        {/* Back button - only show on 2FA step */}
        {step === '2fa' && (
          <button
            onClick={handleBack}
            className="absolute top-8 left-8 flex items-center gap-2 text-gray-600 hover:text-gray-900 transition-colors group"
          >
            <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
            <span className="text-sm font-medium">Back to login</span>
          </button>
        )}

        <div className={`w-full max-w-md px-6 sm:px-8 py-12 relative z-10 transition-all duration-700 ${mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>
          {/* Mobile logo */}
          <div className="lg:hidden mb-8 flex flex-col items-center">
            <div className="p-3 bg-gradient-to-br from-purple-500 to-blue-600 rounded-2xl shadow-lg mb-3">
              <Shield className="h-10 w-10 text-white" />
            </div>
            <span className="text-2xl font-serif font-bold text-slate-900">Super Admin</span>
          </div>

          <div className="bg-white rounded-2xl shadow-xl border border-gray-100 p-8">
            {/* Header */}
            <div className="text-center lg:text-left mb-8">
              <h2 className="text-2xl font-serif font-semibold text-gray-900 mb-2">
                {step === 'credentials' ? 'Secure Login' : 'Enter Verification Code'}
              </h2>
              <p className="text-gray-500 text-sm">
                {step === 'credentials'
                  ? 'Sign in with your super admin credentials'
                  : 'Check your email for the 6-digit code'}
              </p>
            </div>

            {/* Error Alert */}
            {error && (
              <div className="flex items-start gap-3 p-4 rounded-xl bg-red-50 border border-red-100 mb-6 animate-shake">
                <svg className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
                <span className="text-sm text-red-700">{error}</span>
              </div>
            )}

            {step === 'credentials' ? (
              /* Credentials Form */
              <form onSubmit={handleCredentialsSubmit} className="space-y-5">
                {/* Email Field */}
                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-700">Email Address</label>
                  <div className="relative group">
                    <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                      <Mail className="w-5 h-5 text-slate-400 group-focus-within:text-blue-500 transition-colors" />
                    </div>
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="w-full pl-12 pr-4 py-3.5 bg-white border border-slate-200 rounded-xl text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all duration-200 shadow-sm"
                      placeholder="admin@example.com"
                      required
                      autoComplete="email"
                    />
                  </div>
                </div>

                {/* Password Field */}
                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-700">Password</label>
                  <div className="relative group">
                    <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                      <Lock className="w-5 h-5 text-slate-400 group-focus-within:text-blue-500 transition-colors" />
                    </div>
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="w-full pl-12 pr-12 py-3.5 bg-white border border-slate-200 rounded-xl text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all duration-200 shadow-sm"
                      placeholder="Enter your password"
                      required
                      autoComplete="current-password"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute inset-y-0 right-0 pr-4 flex items-center"
                    >
                      {showPassword ? (
                        <svg className="w-5 h-5 text-slate-400 hover:text-slate-600 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                        </svg>
                      ) : (
                        <svg className="w-5 h-5 text-slate-400 hover:text-slate-600 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                          <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                        </svg>
                      )}
                    </button>
                  </div>
                </div>

                {/* Submit Button */}
                <button
                  type="submit"
                  disabled={loading}
                  className="relative w-full py-4 px-6 bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white font-semibold rounded-xl shadow-lg shadow-blue-500/25 hover:shadow-blue-500/40 transition-all duration-300 disabled:opacity-70 disabled:cursor-not-allowed overflow-hidden group"
                >
                  <span className={`flex items-center justify-center gap-2 transition-all duration-300 ${loading ? 'opacity-0' : 'opacity-100'}`}>
                    Continue with 2FA
                    <svg className="w-5 h-5 group-hover:translate-x-1 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M14 5l7 7m0 0l-7 7m7-7H3" />
                    </svg>
                  </span>

                  {/* Loading spinner */}
                  {loading && (
                    <div className="absolute inset-0 flex items-center justify-center">
                      <svg className="w-6 h-6 animate-spin" viewBox="0 0 24 24" fill="none">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                      </svg>
                    </div>
                  )}
                </button>

                {/* Back to Role Selector */}
                <div className="mt-6 text-center">
                  <Link
                    to="/"
                    className="inline-flex items-center gap-2 text-sm text-gray-600 hover:text-purple-600 transition-colors"
                  >
                    <ArrowLeft className="w-4 h-4" />
                    <span>Back to role selection</span>
                  </Link>
                </div>
              </form>
            ) : (
              /* 2FA Verification Form */
              <div className="space-y-6">
                {/* Info box */}
                <div className="flex items-start gap-3 p-4 rounded-xl bg-blue-50 border border-blue-100">
                  <KeyRound className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
                  <div className="text-sm text-blue-700">
                    <p className="font-medium mb-1">Verification code sent</p>
                    <p className="text-blue-600">Check your email for a 6-digit code. The code will expire in 10 minutes.</p>
                  </div>
                </div>

                {/* Code Input */}
                <div className="flex justify-center gap-2" onPaste={handleCodePaste}>
                  {code.map((digit, index) => (
                    <input
                      key={index}
                      id={`code-${index}`}
                      type="text"
                      inputMode="numeric"
                      maxLength={1}
                      value={digit}
                      onChange={(e) => handleCodeChange(index, e.target.value)}
                      onKeyDown={(e) => handleCodeKeyDown(index, e)}
                      className="w-12 h-14 text-center text-2xl font-bold bg-white border-2 border-slate-200 rounded-xl text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all shadow-sm"
                      autoFocus={index === 0}
                    />
                  ))}
                </div>

                {/* Verify Button */}
                <button
                  onClick={() => handleVerify2FA()}
                  disabled={loading || code.join('').length !== 6}
                  className="relative w-full py-4 px-6 bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white font-semibold rounded-xl shadow-lg shadow-blue-500/25 hover:shadow-blue-500/40 transition-all duration-300 disabled:opacity-70 disabled:cursor-not-allowed overflow-hidden"
                >
                  {loading ? (
                    <div className="flex items-center justify-center gap-2">
                      <svg className="w-5 h-5 animate-spin" viewBox="0 0 24 24" fill="none">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                      </svg>
                      <span>Verifying...</span>
                    </div>
                  ) : (
                    <span>Verify & Sign In</span>
                  )}
                </button>

                {/* Resend Code */}
                <div className="text-center">
                  <p className="text-slate-600 text-sm">
                    Didn't receive the code?{' '}
                    {countdown > 0 ? (
                      <span className="text-slate-500 font-medium">Resend in {countdown}s</span>
                    ) : (
                      <button
                        onClick={handleResendCode}
                        disabled={loading}
                        className="text-blue-600 hover:text-blue-700 font-medium transition-colors underline decoration-blue-200 hover:decoration-blue-400"
                      >
                        Resend code
                      </button>
                    )}
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Decorative elements */}
          <div className="absolute bottom-8 left-8 right-8 flex items-center justify-between text-xs text-slate-400">
            <span>© 2026 MunLink</span>
            <span>Zambales Province</span>
          </div>
        </div>
      </div>

      {/* Custom styles */}
      <style>{`
        .bg-grid-pattern {
          background-image:
            linear-gradient(rgba(255, 255, 255, 0.05) 1px, transparent 1px),
            linear-gradient(90deg, rgba(255, 255, 255, 0.05) 1px, transparent 1px);
          background-size: 50px 50px;
        }

        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          10%, 30%, 50%, 70%, 90% { transform: translateX(-4px); }
          20%, 40%, 60%, 80% { transform: translateX(4px); }
        }

        .animate-shake {
          animation: shake 0.5s ease-in-out;
        }
      `}</style>
    </div>
  )
}
