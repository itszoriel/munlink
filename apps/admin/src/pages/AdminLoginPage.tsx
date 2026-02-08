import { useState, useEffect } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { authApi, handleApiError } from '../lib/api'
import { useAdminStore } from '../lib/store'
import { Users, FileText, ClipboardList, BarChart3, ArrowLeft } from 'lucide-react'

export default function AdminLoginPage() {
  const [formData, setFormData] = useState({ username: '', password: '' })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showPassword, setShowPassword] = useState(false)
  const [mounted, setMounted] = useState(false)
  const navigate = useNavigate()
  const setAuth = useAdminStore((s) => s.setAuth)

  useEffect(() => {
    setMounted(true)
  }, [])

  const features = [
    { icon: Users, label: 'Manage Residents', desc: 'View and manage resident accounts' },
    { icon: FileText, label: 'Process Documents', desc: 'Handle document requests' },
    { icon: ClipboardList, label: 'Programs', desc: 'Manage benefits and programs' },
    { icon: BarChart3, label: 'Reports', desc: 'View analytics and insights' },
  ]

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setLoading(true)
    try {
      const res = await authApi.adminLogin(formData)
      const { user, access_token } = res

      const validAdminRoles = ['municipal_admin', 'barangay_admin', 'provincial_admin', 'admin']
      if (!validAdminRoles.includes(user.role)) {
        const isSuper = user.role === 'superadmin'
        setError(isSuper
          ? 'Super admin login requires 2FA. Please use the Super Admin login page.'
          : 'This account is not authorized for admin access.'
        )
        setLoading(false)
        return
      }

      setAuth(user, access_token)
      navigate('/dashboard')
    } catch (err: any) {
      setError(handleApiError(err))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 flex">
      {/* Left Panel - Background Image */}
      <div className="hidden lg:flex lg:w-1/2 xl:w-[55%] relative overflow-hidden">
        <img
          src="/assets/admin_login.jpg"
          alt="Admin Login"
          className="absolute inset-0 h-full w-full object-cover object-center"
        />
        <div className="absolute inset-0 bg-gradient-to-br from-black/30 via-black/20 to-black/30" />

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
        <div className="absolute inset-0 bg-grid-pattern opacity-[0.03]" />

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
            
            <motion.h1 
              className="text-4xl xl:text-5xl font-serif font-bold text-white leading-tight mb-6 drop-shadow-lg"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.2 }}
            >
              Administrator Portal
            </motion.h1>
            
            <motion.p 
              className="text-white/90 text-lg leading-relaxed mb-10 drop-shadow"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.3 }}
            >
              Access for Municipality Officials. Manage residents, services, documents, and community resources for your municipality.
            </motion.p>

            {/* Feature grid */}
            <motion.div 
              className="grid grid-cols-2 gap-4 max-w-md"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.4 }}
            >
              {features.map((feature, i) => (
                <motion.div
                  key={i}
                  className="bg-white/10 backdrop-blur-sm rounded-xl p-4 border border-white/10 hover:bg-white/15 transition-colors"
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ duration: 0.4, delay: 0.5 + i * 0.1 }}
                >
                  <feature.icon className="w-6 h-6 text-white/90 mb-2" />
                  <div className="text-white font-medium text-sm">{feature.label}</div>
                  <div className="text-white/70 text-xs">{feature.desc}</div>
                </motion.div>
              ))}
            </motion.div>
          </div>
        </div>
        
        {/* Bottom gradient fade */}
        <div className="absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-black/50 to-transparent" />
      </div>

      {/* Right Panel - Login Form */}
      <div className="w-full lg:w-1/2 xl:w-[45%] flex items-center justify-center bg-gradient-to-br from-slate-50 via-white to-slate-100 relative">
        
        <div className={`w-full max-w-md px-6 sm:px-8 py-12 relative z-10 transition-all duration-700 ${mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>
          {/* Mobile logo */}
          <div className="lg:hidden mb-8 flex flex-col items-center">
            <img
              src="/logos/munlink-logo.png"
              alt="MunLink Logo"
              className="h-16 w-16 object-contain mb-2"
              onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }}
            />
            <span className="text-2xl font-serif font-bold text-slate-900">MunLink</span>
          </div>
          
          <div className="bg-white rounded-2xl shadow-xl border border-gray-100 p-8">
            {/* Header */}
            <div className="text-center lg:text-left mb-8">
              <h2 className="text-2xl font-serif font-semibold text-gray-900 mb-2">
                Welcome back
              </h2>
              <p className="text-gray-500 text-sm mb-6">
                Sign in to access your admin dashboard
              </p>
            </div>

            {/* Form */}
            <form onSubmit={handleSubmit} className="space-y-5">
            {/* Error Alert */}
            {error && (
              <div className="flex items-start gap-3 p-4 rounded-xl bg-red-50 border border-red-100 animate-shake">
                <svg className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
                <span className="text-sm text-red-700">{error}</span>
              </div>
            )}

            {/* Username/Email Field */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700">
                Username or Email
              </label>
              <div className="relative group">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                  <svg className="w-5 h-5 text-slate-400 group-focus-within:text-blue-500 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
                </div>
                <input
                  type="text"
                  value={formData.username}
                  onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                  className="w-full pl-12 pr-4 py-3.5 bg-white border border-slate-200 rounded-xl text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all duration-200 shadow-sm"
                  placeholder="Enter your username or email"
                  required
                  autoComplete="username"
                />
              </div>
            </div>

            {/* Password Field */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700">
                Password
              </label>
              <div className="relative group">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                  <svg className="w-5 h-5 text-slate-400 group-focus-within:text-blue-500 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                  </svg>
                </div>
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
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

            <div className="flex items-center justify-end text-sm">
              <Link
                to="/forgot-password"
                className="text-blue-600 hover:text-blue-700 font-semibold hover:underline"
              >
                Forgot password?
              </Link>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={loading}
              className="relative w-full py-4 px-6 bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white font-semibold rounded-xl shadow-lg shadow-blue-500/25 hover:shadow-blue-500/40 transition-all duration-300 disabled:opacity-70 disabled:cursor-not-allowed overflow-hidden group"
            >
              <span className={`flex items-center justify-center gap-2 transition-all duration-300 ${loading ? 'opacity-0' : 'opacity-100'}`}>
                Sign in
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
                className="inline-flex items-center gap-2 text-sm text-gray-600 hover:text-ocean-600 transition-colors"
              >
                <ArrowLeft className="w-4 h-4" />
                <span>Back to role selection</span>
              </Link>
            </div>
          </form>
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
        .mesh-gradient {
          background: 
            radial-gradient(at 40% 20%, hsla(160, 85%, 45%, 0.3) 0px, transparent 50%),
            radial-gradient(at 80% 0%, hsla(189, 85%, 45%, 0.25) 0px, transparent 50%),
            radial-gradient(at 0% 50%, hsla(220, 85%, 45%, 0.2) 0px, transparent 50%),
            radial-gradient(at 80% 50%, hsla(340, 85%, 45%, 0.15) 0px, transparent 50%),
            radial-gradient(at 0% 100%, hsla(180, 85%, 45%, 0.2) 0px, transparent 50%),
            radial-gradient(at 80% 100%, hsla(240, 85%, 45%, 0.15) 0px, transparent 50%),
            radial-gradient(at 0% 0%, hsla(270, 85%, 45%, 0.2) 0px, transparent 50%);
        }
        
        .orb {
          position: absolute;
          border-radius: 50%;
          filter: blur(60px);
          animation: float 20s ease-in-out infinite;
        }
        
        .orb-1 {
          width: 400px;
          height: 400px;
          background: linear-gradient(135deg, rgba(16, 185, 129, 0.4), rgba(6, 182, 212, 0.3));
          top: 10%;
          left: 20%;
          animation-delay: 0s;
        }
        
        .orb-2 {
          width: 300px;
          height: 300px;
          background: linear-gradient(135deg, rgba(59, 130, 246, 0.3), rgba(139, 92, 246, 0.25));
          top: 50%;
          right: 10%;
          animation-delay: -7s;
        }
        
        .orb-3 {
          width: 350px;
          height: 350px;
          background: linear-gradient(135deg, rgba(6, 182, 212, 0.3), rgba(16, 185, 129, 0.25));
          bottom: 10%;
          left: 30%;
          animation-delay: -14s;
        }
        
        @keyframes float {
          0%, 100% {
            transform: translate(0, 0) scale(1);
          }
          25% {
            transform: translate(30px, -30px) scale(1.05);
          }
          50% {
            transform: translate(-20px, 20px) scale(0.95);
          }
          75% {
            transform: translate(-30px, -20px) scale(1.02);
          }
        }
        
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
