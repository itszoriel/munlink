"""
MunLink Region 3 - Constants
Application-wide constants
"""

# The 13 Zambales Municipalities (EXACTLY 13)
ZAMBALES_MUNICIPALITIES = [
    'Botolan',
    'Cabangan',
    'Candelaria',
    'Castillejos',
    'Iba',  # Capital
    'Masinloc',
    'Palauig',
    'San Antonio',
    'San Felipe',
    'San Marcelino',
    'San Narciso',
    'Santa Cruz',
    'Subic'
]

# User Roles
USER_ROLES = {
    'RESIDENT': 'resident',
    'ADMIN': 'admin'
}

# Verification Statuses
VERIFICATION_STATUS = {
    'PENDING': 'pending',
    'APPROVED': 'approved',
    'REJECTED': 'rejected'
}

# Marketplace Categories
MARKETPLACE_CATEGORIES = [
    'electronics',
    'furniture',
    'clothing',
    'books',
    'tools',
    'appliances',
    'vehicles',
    'sports',
    'toys',
    'other'
]

# Transaction Types
TRANSACTION_TYPES = {
    'DONATE': 'donate',
    'LEND': 'lend',
    'SELL': 'sell'
}

# Item Statuses
ITEM_STATUSES = [
    'available',
    'claimed',
    'requested',
    'approved',
    'borrowed',
    'sold',
    'delivered',
    'completed',
    'cancelled'
]

# Transaction Statuses
TRANSACTION_STATUSES = [
    'pending',
    'approved',
    'rejected',
    'contact_exchange',
    'picked_up',
    'returned',
    'completed',
    'cancelled'
]

# Document Categories
DOCUMENT_CATEGORIES = {
    'MUNICIPAL': 'municipal',
    'BARANGAY': 'barangay'
}

# Document Request Statuses
DOCUMENT_STATUSES = [
    'pending',
    'under_review',
    'approved',
    'rejected',
    'generated',
    'ready_for_pickup',
    'delivered',
    'expired'
]

# Delivery Methods
DELIVERY_METHODS = {
    'PICKUP': 'pickup',
    'DIGITAL': 'digital'
}

# Issue Categories
ISSUE_CATEGORIES = [
    'infrastructure',
    'public_safety',
    'environmental',
    'administrative'
]

# Urgency Levels
URGENCY_LEVELS = [
    'low',
    'medium',
    'high',
    'emergency'
]

# Issue Statuses
ISSUE_STATUSES = [
    'reported',
    'acknowledged',
    'investigating',
    'in_progress',
    'resolved',
    'verified',
    'closed'
]

# Benefit Application Statuses
BENEFIT_STATUSES = [
    'submitted',
    'under_review',
    'document_request',
    'approved',
    'denied',
    'disbursement',
    'completed'
]

# File Upload Limits
MAX_ITEM_PHOTOS = 5
MAX_ISSUE_PHOTOS = 5
MAX_FILE_SIZE_MB = 10

# Age Requirements
MINIMUM_AGE_MARKETPLACE = 18
MINIMUM_AGE_SERVICES = 18

# Notification Types
NOTIFICATION_TYPES = [
    'document_ready',
    'issue_update',
    'benefit_approved',
    'benefit_denied',
    'marketplace_contact',
    'marketplace_transaction',
    'account_verified',
    'id_rejected',
    'system_announcement'
]

# Activity Log Actions
ACTIVITY_ACTIONS = [
    'user_login',
    'user_logout',
    'user_register',
    'email_verified',
    'government_id_uploaded',
    'account_verified',
    'id_verification_rejected',
    'document_requested',
    'document_approved',
    'document_rejected',
    'document_generated',
    'document_expired',
    'item_created',
    'item_claimed',
    'transaction_completed',
    'issue_reported',
    'issue_resolved',
    'benefit_applied',
    'benefit_approved',
    'benefit_denied',
    'municipality_transferred',
    'profile_updated',
    'admin_account_created'
]

