import { useCallback, useEffect, useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { Users, Plus, X, Filter, Mail, UserCog, MapPin, Calendar } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { getProvinces, getMunicipalities, getBarangaysByMunicipalitySlug } from '@/lib/locations'
import { superAdminApi } from '../lib/api'
import type { AuditLogPagination } from '../lib/api'
import apiClient from '../lib/api'
import { useAdminStore } from '../lib/store'
import SuperAdminLayout from '../components/layout/SuperAdminLayout'

type AdminRole = 'provincial_admin' | 'municipal_admin' | 'barangay_admin'

interface Admin {
  id: number
  username: string
  email: string
  first_name: string
  middle_name?: string
  last_name: string
  role: string
  admin_municipality_id?: number
  admin_barangay_id?: number
  municipality_name?: string
  barangay_name?: string
  created_at: string
}

// Helper function to get assignment display based on role
const getAssignmentDisplay = (admin: Admin): string => {
  switch (admin.role) {
    case 'superadmin':
      return 'System Administrator'
    case 'provincial_admin':
      return 'Zambales'
    case 'municipal_admin':
      return admin.municipality_name || '—'
    case 'barangay_admin':
      if (admin.municipality_name && admin.barangay_name) {
        return `${admin.municipality_name} • Brgy. ${admin.barangay_name}`
      }
      return admin.municipality_name || '—'
    default:
      return '—'
  }
}

// Helper function to format role display
const formatRoleDisplay = (role: string): string => {
  switch (role) {
    case 'superadmin':
      return 'Super Admin'
    case 'provincial_admin':
      return 'Provincial Admin'
    case 'municipal_admin':
      return 'Municipal Admin'
    case 'barangay_admin':
      return 'Barangay Admin'
    default:
      return role
  }
}

export default function SuperAdminPanel() {
  const navigate = useNavigate()
  const { user, isAuthenticated } = useAdminStore()
  const isSuperAdmin = !!user && user.role === 'superadmin'

  const [admins, setAdmins] = useState<Admin[]>([])
  const [loadingAdmins, setLoadingAdmins] = useState(false)
  const [listError, setListError] = useState<string | null>(null)
  const [pagination, setPagination] = useState<AuditLogPagination | null>(null)
  const [page, setPage] = useState(1)
  const perPage = 10

  const [showCreateForm, setShowCreateForm] = useState(false)
  const [formData, setFormData] = useState({
    username: '',
    email: '',
    mobile_number: '',
    password: '',
    confirm_password: '',
    first_name: '',
    middle_name: '',
    last_name: '',
    admin_role: 'municipal_admin' as AdminRole,
    admin_province_id: '',
    admin_municipality_slug: '',
    admin_barangay_id: '',
    admin_secret: '',
  })
  const [uploads, setUploads] = useState<{ profile_picture?: File | null; valid_id_front?: File | null; valid_id_back?: File | null }>({})
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [createLoading, setCreateLoading] = useState(false)
  const [createError, setCreateError] = useState<string | null>(null)
  const [createSuccess, setCreateSuccess] = useState<string | null>(null)
  const [filterProvinceId, setFilterProvinceId] = useState<string>('')
  const [filterMunicipalitySlug, setFilterMunicipalitySlug] = useState<string>('')
  const [filterBarangayId, setFilterBarangayId] = useState<string>('')
  const [filterRole, setFilterRole] = useState<string>('')
  const [fabExpanded, setFabExpanded] = useState(false)

  const provinces = getProvinces()
  const municipalities = formData.admin_province_id ? getMunicipalities(Number(formData.admin_province_id)) : []
  const barangays = formData.admin_municipality_slug ? getBarangaysByMunicipalitySlug(formData.admin_municipality_slug) : []

  // Filter dropdowns
  const filterMunicipalities = filterProvinceId ? getMunicipalities(Number(filterProvinceId)) : []
  const filterBarangays = filterMunicipalitySlug ? getBarangaysByMunicipalitySlug(filterMunicipalitySlug) : []

  // Filter admins by role, province, municipality, and barangay
  const filteredAdmins = useMemo(() => {
    let result = admins

    // Filter by role
    if (filterRole) {
      result = result.filter(admin => admin.role === filterRole)
    }

    // Filter by province
    if (filterProvinceId) {
      const provinceMunicipalities = getMunicipalities(Number(filterProvinceId))
      const municipalityNames = new Set(provinceMunicipalities.map(m => m.name))
      result = result.filter(admin =>
        !admin.municipality_name || municipalityNames.has(admin.municipality_name)
      )
    }

    // Filter by municipality
    if (filterMunicipalitySlug) {
      const selectedMunicipality = filterMunicipalities.find(m => m.slug === filterMunicipalitySlug)
      if (selectedMunicipality) {
        result = result.filter(admin => admin.municipality_name === selectedMunicipality.name)
      }
    }

    // Filter by barangay
    if (filterBarangayId) {
      const selectedBarangay = filterBarangays.find(b => b.id === Number(filterBarangayId))
      if (selectedBarangay) {
        result = result.filter(admin => admin.barangay_name === selectedBarangay.name)
      }
    }

    return result
  }, [admins, filterRole, filterProvinceId, filterMunicipalitySlug, filterBarangayId, filterMunicipalities, filterBarangays])
  const totalAdmins = pagination?.total ?? admins.length
  const pageSize = pagination?.per_page ?? perPage
  const currentPage = pagination?.page ?? page
  const startIndex = totalAdmins === 0 ? 0 : (currentPage - 1) * pageSize + 1
  const endIndex = totalAdmins === 0 ? 0 : startIndex + filteredAdmins.length - 1
  const showingLabel = totalAdmins === 0
    ? 'No admins'
    : filteredAdmins.length === 0
      ? `No results on page ${currentPage}`
      : `Showing ${startIndex}-${endIndex} of ${totalAdmins}`
  const canPrevPage = currentPage > 1 && (pagination?.has_prev ?? true)
  const canNextPage = pagination ? Boolean(pagination.has_next) : filteredAdmins.length >= pageSize
  const handlePrevPage = () => {
    if (!canPrevPage || loadingAdmins) return
    setPage((p) => {
      if (pagination?.prev_page) return Math.max(1, pagination.prev_page)
      return Math.max(1, p - 1)
    })
  }
  const handleNextPage = () => {
    if (!canNextPage || loadingAdmins) return
    const maxPage = pagination?.pages || currentPage + 1
    setPage((p) => {
      if (pagination?.next_page) return Math.min(maxPage, pagination.next_page)
      return Math.min(maxPage, p + 1)
    })
  }

  const fetchAdmins = useCallback(async (pageToLoad: number = 1) => {
    if (!isAuthenticated || !isSuperAdmin) return
    setLoadingAdmins(true)
    setListError(null)
    try {
      const res = await superAdminApi.getAdmins({ page: pageToLoad, per_page: perPage })
      setAdmins(res.admins || [])
      setPagination(res.pagination || null)
      if (res.pagination?.page && res.pagination.page !== page) {
        setPage(res.pagination.page)
      } else if (!res.pagination?.page) {
        setPage(pageToLoad)
      }
    } catch (err: any) {
      setListError(err?.response?.data?.error || 'Failed to fetch admins')
      if (err?.response?.status === 401 || err?.response?.status === 403) {
        navigate('/superadmin/login', { replace: true })
      }
    } finally {
      setLoadingAdmins(false)
    }
  }, [isAuthenticated, isSuperAdmin, navigate, page, perPage])

  useEffect(() => {
    if (!isAuthenticated || !isSuperAdmin) {
      navigate('/superadmin/login', { replace: true })
      return
    }
    fetchAdmins(page)
  }, [isAuthenticated, isSuperAdmin, navigate, fetchAdmins, page])

  const handleCreateAdmin = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setCreateError(null)
    setCreateSuccess(null)
    setCreateLoading(true)

    try {
      if (formData.password !== formData.confirm_password) {
        setCreateError('Password confirmation does not match')
        setCreateLoading(false)
        return
      }
      if (!formData.admin_secret) {
        setCreateError('Admin secret key is required')
        setCreateLoading(false)
        return
      }

      const formDataObj = new FormData()
      Object.entries(formData).forEach(([key, value]) => {
        if (value && key !== 'confirm_password') {
          formDataObj.append(key, String(value))
        }
      })

      if (uploads.profile_picture) formDataObj.append('profile_picture', uploads.profile_picture)
      if (uploads.valid_id_front) formDataObj.append('valid_id_front', uploads.valid_id_front)
      if (uploads.valid_id_back) formDataObj.append('valid_id_back', uploads.valid_id_back)

      await apiClient.post('/api/auth/admin/register', formDataObj, {
        headers: { 'Content-Type': 'multipart/form-data' }
      })

      setCreateSuccess('Admin account created successfully')
      setShowCreateForm(false)
      setFormData({
        username: '',
        email: '',
        mobile_number: '',
        password: '',
        confirm_password: '',
        first_name: '',
        middle_name: '',
        last_name: '',
        admin_role: 'municipal_admin',
        admin_province_id: '',
        admin_municipality_slug: '',
        admin_barangay_id: '',
        admin_secret: '',
      })
      setUploads({})
      setPreviewUrl(null)
      setPage(1)
      fetchAdmins(1)
    } catch (err: any) {
      const errorMsg = err?.response?.data?.error || 'Failed to create admin'
      const errorDetails = err?.response?.data?.details
      setCreateError(errorDetails ? `${errorMsg}: ${errorDetails}` : errorMsg)
    } finally {
      setCreateLoading(false)
    }
  }

  if (!isAuthenticated || !isSuperAdmin) {
    return null
  }

  return (
    <SuperAdminLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 bg-gradient-to-br from-purple-500 to-blue-600 rounded-xl shadow-lg">
                <Users className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-2xl md:text-3xl font-serif font-bold text-gray-900">Admin Management</h1>
                <p className="text-sm text-gray-500 mt-0.5">Create and manage administrator accounts</p>
              </div>
            </div>
          </div>
          <button
            onClick={() => setShowCreateForm(true)}
            className="hidden sm:flex items-center justify-center gap-2 px-6 py-3 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white font-medium rounded-xl shadow-lg shadow-blue-500/25 hover:shadow-blue-500/40 transition-all duration-300"
          >
            <Plus className="w-5 h-5" />
            Create Admin
          </button>
        </div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
        >
            {createSuccess && (
              <div className="rounded-xl border border-green-200 bg-green-50 text-green-700 px-4 py-3 text-sm flex items-center gap-3">
                <svg className="w-5 h-5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                {createSuccess}
              </div>
            )}

            {listError && (
              <div className="rounded-xl border border-red-200 bg-red-50 text-red-700 px-4 py-3 text-sm flex items-center gap-3">
                <svg className="w-5 h-5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
                {listError}
              </div>
            )}

            <div className="bg-white rounded-2xl shadow-lg border border-gray-100 overflow-hidden">
              <div className="p-4 md:p-6 border-b border-gray-100 bg-gradient-to-br from-gray-50 to-white">
                <div className="flex flex-col gap-4">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <Users className="w-5 h-5 text-blue-600" />
                      <h2 className="text-lg font-semibold text-gray-900">Admin Accounts</h2>
                    </div>
                    <span className="text-sm font-medium text-gray-600 bg-gray-100 px-3 py-1 rounded-full w-fit">
                      {showingLabel}
                    </span>
                  </div>

                  <div className="flex flex-col sm:flex-row sm:flex-wrap items-start sm:items-center gap-3">
                    <div className="flex items-center gap-2 text-gray-600">
                      <Filter className="w-4 h-4" />
                      <span className="text-sm font-medium">Filters:</span>
                    </div>

                    <select
                      value={filterRole}
                      onChange={(e) => {
                        setFilterRole(e.target.value)
                        // Clear location filters if SuperAdmin is selected
                        if (e.target.value === 'superadmin') {
                          setFilterProvinceId('')
                          setFilterMunicipalitySlug('')
                          setFilterBarangayId('')
                        }
                      }}
                      className="w-full sm:w-auto text-sm border border-gray-200 rounded-lg px-3 py-2 bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                    >
                      <option value="">All Admin Types</option>
                      <option value="superadmin">Super Admin</option>
                      <option value="provincial_admin">Provincial Admin</option>
                      <option value="municipal_admin">Municipal Admin</option>
                      <option value="barangay_admin">Barangay Admin</option>
                    </select>

                    <select
                      value={filterProvinceId}
                      onChange={(e) => {
                        setFilterProvinceId(e.target.value)
                        setFilterMunicipalitySlug('')
                        setFilterBarangayId('')
                      }}
                      disabled={filterRole === 'superadmin'}
                      className="w-full sm:w-auto text-sm border border-gray-200 rounded-lg px-3 py-2 bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all disabled:bg-gray-50 disabled:cursor-not-allowed disabled:text-gray-400"
                    >
                      <option value="">All Provinces</option>
                      {provinces.map(p => (
                        <option key={p.id} value={p.id}>{p.name}</option>
                      ))}
                    </select>

                    <select
                      value={filterMunicipalitySlug}
                      onChange={(e) => {
                        setFilterMunicipalitySlug(e.target.value)
                        setFilterBarangayId('')
                      }}
                      disabled={!filterProvinceId || filterRole === 'superadmin' || filterRole === 'provincial_admin'}
                      className="w-full sm:w-auto text-sm border border-gray-200 rounded-lg px-3 py-2 bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all disabled:bg-gray-50 disabled:cursor-not-allowed disabled:text-gray-400"
                    >
                      <option value="">All Municipalities</option>
                      {filterMunicipalities.map(m => (
                        <option key={m.slug} value={m.slug}>{m.name}</option>
                      ))}
                    </select>

                    <select
                      value={filterBarangayId}
                      onChange={(e) => setFilterBarangayId(e.target.value)}
                      disabled={!filterMunicipalitySlug || filterRole === 'superadmin' || filterRole === 'provincial_admin' || filterRole === 'municipal_admin'}
                      className="w-full sm:w-auto text-sm border border-gray-200 rounded-lg px-3 py-2 bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all disabled:bg-gray-50 disabled:cursor-not-allowed disabled:text-gray-400"
                    >
                      <option value="">All Barangays</option>
                      {filterBarangays.map(b => (
                        <option key={b.id} value={b.id}>{b.name}</option>
                      ))}
                    </select>

                    {(filterRole || filterProvinceId || filterMunicipalitySlug || filterBarangayId) && (
                      <button
                        onClick={() => {
                          setFilterRole('')
                          setFilterProvinceId('')
                          setFilterMunicipalitySlug('')
                          setFilterBarangayId('')
                        }}
                        className="text-sm text-blue-600 hover:text-blue-700 font-medium px-3 py-2 hover:bg-blue-50 rounded-lg transition-all"
                      >
                        Clear filters
                      </button>
                    )}
                  </div>
                </div>
              </div>

              {loadingAdmins ? (
                <div className="p-12 text-center">
                  <div className="inline-block w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mb-3"></div>
                  <p className="text-gray-500 text-sm">Loading admin accounts...</p>
                </div>
              ) : filteredAdmins.length === 0 ? (
                <div className="p-12 text-center">
                  <Users className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                  <p className="text-gray-500">
                    {(filterProvinceId || filterMunicipalitySlug || filterBarangayId) ? 'No admins found matching the selected filters' : 'No admin accounts yet'}
                  </p>
                </div>
              ) : (
                <>
                  {/* Desktop Table */}
                  <div className="hidden md:block overflow-x-auto">
                    <table className="w-full table-fixed">
                      <thead className="bg-gray-50 border-b border-gray-100">
                        <tr>
                          <th className="w-[18%] px-4 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Name</th>
                          <th className="w-[14%] px-4 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Username</th>
                          <th className="w-[22%] px-4 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Email</th>
                          <th className="w-[14%] px-4 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Role</th>
                          <th className="w-[18%] px-4 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Assignment</th>
                          <th className="w-[14%] px-4 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Created</th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-100">
                        {filteredAdmins.map((admin) => (
                          <tr key={admin.id} className="hover:bg-blue-50/50 transition-colors">
                            <td className="px-4 py-4 text-sm font-medium text-gray-900">
                              <div className="truncate" title={`${admin.first_name} ${admin.middle_name ? admin.middle_name + ' ' : ''}${admin.last_name}`}>
                                {admin.first_name} {admin.middle_name ? admin.middle_name + ' ' : ''}{admin.last_name}
                              </div>
                            </td>
                            <td className="px-4 py-4 text-sm text-gray-600">
                              <div className="flex items-center gap-2">
                                <UserCog className="w-4 h-4 text-gray-400" />
                                <div className="truncate" title={admin.username}>{admin.username}</div>
                              </div>
                            </td>
                            <td className="px-4 py-4 text-sm text-gray-600">
                              <div className="flex items-center gap-2">
                                <Mail className="w-4 h-4 text-gray-400" />
                                <div className="truncate" title={admin.email}>{admin.email}</div>
                              </div>
                            </td>
                            <td className="px-4 py-4">
                              <span className={`inline-flex items-center px-2.5 py-1 text-xs font-medium rounded-full whitespace-nowrap ${
                                admin.role === 'superadmin'
                                  ? 'bg-purple-100 text-purple-700 ring-1 ring-purple-600/20'
                                  : admin.role === 'provincial_admin'
                                  ? 'bg-indigo-100 text-indigo-700 ring-1 ring-indigo-600/20'
                                  : admin.role === 'municipal_admin'
                                  ? 'bg-blue-100 text-blue-700 ring-1 ring-blue-600/20'
                                  : 'bg-green-100 text-green-700 ring-1 ring-green-600/20'
                              }`}>
                                {formatRoleDisplay(admin.role)}
                              </span>
                            </td>
                            <td className="px-4 py-4 text-sm text-gray-600">
                              <div className="flex items-center gap-2">
                                <MapPin className="w-4 h-4 text-gray-400 flex-shrink-0" />
                                <div className="truncate" title={getAssignmentDisplay(admin)}>
                                  {getAssignmentDisplay(admin)}
                                </div>
                              </div>
                            </td>
                            <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-500">
                              <div className="flex items-center gap-2">
                                <Calendar className="w-4 h-4 text-gray-400" />
                                {new Date(admin.created_at).toLocaleDateString()}
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {/* Mobile Cards */}
                  <div className="md:hidden divide-y divide-gray-100">
                    {filteredAdmins.map((admin) => (
                      <div key={admin.id} className="p-4 hover:bg-blue-50/50 transition-colors">
                        <div className="flex flex-col gap-3">
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex-1 min-w-0">
                              <p className="font-semibold text-gray-900 mb-1 truncate">
                                {admin.first_name} {admin.middle_name ? admin.middle_name + ' ' : ''}{admin.last_name}
                              </p>
                              <div className="flex items-center gap-2 text-sm text-gray-600">
                                <Mail className="w-4 h-4 flex-shrink-0" />
                                <span className="truncate">{admin.email}</span>
                              </div>
                            </div>
                            <span className={`px-2.5 py-1 text-xs font-medium rounded-full flex-shrink-0 whitespace-nowrap ${
                              admin.role === 'superadmin'
                                ? 'bg-purple-100 text-purple-700 ring-1 ring-purple-600/20'
                                : admin.role === 'provincial_admin'
                                ? 'bg-indigo-100 text-indigo-700 ring-1 ring-indigo-600/20'
                                : admin.role === 'municipal_admin'
                                ? 'bg-blue-100 text-blue-700 ring-1 ring-blue-600/20'
                                : 'bg-green-100 text-green-700 ring-1 ring-green-600/20'
                            }`}>
                              {formatRoleDisplay(admin.role)}
                            </span>
                          </div>
                          <div className="space-y-2 text-sm text-gray-600">
                            <div className="flex items-center gap-2">
                              <UserCog className="w-4 h-4 text-gray-400 flex-shrink-0" />
                              <span className="font-medium text-gray-500 flex-shrink-0">Username:</span>
                              <span className="font-mono text-gray-800 truncate">{admin.username}</span>
                            </div>
                            <div className="flex items-start gap-2">
                              <MapPin className="w-4 h-4 text-gray-400 flex-shrink-0 mt-0.5" />
                              <span className="font-medium text-gray-500 flex-shrink-0">Assignment:</span>
                              <span className="text-gray-800 break-words">
                                {getAssignmentDisplay(admin)}
                              </span>
                            </div>
                            <div className="flex items-center gap-2">
                              <Calendar className="w-4 h-4 text-gray-400 flex-shrink-0" />
                              <span className="font-medium text-gray-500 flex-shrink-0">Created:</span>
                              <span className="text-gray-800">{new Date(admin.created_at).toLocaleDateString()}</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Pagination */}
                  <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 px-4 py-4 md:px-6 md:pb-6 md:pt-2 border-t border-gray-100">
                    <div className="text-sm text-gray-600">
                      {pagination ? `Page ${currentPage} of ${pagination.pages || 1}` : `Page ${currentPage}`}
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={handlePrevPage}
                        disabled={!canPrevPage || loadingAdmins}
                        className="px-4 py-2 text-sm font-medium rounded-lg border border-gray-200 text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        Previous
                      </button>
                      <button
                        type="button"
                        onClick={handleNextPage}
                        disabled={!canNextPage || loadingAdmins}
                        className="px-4 py-2 text-sm font-medium rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
                      >
                        Next
                      </button>
                    </div>
                  </div>
                </>
              )}
            </div>
        </motion.div>
      </div>

      {/* Create Admin Modal */}
      {showCreateForm && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-start md:items-center justify-center p-4 pt-20 md:pt-4 z-[60] overflow-y-auto">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] md:max-h-[90vh] overflow-y-auto my-auto"
          >
            <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between rounded-t-2xl">
              <h3 className="text-xl font-semibold text-gray-900">Create New Admin Account</h3>
              <button
                onClick={() => {
                  setShowCreateForm(false)
                  setCreateError(null)
                }}
                className="text-gray-400 hover:text-gray-600 p-1 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateAdmin} className="p-6 space-y-5">
              {createError && (
                <div className="rounded-xl border border-red-200 bg-red-50 text-red-700 px-4 py-3 text-sm flex items-start gap-3">
                  <svg className="w-5 h-5 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                  <span>{createError}</span>
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">
                    First name <span className="text-red-500">*</span>
                  </label>
                  <input
                    name="first_name"
                    className="w-full px-4 py-2.5 bg-white border border-gray-200 rounded-xl text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                    value={formData.first_name}
                    onChange={(e) => setFormData({ ...formData, first_name: e.target.value })}
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Middle name</label>
                  <input
                    name="middle_name"
                    className="w-full px-4 py-2.5 bg-white border border-gray-200 rounded-xl text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                    value={formData.middle_name}
                    onChange={(e) => setFormData({ ...formData, middle_name: e.target.value })}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">
                    Last name <span className="text-red-500">*</span>
                  </label>
                  <input
                    name="last_name"
                    className="w-full px-4 py-2.5 bg-white border border-gray-200 rounded-xl text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                    value={formData.last_name}
                    onChange={(e) => setFormData({ ...formData, last_name: e.target.value })}
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  Username <span className="text-red-500">*</span>
                </label>
                <input
                  name="username"
                  className="w-full px-4 py-2.5 bg-white border border-gray-200 rounded-xl text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                  value={formData.username}
                  onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  Email <span className="text-red-500">*</span>
                </label>
                <input
                  name="email"
                  type="email"
                  className="w-full px-4 py-2.5 bg-white border border-gray-200 rounded-xl text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  Mobile Number <span className="text-gray-400 text-xs">(optional)</span>
                </label>
                <input
                  name="mobile_number"
                  type="tel"
                  className="w-full px-4 py-2.5 bg-white border border-gray-200 rounded-xl text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                  value={formData.mobile_number}
                  onChange={(e) => setFormData({ ...formData, mobile_number: e.target.value })}
                  placeholder="09XXXXXXXXX"
                />
                <p className="text-xs text-gray-500 mt-1.5">Optional - used for SMS notifications.</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  Admin Secret Key <span className="text-red-500">*</span>
                </label>
                <input
                  name="admin_secret"
                  type="password"
                  className="w-full px-4 py-2.5 bg-white border border-gray-200 rounded-xl text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                  value={formData.admin_secret}
                  onChange={(e) => setFormData({ ...formData, admin_secret: e.target.value })}
                  required
                />
                <p className="text-xs text-gray-500 mt-1.5">Must match the configured ADMIN_SECRET_KEY.</p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">
                    Password <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <input
                      name="password"
                      type={showPassword ? 'text' : 'password'}
                      className="w-full px-4 py-2.5 pr-12 bg-white border border-gray-200 rounded-xl text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                      value={formData.password}
                      onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                      required
                    />
                    <button
                      type="button"
                      className="absolute inset-y-0 right-0 pr-4 text-gray-500 hover:text-gray-700 text-xs font-medium"
                      onClick={() => setShowPassword((v) => !v)}
                    >
                      {showPassword ? 'Hide' : 'Show'}
                    </button>
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">
                    Confirm Password <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <input
                      name="confirm_password"
                      type={showConfirm ? 'text' : 'password'}
                      className="w-full px-4 py-2.5 pr-12 bg-white border border-gray-200 rounded-xl text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                      value={formData.confirm_password}
                      onChange={(e) => setFormData({ ...formData, confirm_password: e.target.value })}
                      required
                    />
                    <button
                      type="button"
                      className="absolute inset-y-0 right-0 pr-4 text-gray-500 hover:text-gray-700 text-xs font-medium"
                      onClick={() => setShowConfirm((v) => !v)}
                    >
                      {showConfirm ? 'Hide' : 'Show'}
                    </button>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-4">
                <button
                  type="button"
                  className="relative h-20 w-20 rounded-full overflow-hidden border-2 border-gray-200 bg-gray-50 hover:border-blue-500 transition-colors"
                  onClick={() => document.getElementById('admin-profile-upload')?.click()}
                >
                  {previewUrl ? (
                    <img src={previewUrl} alt="Preview" className="h-full w-full object-cover" />
                  ) : (
                    <span className="absolute inset-0 flex items-center justify-center text-xs text-gray-500">
                      Upload
                    </span>
                  )}
                </button>
                <div className="flex-1">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Profile Photo</label>
                  <input
                    id="admin-profile-upload"
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => {
                      const f = e.target.files?.[0] || null
                      setUploads({ ...uploads, profile_picture: f })
                      if (f) setPreviewUrl(URL.createObjectURL(f))
                    }}
                  />
                  <p className="text-xs text-gray-500">Click to upload profile photo</p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">
                    Valid ID (Front) <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="file"
                    accept="image/*"
                    className="w-full px-4 py-2.5 bg-white border border-gray-200 rounded-xl text-gray-900 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 transition-all"
                    onChange={(e) => setUploads({ ...uploads, valid_id_front: e.target.files?.[0] || null })}
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">
                    Valid ID (Back) <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="file"
                    accept="image/*"
                    className="w-full px-4 py-2.5 bg-white border border-gray-200 rounded-xl text-gray-900 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 transition-all"
                    onChange={(e) => setUploads({ ...uploads, valid_id_back: e.target.files?.[0] || null })}
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-3">
                  Admin Role <span className="text-red-500">*</span>
                </label>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <label className={`flex items-center p-4 border-2 rounded-xl cursor-pointer transition-all ${
                    formData.admin_role === 'provincial_admin'
                      ? 'border-indigo-500 bg-indigo-50 ring-2 ring-indigo-500/20'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}>
                    <input
                      type="radio"
                      name="admin_role"
                      value="provincial_admin"
                      checked={formData.admin_role === 'provincial_admin'}
                      onChange={(e) => setFormData({ ...formData, admin_role: e.target.value as AdminRole, admin_municipality_slug: '', admin_barangay_id: '' })}
                      className="mr-3 h-4 w-4 text-indigo-600"
                    />
                    <div>
                      <div className="font-medium text-sm text-gray-900">Provincial Admin</div>
                      <div className="text-xs text-gray-600">Province-wide announcements</div>
                    </div>
                  </label>
                  <label className={`flex items-center p-4 border-2 rounded-xl cursor-pointer transition-all ${
                    formData.admin_role === 'municipal_admin'
                      ? 'border-blue-500 bg-blue-50 ring-2 ring-blue-500/20'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}>
                    <input
                      type="radio"
                      name="admin_role"
                      value="municipal_admin"
                      checked={formData.admin_role === 'municipal_admin'}
                      onChange={(e) => setFormData({ ...formData, admin_role: e.target.value as AdminRole, admin_barangay_id: '' })}
                      className="mr-3 h-4 w-4 text-blue-600"
                    />
                    <div>
                      <div className="font-medium text-sm text-gray-900">Municipal Admin</div>
                      <div className="text-xs text-gray-600">Manage entire municipality</div>
                    </div>
                  </label>
                  <label className={`flex items-center p-4 border-2 rounded-xl cursor-pointer transition-all ${
                    formData.admin_role === 'barangay_admin'
                      ? 'border-green-500 bg-green-50 ring-2 ring-green-500/20'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}>
                    <input
                      type="radio"
                      name="admin_role"
                      value="barangay_admin"
                      checked={formData.admin_role === 'barangay_admin'}
                      onChange={(e) => setFormData({ ...formData, admin_role: e.target.value as AdminRole })}
                      className="mr-3 h-4 w-4 text-green-600"
                    />
                    <div>
                      <div className="font-medium text-sm text-gray-900">Barangay Admin</div>
                      <div className="text-xs text-gray-600">Manage specific barangay</div>
                    </div>
                  </label>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">
                    Province <span className="text-red-500">*</span>
                  </label>
                  <select
                    className="w-full px-4 py-2.5 bg-white border border-gray-200 rounded-xl text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                    value={formData.admin_province_id}
                    onChange={(e) => setFormData({ ...formData, admin_province_id: e.target.value, admin_municipality_slug: '', admin_barangay_id: '' })}
                    required
                  >
                    <option value="">Select Province</option>
                    {provinces.map(p => (
                      <option key={p.id} value={p.id}>{p.name}</option>
                    ))}
                  </select>
                </div>

                {formData.admin_role !== 'provincial_admin' && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">
                      Municipality <span className="text-red-500">*</span>
                    </label>
                    <select
                      name="admin_municipality_slug"
                      className="w-full px-4 py-2.5 bg-white border border-gray-200 rounded-xl text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all disabled:bg-gray-50 disabled:cursor-not-allowed"
                      value={formData.admin_municipality_slug}
                      onChange={(e) => setFormData({ ...formData, admin_municipality_slug: e.target.value, admin_barangay_id: '' })}
                      disabled={!formData.admin_province_id}
                      required
                    >
                      <option value="">Select Municipality</option>
                      {municipalities.map(m => (
                        <option key={m.slug} value={m.slug}>{m.name}</option>
                      ))}
                    </select>
                  </div>
                )}
              </div>

              {formData.admin_role === 'barangay_admin' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">
                    Barangay <span className="text-red-500">*</span>
                  </label>
                  <select
                    name="admin_barangay_id"
                    className="w-full px-4 py-2.5 bg-white border border-gray-200 rounded-xl text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all disabled:bg-gray-50 disabled:cursor-not-allowed"
                    value={formData.admin_barangay_id}
                    onChange={(e) => setFormData({ ...formData, admin_barangay_id: e.target.value })}
                    disabled={!formData.admin_municipality_slug}
                    required={formData.admin_role === 'barangay_admin'}
                  >
                    <option value="">Select Barangay</option>
                    {barangays.map(b => (
                      <option key={b.id} value={b.id}>{b.name}</option>
                    ))}
                  </select>
                </div>
              )}

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => {
                    setShowCreateForm(false)
                    setCreateError(null)
                  }}
                  className="flex-1 px-6 py-3 border border-gray-300 rounded-xl text-gray-700 font-medium hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={createLoading}
                  className="flex-1 px-6 py-3 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white font-semibold rounded-xl shadow-lg shadow-blue-500/25 hover:shadow-blue-500/40 transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {createLoading ? 'Creating...' : 'Create Admin'}
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}

      {/* Floating Action Button (Mobile Only) */}
      {!showCreateForm && (
        <motion.div
          className="fixed bottom-20 right-4 z-50 sm:hidden"
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.8 }}
          transition={{ duration: 0.2 }}
        >
          <motion.button
            className="relative flex items-center justify-center bg-gradient-to-r from-blue-600 to-blue-700 text-white shadow-lg shadow-blue-500/30 hover:shadow-blue-500/50 transition-shadow"
            onClick={() => {
              if (fabExpanded) {
                setShowCreateForm(true)
                setFabExpanded(false)
              } else {
                setFabExpanded(true)
              }
            }}
            animate={{
              width: fabExpanded ? 180 : 56,
              height: 56,
              borderRadius: 28,
            }}
            transition={{
              type: "spring",
              stiffness: 400,
              damping: 25,
            }}
            whileTap={{ scale: 0.95 }}
          >
            <AnimatePresence mode="wait">
              {fabExpanded ? (
                <motion.div
                  key="expanded"
                  className="flex items-center gap-2 px-4"
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.8 }}
                  transition={{ duration: 0.15 }}
                >
                  <Plus className="w-5 h-5 flex-shrink-0" />
                  <span className="text-sm font-medium whitespace-nowrap">New Admin</span>
                </motion.div>
              ) : (
                <motion.div
                  key="collapsed"
                  initial={{ opacity: 0, rotate: -90 }}
                  animate={{ opacity: 1, rotate: 0 }}
                  exit={{ opacity: 0, rotate: 90 }}
                  transition={{ duration: 0.15 }}
                >
                  <Plus className="w-6 h-6" />
                </motion.div>
              )}
            </AnimatePresence>
          </motion.button>
        </motion.div>
      )}

      {/* Backdrop to close FAB when clicking outside */}
      <AnimatePresence>
        {fabExpanded && !showCreateForm && (
          <motion.div
            className="fixed inset-0 z-40 sm:hidden"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setFabExpanded(false)}
          />
        )}
      </AnimatePresence>
    </SuperAdminLayout>
  )
}
