import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { authApi } from '@/lib/api'

export default function ResetPasswordPage() {
  const [params] = useSearchParams()
  const token = (params.get('token') || '').trim()

  const [validating, setValidating] = useState(true)
  const [isValid, setIsValid] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [success, setSuccess] = useState(false)

  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)

  useEffect(() => {
    let mounted = true
    const run = async () => {
      if (!token) {
        setError('Missing reset token')
        setValidating(false)
        return
      }
      try {
        await authApi.validatePasswordReset(token)
        if (mounted) {
          setIsValid(true)
        }
      } catch (err: any) {
        const msg = err?.response?.data?.error || 'Invalid or expired reset link'
        if (mounted) {
          setError(msg)
        }
      } finally {
        if (mounted) setValidating(false)
      }
    }
    run()
    return () => {
      mounted = false
    }
  }, [token])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!token) return
    setError(null)
    if (password !== confirmPassword) {
      setError('Passwords do not match')
      return
    }
    setSubmitting(true)
    try {
      await authApi.confirmPasswordReset(token, password, confirmPassword)
      setSuccess(true)
    } catch (err: any) {
      const msg = err?.response?.data?.error || 'Failed to reset password'
      setError(msg)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-white px-6 py-12">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <img
            src="/logos/munlink-logo.png"
            alt="MunLink Logo"
            className="h-14 w-14 mx-auto mb-3 object-contain"
            onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }}
          />
          <h1 className="text-2xl font-serif font-bold text-gray-900">Set a new password</h1>
          <p className="text-sm text-gray-600 mt-1">
            Choose a strong password you have not used before.
          </p>
        </div>

        <div className="bg-white rounded-2xl shadow-xl border border-gray-100 p-8">
          {validating ? (
            <div className="text-center text-sm text-gray-600">Validating reset link...</div>
          ) : success ? (
            <div className="text-center space-y-4">
              <div className="mx-auto w-12 h-12 rounded-full bg-green-100 text-green-700 flex items-center justify-center text-sm font-semibold">
                OK
              </div>
              <p className="text-gray-700 text-sm">Your password has been updated.</p>
              <Link
                to="/login"
                className="inline-block px-4 py-2 text-sm rounded-lg bg-ocean-600 text-white hover:bg-ocean-700"
              >
                Back to login
              </Link>
            </div>
          ) : !isValid ? (
            <div className="text-center space-y-4">
              <div className="mx-auto w-12 h-12 rounded-full bg-red-100 text-red-700 flex items-center justify-center text-xl">
                !
              </div>
              <p className="text-gray-700 text-sm">
                {error || 'Invalid or expired reset link.'}
              </p>
              <Link
                to="/forgot-password"
                className="inline-block px-4 py-2 text-sm rounded-lg border border-gray-200 text-gray-700 hover:bg-gray-50"
              >
                Request a new link
              </Link>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-5">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  New password
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    className="w-full pr-12 px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-ocean-500 focus:border-transparent transition-all bg-gray-50 focus:bg-white"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    autoComplete="new-password"
                  />
                  <button
                    type="button"
                    className="absolute inset-y-0 right-0 pr-3 text-gray-400 hover:text-gray-600"
                    onClick={() => setShowPassword((v) => !v)}
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                  >
                    {showPassword ? 'Hide' : 'Show'}
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  Confirm password
                </label>
                <div className="relative">
                  <input
                    type={showConfirm ? 'text' : 'password'}
                    className="w-full pr-12 px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-ocean-500 focus:border-transparent transition-all bg-gray-50 focus:bg-white"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    required
                    autoComplete="new-password"
                  />
                  <button
                    type="button"
                    className="absolute inset-y-0 right-0 pr-3 text-gray-400 hover:text-gray-600"
                    onClick={() => setShowConfirm((v) => !v)}
                    aria-label={showConfirm ? 'Hide password' : 'Show password'}
                  >
                    {showConfirm ? 'Hide' : 'Show'}
                  </button>
                </div>
              </div>

              <p className="text-xs text-gray-500">
                Password must be at least 8 characters and include uppercase, lowercase, and a number.
              </p>

              {error && (
                <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-3 text-sm">
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={submitting}
                className="w-full py-3 px-4 bg-gradient-to-r from-ocean-500 to-ocean-700 text-white font-semibold rounded-xl hover:shadow-lg hover:scale-[1.02] transition-all disabled:opacity-60 disabled:cursor-not-allowed disabled:hover:scale-100"
              >
                {submitting ? 'Updating...' : 'Update password'}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  )
}
