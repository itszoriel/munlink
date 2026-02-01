import { Link } from 'react-router-dom'

export default function Footer() {
  const year = new Date().getFullYear()
  return (
    <footer className="mt-16">
      <div className="bg-white/60 backdrop-blur-xl border-t border-white/40">
        <div className="container mx-auto px-4 py-12">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div>
              <div className="text-xl font-serif font-semibold text-gray-900">MunLink Zambales</div>
              <p className="mt-2 text-gray-600">Connecting residents, services, and local markets across Zambales province.</p>
            </div>
            <div>
              <div className="font-semibold text-gray-900 mb-3">Explore</div>
              <ul className="space-y-2 text-gray-600">
                <li><Link to="/announcements" className="hover:text-ocean-700">Announcements</Link></li>
                <li><Link to="/marketplace" className="hover:text-ocean-700">Marketplace</Link></li>
                <li><Link to="/about" className="hover:text-ocean-700">About</Link></li>
              </ul>
            </div>
            <div>
              <div className="font-semibold text-gray-900 mb-3">Services</div>
              <ul className="space-y-2 text-gray-600">
                <li><Link to="/documents" className="hover:text-ocean-700">Documents</Link></li>
                <li><Link to="/problems" className="hover:text-ocean-700">Problems</Link></li>
                <li><Link to="/programs" className="hover:text-ocean-700">Programs</Link></li>
              </ul>
            </div>
          </div>
          <div className="mt-10 pt-6 border-t border-white/40 text-sm text-gray-600 flex items-center justify-between">
            <p>© {year} MunLink Zambales. All rights reserved.</p>
            <p>Serving 13 municipalities across Zambales province.</p>
          </div>
        </div>
      </div>
    </footer>
  )
}


