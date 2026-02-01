import { useState } from 'react'

interface ViewIDReasonModalProps {
  isOpen: boolean
  docType: 'id_front' | 'id_back'
  onClose: () => void
  onConfirm: (reason: string, notes: string) => void
}

export function ViewIDReasonModal({
  isOpen,
  docType,
  onClose,
  onConfirm
}: ViewIDReasonModalProps) {
  const [selectedReason, setSelectedReason] = useState('')
  const [notes, setNotes] = useState('')

  if (!isOpen) return null

  const reasons = [
    'Initial verification review',
    'Re-verification after document update',
    'Investigation of discrepancy',
    'Quality check',
    'Resident support request',
    'Audit/compliance review',
    'Other (specify in notes)'
  ]

  const handleConfirm = () => {
    if (!selectedReason) {
      alert('Please select a reason')
      return
    }

    const fullReason = selectedReason === 'Other (specify in notes)'
      ? notes || 'Not specified'
      : selectedReason

    onConfirm(fullReason, notes)

    // Reset state
    setSelectedReason('')
    setNotes('')
  }

  const docTypeLabels = {
    id_front: 'ID Front',
    id_back: 'ID Back'
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">
          Verify Access - {docTypeLabels[docType]}
        </h3>

        <p className="text-sm text-gray-600 mb-4">
          This action will be logged in the audit trail. Please select a reason for viewing this document.
        </p>

        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Reason for viewing:
          </label>
          <select
            value={selectedReason}
            onChange={(e) => setSelectedReason(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-ocean-500 focus:border-ocean-500"
          >
            <option value="">-- Select a reason --</option>
            {reasons.map((r) => (
              <option key={r} value={r}>{r}</option>
            ))}
          </select>
        </div>

        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Additional notes (optional):
          </label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={3}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-ocean-500 focus:border-ocean-500"
            placeholder="Enter any additional context..."
          />
        </div>

        <div className="flex gap-3 justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            onClick={handleConfirm}
            disabled={!selectedReason}
            className="px-4 py-2 text-sm font-medium text-white bg-ocean-600 rounded-md hover:bg-ocean-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Confirm & View
          </button>
        </div>
      </div>
    </div>
  )
}
