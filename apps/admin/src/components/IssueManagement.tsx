/**
 * MunLink Zambales - Issue Management Component
 * Component for managing and responding to issues
 */
import { useState, useEffect } from 'react'
import { issueApi, handleApiError } from '../lib/api'
import { EmptyState } from '@munlink/ui'

interface Issue {
  id: number
  issue_number: string
  title: string
  description: string
  status: string
  priority: string
  category: {
    name: string
    icon: string
  }
  user: {
    first_name: string
    last_name: string
    username: string
  }
  municipality_name: string
  specific_location?: string
  attachments?: string[]
  admin_response?: string
  created_at: string
  updated_at: string
}

interface IssueManagementProps {
  onIssueUpdated?: (issueId: number) => void
}

export default function IssueManagement({ onIssueUpdated }: IssueManagementProps) {
  const [issues, setIssues] = useState<Issue[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedIssue, setSelectedIssue] = useState<Issue | null>(null)
  const [showModal, setShowModal] = useState(false)
  const [actionLoading, setActionLoading] = useState<number | null>(null)
  const [filters, setFilters] = useState({
    status: '',
    category: '',
    page: 1,
    per_page: 20
  })

  // Load issues
  const loadIssues = async () => {
    try {
      setLoading(true)
      setError(null)
      const response = await issueApi.getIssues(filters)
      setIssues((response as any).issues || [])
    } catch (err: any) {
      // Handle 422 errors gracefully - show empty state instead of error
      if (err.response?.status === 422) {
        setIssues([])
        setError(null)
      } else {
        setError(handleApiError(err))
      }
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadIssues()
  }, [filters])

  // Handle status update
  const handleStatusUpdate = async (issueId: number, newStatus: string) => {
    try {
      setActionLoading(issueId)
      await issueApi.updateIssueStatus(issueId, newStatus)
      
      // Update local state
      setIssues(prev => prev.map(issue => 
        issue.id === issueId 
          ? { ...issue, status: newStatus, updated_at: new Date().toISOString() }
          : issue
      ))
      
      onIssueUpdated?.(issueId)
      
      // Close modal if this was the selected issue
      if (selectedIssue?.id === issueId) {
        setShowModal(false)
        setSelectedIssue(null)
      }
    } catch (err: any) {
      setError(handleApiError(err))
    } finally {
      setActionLoading(null)
    }
  }

  // Handle admin response
  const handleAddResponse = async (issueId: number, response: string) => {
    try {
      setActionLoading(issueId)
      await issueApi.addIssueResponse(issueId, response)
      
      // Update local state
      setIssues(prev => prev.map(issue => 
        issue.id === issueId 
          ? { ...issue, admin_response: response, updated_at: new Date().toISOString() }
          : issue
      ))
      
      onIssueUpdated?.(issueId)
    } catch (err: any) {
      setError(handleApiError(err))
    } finally {
      setActionLoading(null)
    }
  }

  // Open issue detail modal
  const openIssueModal = (issue: Issue) => {
    setSelectedIssue(issue)
    setShowModal(true)
  }

  // Get status color
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending': return 'bg-yellow-100 text-yellow-800'
      case 'in_progress': return 'bg-blue-100 text-blue-800'
      case 'resolved': return 'bg-green-100 text-green-800'
      case 'closed': return 'bg-gray-100 text-gray-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  // Get priority color
  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'urgent': return 'bg-red-100 text-red-800'
      case 'high': return 'bg-orange-100 text-orange-800'
      case 'medium': return 'bg-yellow-100 text-yellow-800'
      case 'low': return 'bg-green-100 text-green-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-zambales-green"></div>
        <span className="ml-2 text-gray-600">Loading issues...</span>
      </div>
    )
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4">
        <div className="flex items-center">
          <div className="text-red-400 mr-3">
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
            </svg>
          </div>
          <div>
            <h3 className="text-sm font-medium text-red-800">Error loading issues</h3>
            <p className="text-sm text-red-700 mt-1">{error}</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <>
      {/* Filters */}
      <div className="mb-6 flex flex-wrap gap-4">
        <select
          name="issueStatusFilter"
          id="issue-status-filter"
          aria-label="Filter issues by status"
          value={filters.status}
          onChange={(e) => setFilters(prev => ({ ...prev, status: e.target.value, page: 1 }))}
          className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-zambales-green"
        >
          <option value="">All Status</option>
          <option value="pending">Pending</option>
          <option value="in_progress">In Progress</option>
          <option value="resolved">Resolved</option>
          <option value="closed">Closed</option>
        </select>
        
        <select
          name="issueCategoryFilter"
          id="issue-category-filter"
          aria-label="Filter issues by category"
          value={filters.category}
          onChange={(e) => setFilters(prev => ({ ...prev, category: e.target.value, page: 1 }))}
          className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-zambales-green"
        >
          <option value="">All Categories</option>
          <option value="infrastructure">Infrastructure</option>
          <option value="environment">Environment</option>
          <option value="safety">Safety</option>
          <option value="other">Other</option>
        </select>
      </div>

      {/* Issues List */}
      <div className="space-y-4">
        {issues.map((issue) => (
          <div key={issue.id} className="bg-white rounded-lg border border-gray-200 p-6 hover:shadow-md transition-shadow">
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <div className="flex items-center space-x-2 mb-2">
                  <span className="text-sm font-medium text-gray-500">#{issue.issue_number}</span>
                  <span className={`px-2 py-1 text-xs font-medium rounded-full ${getStatusColor(issue.status)}`}>
                    {issue.status.replace('_', ' ').toUpperCase()}
                  </span>
                  <span className={`px-2 py-1 text-xs font-medium rounded-full ${getPriorityColor(issue.priority)}`}>
                    {issue.priority.toUpperCase()}
                  </span>
                </div>
                
                <h3 className="text-lg font-medium text-gray-900 mb-2">{issue.title}</h3>
                <p className="text-gray-600 mb-3 line-clamp-2">{issue.description}</p>
                
                <div className="flex items-center space-x-4 text-sm text-gray-500">
                  <span>By: {issue.user.first_name} {issue.user.last_name} (@{issue.user.username})</span>
                  <span>•</span>
                  <span>{issue.municipality_name}</span>
                  {issue.specific_location && (
                    <>
                      <span>•</span>
                      <span>{issue.specific_location}</span>
                    </>
                  )}
                  <span>•</span>
                  <span>{new Date(issue.created_at).toLocaleDateString()}</span>
                </div>
              </div>

              <div className="flex items-center space-x-2 ml-4">
                <button
                  onClick={() => openIssueModal(issue)}
                  className="px-3 py-1 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-md transition-colors"
                >
                  View Details
                </button>
                
                {issue.status === 'pending' && (
                  <button
                    onClick={() => handleStatusUpdate(issue.id, 'in_progress')}
                    disabled={actionLoading === issue.id}
                    className="px-3 py-1 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-md transition-colors"
                  >
                    {actionLoading === issue.id ? 'Updating...' : 'Start'}
                  </button>
                )}
                
                {issue.status === 'in_progress' && (
                  <button
                    onClick={() => handleStatusUpdate(issue.id, 'resolved')}
                    disabled={actionLoading === issue.id}
                    className="px-3 py-1 text-sm font-medium text-white bg-green-600 hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-md transition-colors"
                  >
                    {actionLoading === issue.id ? 'Updating...' : 'Resolve'}
                  </button>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      {issues.length === 0 && (
        <EmptyState
          icon="alert"
          title="No issues found"
          description="No issues match your current filters. Try adjusting the status or category filter."
        />
      )}

      {/* Issue Detail Modal */}
      {showModal && selectedIssue && (
        <IssueDetailModal
          issue={selectedIssue}
          onClose={() => {
            setShowModal(false)
            setSelectedIssue(null)
          }}
          onStatusUpdate={handleStatusUpdate}
          onAddResponse={handleAddResponse}
          loading={actionLoading === selectedIssue.id}
        />
      )}
    </>
  )
}

// Issue Detail Modal Component
interface IssueDetailModalProps {
  issue: Issue
  onClose: () => void
  onStatusUpdate: (issueId: number, status: string) => void
  onAddResponse: (issueId: number, response: string) => void
  loading: boolean
}

function IssueDetailModal({ 
  issue, 
  onClose, 
  onStatusUpdate, 
  onAddResponse, 
  loading 
}: IssueDetailModalProps) {
  const [responseText, setResponseText] = useState('')
  const [showResponseForm, setShowResponseForm] = useState(false)

  const handleAddResponse = () => {
    if (responseText.trim()) {
      onAddResponse(issue.id, responseText)
      setResponseText('')
      setShowResponseForm(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-xl font-semibold text-gray-900">
                Issue #{issue.issue_number}
              </h2>
              <p className="text-sm text-gray-500">{issue.title}</p>
            </div>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Issue Details */}
          <div className="space-y-6">
            {/* Status and Priority */}
            <div className="flex items-center space-x-4">
              <span className={`px-3 py-1 text-sm font-medium rounded-full ${getStatusColor(issue.status)}`}>
                {issue.status.replace('_', ' ').toUpperCase()}
              </span>
              <span className={`px-3 py-1 text-sm font-medium rounded-full ${getPriorityColor(issue.priority)}`}>
                {issue.priority.toUpperCase()}
              </span>
            </div>

            {/* Description */}
            <div>
              <h3 className="text-sm font-medium text-gray-900 mb-2">Description</h3>
              <p className="text-gray-700">{issue.description}</p>
            </div>

            {/* Location */}
            <div>
              <h3 className="text-sm font-medium text-gray-900 mb-2">Location</h3>
              <p className="text-gray-700">
                {issue.municipality_name}
                {issue.specific_location && ` - ${issue.specific_location}`}
              </p>
            </div>

            {/* Attachments */}
            {issue.attachments && issue.attachments.length > 0 && (
              <div>
                <h3 className="text-sm font-medium text-gray-900 mb-2">Attachments</h3>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                  {issue.attachments.map((attachment, index) => (
                    <img
                      key={index}
                      src={attachment}
                      alt={`Attachment ${index + 1}`}
                      className="w-full h-32 object-cover rounded border"
                    />
                  ))}
                </div>
              </div>
            )}

            {/* Admin Response */}
            {issue.admin_response && (
              <div>
                <h3 className="text-sm font-medium text-gray-900 mb-2">Admin Response</h3>
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <p className="text-blue-900">{issue.admin_response}</p>
                </div>
              </div>
            )}

            {/* Actions */}
            <div className="flex items-center justify-between pt-4 border-t">
              <div className="flex items-center space-x-3">
                {(issue.status === 'submitted' || issue.status === 'pending' || issue.status === 'under_review') && (
                  <button
                    onClick={() => onStatusUpdate(issue.id, 'in_progress')}
                    disabled={loading}
                    className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-md transition-colors"
                  >
                    {loading ? 'Updating...' : 'Start Progress'}
                  </button>
                )}
                
                {issue.status === 'in_progress' && (
                  <button
                    onClick={() => onStatusUpdate(issue.id, 'resolved')}
                    disabled={loading}
                    className="px-4 py-2 text-sm font-medium text-white bg-green-600 hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-md transition-colors"
                  >
                    {loading ? 'Updating...' : 'Mark Resolved'}
                  </button>
                )}
              {issue.status === 'resolved' && (
                <button
                  onClick={() => { if (window.confirm('Close this issue? This will finalize the issue and prevent further status changes.')) onStatusUpdate(issue.id, 'closed') }}
                  disabled={loading}
                  className="px-4 py-2 text-sm font-medium text-white bg-gray-700 hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed rounded-md transition-colors"
                >
                  {loading ? 'Updating...' : 'Close Issue'}
                </button>
              )}
                
                {!showResponseForm && (
                  <button
                    onClick={() => setShowResponseForm(true)}
                    className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-md transition-colors"
                  >
                    Add Response
                  </button>
                )}
              </div>
            </div>

            {/* Response Form */}
            {showResponseForm && (
              <div className="border-t pt-4">
                <h3 className="text-sm font-medium text-gray-900 mb-2">Add Response</h3>
                <textarea
                  value={responseText}
                  onChange={(e) => setResponseText(e.target.value)}
                  placeholder="Enter your response..."
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  rows={4}
                />
                <div className="flex items-center justify-end space-x-3 mt-3">
                  <button
                    onClick={() => setShowResponseForm(false)}
                    className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-md transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleAddResponse}
                    disabled={loading || !responseText.trim()}
                    className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-md transition-colors"
                  >
                    {loading ? 'Adding...' : 'Add Response'}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

// Helper functions (same as in main component)
const getStatusColor = (status: string) => {
  switch (status) {
    case 'pending': return 'bg-yellow-100 text-yellow-800'
    case 'in_progress': return 'bg-blue-100 text-blue-800'
    case 'resolved': return 'bg-green-100 text-green-800'
    case 'closed': return 'bg-gray-100 text-gray-800'
    default: return 'bg-gray-100 text-gray-800'
  }
}

const getPriorityColor = (priority: string) => {
  switch (priority) {
    case 'urgent': return 'bg-red-100 text-red-800'
    case 'high': return 'bg-orange-100 text-orange-800'
    case 'medium': return 'bg-yellow-100 text-yellow-800'
    case 'low': return 'bg-green-100 text-green-800'
    default: return 'bg-gray-100 text-gray-800'
  }
}
