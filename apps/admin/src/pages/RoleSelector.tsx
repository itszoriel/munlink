import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { ConnoisseurStackInteractor, type MenuItem } from '@/components/ui/connoisseur-stack-interactor'

export default function RoleSelector() {
  const navigate = useNavigate()

  const visualItems: MenuItem[] = [
    {
      num: '01',
      name: 'Super Admin',
      clipId: 'clip-original',
      image: '/assets/superadmin_login.jpg',
      onSelect: () => navigate('/superadmin/login'),
    },
    {
      num: '02',
      name: 'Provincial Admin',
      clipId: 'clip-hexagons',
      image: '/assets/provincial.jpg',
      onSelect: () => navigate('/provincial/login'),
    },
    {
      num: '03',
      name: 'Municipal Admin',
      clipId: 'clip-pixels',
      image: '/assets/admin_login.jpg',
      onSelect: () => navigate('/login'),
    },
    {
      num: '04',
      name: 'Barangay Admin',
      clipId: 'clip-stripes',
      image: '/assets/barangay.jpg',
      onSelect: () => navigate('/barangay/login'),
    },
  ]

  return (
    <div className="min-h-screen relative overflow-hidden bg-gradient-to-br from-[#f7fbff] via-[#f3f6ff] to-[#e8f5ff]">
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute -left-16 top-6 w-[340px] h-[340px] bg-ocean-200/30 blur-[110px]" />
        <div className="absolute -right-16 bottom-0 w-[340px] h-[340px] bg-purple-200/25 blur-[110px]" />
      </div>

      <div className="relative z-10 max-w-6xl mx-auto px-4 md:px-6 py-6 md:py-8 space-y-6">
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="text-center"
        >
          <p className="text-[11px] md:text-xs font-semibold uppercase tracking-[0.28em] text-ocean-700/80">
            Admin Portal
          </p>
          <h1 className="mt-2 text-3xl md:text-[2.6rem] font-serif font-bold text-slate-900 leading-tight">
            Choose Your Governance Track
          </h1>
          <p className="mt-2 text-sm md:text-base text-slate-600 max-w-3xl mx-auto">
            Hover to explore the feel of each admin level. Click a track to jump into its dedicated sign-in flow.
          </p>
        </motion.div>

        <ConnoisseurStackInteractor
          items={visualItems}
          className="rounded-[24px] border border-white/60 shadow-2xl !min-h-[430px] md:!min-h-[470px] bg-gradient-to-br from-slate-900 via-slate-800 to-sky-900"
        />
      </div>
    </div>
  )
}
