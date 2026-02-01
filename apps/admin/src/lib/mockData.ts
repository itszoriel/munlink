// Sample mocked data for UI-only pages

export const dashboardStats = [
  { icon: '👥', label: 'Pending Verifications', value: '0', change: '+0%', changeType: 'neutral', bgGradient: 'from-ocean-500 to-ocean-600' },
  { icon: '⚠️', label: 'Active Issues', value: '0', change: '-100%', changeType: 'positive', bgGradient: 'from-sunset-500 to-sunset-600' },
  { icon: '🛍️', label: 'Marketplace Items', value: '0', change: '+0%', changeType: 'neutral', bgGradient: 'from-forest-500 to-forest-600' },
  { icon: '📢', label: 'Announcements', value: '0', change: '+0%', changeType: 'neutral', bgGradient: 'from-purple-500 to-purple-600' },
] as const

export const sampleResidents = [
  { id: 'RES-001', name: 'Juan Dela Cruz', email: 'juan.delacruz@email.com', phone: '+63 912 345 6789', municipality: 'Iba', status: 'verified', joined: '2024-01-15', avatar: 'JD' },
] as const


