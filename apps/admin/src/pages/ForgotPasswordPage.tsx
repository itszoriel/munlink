import { useState } from 'react'
import { Link } from 'react-router-dom'
import { authApi, handleApiError } from '../lib/api'

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [submitted, setSubmitted] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setSubmitting(true)
    try {
      await authApi.requestPasswordReset(email)
      setSubmitted(true)
    } catch (err: any) {
      setError(handleApiError(err))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 via-white to-slate-100 px-6 py-12">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <img
            src="/logos/munlink-logo.png"
            alt="MunLink Logo"
            className="h-14 w-14 mx-auto mb-3 object-contain"
            onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }}
          />
          <h1 className="text-2xl font-serif font-bold text-gray-900">Admin password reset</h1>
          <p className="text-sm text-gray-600 mt-1">
            Enter your admin email to receive a reset link.
          </p>
        </div>

        <div className="bg-white rounded-2xl shadow-xl border border-gray-100 p-8">
          {submitted ? (
            <div className="text-center space-y-4">
              <div className="mx-auto w-12 h-12 rounded-full bg-green-100 text-green-700 flex items-center justify-center text-sm font-semibold">
                OK
              </div>
              <p className="text-gray-700 text-sm">
                If an account exists for this email, we&apos;ll send a reset link.
              </p>
              <div className="flex items-center justify-center gap-3">
                <button
                  type="button"
                  className="px-4 py-2 text-sm rounded-lg border border-gray-200 text-gray-700 hover:bg-gray-50"
                  onClick={() => setSubmitted(false)}
                >
                  Send another link
                </button>
                <Link
                  to="/"
                  className="px-4 py-2 text-sm rounded-lg bg-blue-600 text-white hover:bg-blue-700"
                >
                  Back to portal
                </Link>
              </div>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-5">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  Email
                </label>
                <input
                  type="email"
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all bg-gray-50 focus:bg-white"
                  placeholder="admin@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  autoComplete="email"
                  required
                />
              </div>

              {error && (
                <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-3 text-sm">
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={submitting}
                className="w-full py-3 px-4 bg-gradient-to-r from-blue-500 to-blue-600 text-white font-semibold rounded-xl hover:shadow-lg hover:scale-[1.02] transition-all disabled:opacity-60 disabled:cursor-not-allowed disabled:hover:scale-100"
              >
                {submitting ? 'Sending...' : 'Send reset link'}
              </button>

              <div className="text-center text-sm text-gray-600">
                Remembered your password?{' '}
                <Link to="/" className="text-blue-600 hover:text-blue-700 font-semibold hover:underline">
                  Go to portal
                </Link>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  )
}
