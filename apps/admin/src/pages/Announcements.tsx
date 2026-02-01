import AnnouncementManager from '../components/AnnouncementManager'

export default function Announcements() {
  return (
    <div className="min-h-screen">
      <div className="bg-white/70 backdrop-blur-xl rounded-3xl shadow-xl border border-white/50 overflow-hidden">
        <div className="px-6 py-5 border-b border-neutral-200">
          <h1 className="text-xl font-bold text-neutral-900 mb-1">Announcements</h1>
          <p className="text-sm text-neutral-600">Create and manage public announcements</p>
        </div>
        <div className="p-6">
          <AnnouncementManager />
        </div>
      </div>
    </div>
  )
}


