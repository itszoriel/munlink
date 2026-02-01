import { useNavigate } from 'react-router-dom'
import { useEffect } from 'react'
import { FileText } from 'lucide-react'
import { motion } from 'framer-motion'
import AuditLogPage from './AuditLogPage'
import { useAdminStore } from '../lib/store'
import SuperAdminLayout from '../components/layout/SuperAdminLayout'

export default function SuperAdminAuditLog() {
  const navigate = useNavigate()
  const { user, isAuthenticated } = useAdminStore()
  const isSuperAdmin = !!user && user.role === 'superadmin'

  useEffect(() => {
    if (!isAuthenticated || !isSuperAdmin) {
      navigate('/superadmin/login', { replace: true })
      return
    }
  }, [isAuthenticated, isSuperAdmin, navigate])

  if (!isAuthenticated || !isSuperAdmin) {
    return null
  }

  return (
    <SuperAdminLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center gap-3 mb-2">
          <div className="p-2 bg-gradient-to-br from-purple-500 to-blue-600 rounded-xl shadow-lg">
            <FileText className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-2xl md:text-3xl font-serif font-bold text-gray-900">Audit Log</h1>
            <p className="text-sm text-gray-500 mt-0.5">Monitor system activity and administrator actions</p>
          </div>
        </div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className="bg-white rounded-2xl shadow-lg border border-gray-100 p-6"
        >
          <AuditLogPage />
        </motion.div>
      </div>
    </SuperAdminLayout>
  )
}
