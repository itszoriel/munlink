# Dual Payment Implementation Verification Report
## Stripe + Manual QR Payment System

**Date:** February 3, 2026
**Status:** ✅ **FULLY IMPLEMENTED - READY FOR TESTING**
**Verification Method:** Code inspection and migration verification

---

## Executive Summary

The dual payment system (Stripe card payments + Manual QR payments with proof upload and Payment ID verification) has been **FULLY IMPLEMENTED** across both backend and frontend. All database fields, API endpoints, frontend components, and workflows are present and properly connected.

---

## 1. Database Layer ✅ VERIFIED

### 1.1 Migration Status
- **Current Migration:** `20260202_manual_qr_payments` (head)
- **Migration Applied:** YES
- **Database:** PostgreSQL (Supabase)

### 1.2 DocumentRequest Model Fields
**File:** `apps/api/models/document.py`

All manual payment fields are present in the DocumentRequest model:

| Field | Type | Purpose | Line |
|-------|------|---------|------|
| `payment_method` | String(20) | stripe / manual_qr | 127 |
| `manual_payment_status` | String(30) | not_started → proof_uploaded → id_sent → submitted → approved/rejected | 130 |
| `manual_payment_proof_path` | String(255) | Private bucket path to proof file | 131 |
| `manual_payment_id_hash` | String(255) | Hashed Payment ID (bcrypt) | 132 |
| `manual_payment_id_last4` | String(10) | Last 4 chars for display | 133 |
| `manual_payment_id_sent_at` | DateTime | Timestamp when ID emailed | 134 |
| `manual_payment_submitted_at` | DateTime | Timestamp when user submitted ID | 135 |
| `manual_reviewed_by` | Integer | Admin user ID who reviewed | 136 |
| `manual_reviewed_at` | DateTime | Timestamp of review | 137 |
| `manual_review_notes` | Text | Admin rejection reason | 138 |

**Verification:** All fields included in model's `to_dict()` method (lines 209-216) ✅

---

## 2. Backend API Layer ✅ VERIFIED

### 2.1 Payment Configuration Endpoint
**File:** `apps/api/routes/documents.py`

#### GET /api/documents/payment-config
**Line:** 643-659
**Auth Required:** YES (JWT)
**Returns:**
```json
{
  "stripe": {
    "available": true/false,
    "publishable_key": "pk_...",
    "status": "ok" / "unavailable",
    "currency": "PHP"
  },
  "manual_qr": {
    "available": true/false,
    "qr_image_url": "/api/documents/manual-qr-image",
    "instructions": "Scan QR, pay exact amount...",
    "pay_to_name": "Account Name",
    "pay_to_number": "09XXXXXXXXX"
  }
}
```

**Environment Variables Used:**
- `MANUAL_QR_IMAGE_PATH` (line 287 in `config.py`)
- `MANUAL_PAYMENT_INSTRUCTIONS` (line 290 in `config.py`)
- `MANUAL_PAY_TO_NAME` (line 294 in `config.py`)
- `MANUAL_PAY_TO_NUMBER` (line 295 in `config.py`)

---

### 2.2 Resident Payment Endpoints
**File:** `apps/api/routes/documents.py`

| Method | Endpoint | Line | Purpose | Rate Limit |
|--------|----------|------|---------|------------|
| GET | `/payment-config` | 643 | Get payment methods config | None |
| GET | `/manual-qr-image` | 662 | Serve QR image | None |
| POST | `/requests/<id>/payment-method` | 673 | Select payment method | None |
| POST | `/requests/<id>/manual-payment/proof` | 853 | Upload proof → Send Payment ID | 5/hour |
| POST | `/requests/<id>/manual-payment/resend-id` | 931 | Resend/regenerate Payment ID | 3/hour |
| POST | `/requests/<id>/manual-payment/submit` | 984 | Submit Payment ID for verification | 5/hour |
| GET | `/requests/<id>/manual-payment/proof` | 1033 | Get signed URL for own proof | None |

**Key Features:**
- ✅ Proof stored in Supabase private bucket (`munlinkprivate-files`)
- ✅ Payment ID format: `LASTNAME[0:3] + random3letters + random3digits`
- ✅ Payment ID hashed with bcrypt (secure storage)
- ✅ Constant-time hash comparison (timing attack prevention)
- ✅ Email sent with Payment ID after proof upload
- ✅ Rate limiting on sensitive endpoints

---

### 2.3 Admin Payment Endpoints
**File:** `apps/api/routes/admin.py`

| Method | Endpoint | Line | Purpose |
|--------|----------|------|---------|
| GET | `/admin/documents/requests/<id>/manual-payment/proof` | 3487 | Get signed URL for proof (admin view) |
| POST | `/admin/documents/requests/<id>/manual-payment/approve` | 3519 | Approve manual payment |
| POST | `/admin/documents/requests/<id>/manual-payment/reject` | 3579 | Reject manual payment with notes |

**Admin Approval Logic:**
- ✅ Requires `manual_payment_status == 'submitted'`
- ✅ Requires proof file exists
- ✅ Sets `payment_status = 'paid'` and `paid_at` timestamp
- ✅ Updates `manual_payment_status = 'approved'`
- ✅ Records reviewer (`manual_reviewed_by`, `manual_reviewed_at`)

**Admin Rejection Logic:**
- ✅ Requires reason/notes
- ✅ Sets `manual_payment_status = 'rejected'`
- ✅ Keeps `payment_status = 'pending'` (user can reupload)
- ✅ Records reviewer and notes

---

## 3. Frontend Layer (Resident App) ✅ VERIFIED

### 3.1 API Client
**File:** `apps/web/src/lib/api.ts`

All resident-side payment functions implemented:

| Function | Line | Endpoint |
|----------|------|----------|
| `getPaymentConfig()` | 350 | GET /api/documents/payment-config |
| `setPaymentMethod()` | 351 | POST /api/documents/requests/<id>/payment-method |
| `createPaymentIntent()` | 353 | POST /api/documents/requests/<id>/payment-intent |
| `confirmPayment()` | 354 | POST /api/documents/requests/<id>/confirm-payment |
| `uploadManualPaymentProof()` | 356 | POST /api/documents/requests/<id>/manual-payment/proof |
| `resendManualPaymentId()` | 361 | POST /api/documents/requests/<id>/manual-payment/resend-id |
| `submitManualPaymentId()` | 363 | POST /api/documents/requests/<id>/manual-payment/submit |
| `getManualPaymentProof()` | 365 | GET /api/documents/requests/<id>/manual-payment/proof |
| `getManualQrImage()` | 367 | GET /api/documents/manual-qr-image |

---

### 3.2 Payment Form Component
**File:** `apps/web/src/components/PaymentForm.tsx`

**Component Props:**
- `requestId`: number
- `amount`: number
- `paymentMethod`: 'stripe' | 'manual_qr'
- `manualPaymentStatus`: string | null
- `manualPaymentLast4`: string | null
- `manualReviewNotes`: string | null
- `disabled`: boolean
- `onPaid`: callback function

**Key Features Implemented:**

#### 3.2.1 Payment Method Selector (lines 316-342)
- ✅ Two buttons: "Card (Stripe)" and "Manual QR"
- ✅ Disabled if method not available
- ✅ Locked after manual payment submitted
- ✅ Shows error messages

#### 3.2.2 Stripe Flow (lines 344-378)
- ✅ Shows unavailability message if Stripe down
- ✅ "Start payment" button
- ✅ Stripe Elements integration
- ✅ Payment confirmation
- ✅ Error handling

#### 3.2.3 Manual QR Flow (lines 382-479)
**State Management:**
- ✅ QR image display (lines 386-390)
- ✅ Payment instructions display (lines 391-393)
- ✅ Pay-to number and name display (lines 394-402)

**Status: not_started / rejected** (lines 411-428)
- ✅ File input (accepts .jpg, .jpeg, .png, .pdf)
- ✅ "Upload proof" button
- ✅ Shows rejection reason if rejected

**Status: proof_uploaded / id_sent** (lines 430-461)
- ✅ Shows "Payment ID sent to email" message
- ✅ Shows last 4 digits of Payment ID
- ✅ Text input for Payment ID
- ✅ "Submit Payment ID" button
- ✅ "Resend ID" button

**Status: submitted** (lines 463-467)
- ✅ Shows "Awaiting admin confirmation" message

---

## 4. Frontend Layer (Admin App) ✅ VERIFIED

### 4.1 Admin API Client
**File:** `apps/admin/src/lib/api.ts`

Admin manual payment functions implemented:

| Function | Line | Endpoint |
|----------|------|----------|
| `getManualPaymentProof()` | 647 | GET /api/admin/documents/requests/<id>/manual-payment/proof |
| `approveManualPayment()` | 649 | POST /api/admin/documents/requests/<id>/manual-payment/approve |
| `rejectManualPayment()` | 651 | POST /api/admin/documents/requests/<id>/manual-payment/reject |

---

### 4.2 Document Requests Page
**File:** `apps/admin/src/pages/Requests.tsx`

**Manual Payment Display:**
- ✅ Shows payment method and manual status (line 470)
- ✅ Shows manual status in request details

**Manual Payment Review UI (lines 541-566):**
- ✅ Conditional rendering when `manual_payment_status === 'submitted'`
- ✅ "Approve Payment" button (green)
- ✅ "Reject Payment" button (red)
- ✅ "View Proof" button (opens signed URL in new tab)

**Handler Functions:**
- ✅ `handleViewPaymentProof()` (line 173) - Opens proof in new tab
- ✅ `handleApproveManualPayment()` (line 186) - Approves payment
- ✅ `openRejectPayment()` (line 199) - Opens reject modal
- ✅ `submitRejectPayment()` (line 204) - Submits rejection with notes

**Reject Modal (lines 743-758):**
- ✅ Modal title: "Reject Manual Payment"
- ✅ Reason textarea (required)
- ✅ Cancel and "Reject Payment" buttons
- ✅ Shows loading state during submission

---

## 5. Payment Workflow Verification ✅

### 5.1 Dual Payment Selection Flow
```
1. User creates document request with fee > 0
2. Frontend fetches /api/documents/payment-config
3. Frontend shows payment method selector
   - Stripe available → "Card (Stripe)" button enabled
   - Manual QR available → "Manual QR" button enabled
4. User selects method
5. Frontend calls /api/documents/requests/<id>/payment-method
6. Backend updates DocumentRequest.payment_method
```

---

### 5.2 Stripe Payment Flow (Existing)
```
1. User clicks "Start payment"
2. Frontend calls /api/documents/requests/<id>/payment-intent
3. Backend creates Stripe PaymentIntent
4. Frontend loads Stripe Elements
5. User enters card details
6. Frontend confirms payment with Stripe
7. Frontend calls /api/documents/requests/<id>/confirm-payment
8. Backend verifies payment and marks as paid
```

**Stripe Maintenance Mode:**
- If Stripe unavailable, returns `{ "error": "stripe_unavailable", ... }`
- Frontend shows "temporarily unavailable" message
- User can switch to Manual QR

---

### 5.3 Manual QR Payment Flow (New)
```
1. User selects "Manual QR" payment method
2. Frontend displays QR image, instructions, pay-to details
3. User pays via mobile banking/e-wallet
4. User uploads payment proof (screenshot/receipt)
   → POST /api/documents/requests/<id>/manual-payment/proof
5. Backend:
   - Saves proof to private Supabase bucket
   - Generates Payment ID (e.g., "SMIxjk728")
   - Hashes Payment ID with bcrypt
   - Stores hash + last4 in database
   - Sends Payment ID to user's email
   - Sets manual_payment_status = 'id_sent'
6. User receives email with Payment ID
7. User enters Payment ID in frontend input
8. User clicks "Submit Payment ID"
   → POST /api/documents/requests/<id>/manual-payment/submit
9. Backend:
   - Constant-time hash comparison
   - If match: Sets manual_payment_status = 'submitted'
   - If mismatch: Returns error
10. Admin sees "Approve Payment" / "Reject Payment" buttons
11. Admin clicks "View Proof" to open signed URL
12. Admin reviews proof:
    - APPROVE → payment_status = 'paid', manual_payment_status = 'approved'
    - REJECT → manual_payment_status = 'rejected' (user can reupload)
```

**Security Features:**
- ✅ Proof stored in private bucket (not publicly accessible)
- ✅ Payment ID hashed (not stored in plaintext)
- ✅ Constant-time hash comparison (timing attack prevention)
- ✅ Rate limiting (5/hour for proof upload, 3/hour for resend)
- ✅ Signed URLs for proof access (time-limited, authenticated)

---

## 6. Fee Change Handling ✅

**Scenario 1: Fee drops to zero (exemption applied)**
- ✅ `payment_status` set to 'waived'
- ✅ Manual payment states cleared
- ✅ Stripe payment states cleared

**Scenario 2: Fee changes while manual payment in progress**
- ✅ `manual_payment_status` set to 'rejected'
- ✅ User must reupload proof for new amount

---

## 7. Configuration Requirements

### 7.1 Environment Variables (Backend)
**File:** `apps/api/config.py`

Required for Manual QR payments:
```bash
MANUAL_QR_IMAGE_PATH=public/qr/payment-qr.jpg
MANUAL_PAYMENT_INSTRUCTIONS="Scan the QR code, pay the exact amount..."
MANUAL_PAY_TO_NAME="Account Name"
MANUAL_PAY_TO_NUMBER="09764859463"
```

Required for Supabase private storage:
```bash
SUPABASE_PRIVATE_BUCKET=munlinkprivate-files
SUPABASE_URL=https://xxx.supabase.co
SUPABASE_SERVICE_KEY=eyJhb...
```

Required for Stripe:
```bash
STRIPE_SECRET_KEY=sk_test_...
STRIPE_PUBLISHABLE_KEY=pk_test_...
```

Required for email (Payment ID):
```bash
SENDGRID_API_KEY=SG...  # Production
# OR for development:
SMTP_SERVER=smtp.gmail.com
SMTP_PORT=587
SMTP_USERNAME=your-email@gmail.com
SMTP_PASSWORD=your-app-password
```

---

## 8. Testing Checklist

### 8.1 Backend Tests
- [ ] Payment config endpoint returns correct structure
- [ ] Stripe available when keys configured
- [ ] Manual QR available when QR image exists
- [ ] Proof upload saves to private bucket
- [ ] Payment ID generated correctly (format: LASTNAME[0:3] + 3letters + 3digits)
- [ ] Payment ID email sent successfully
- [ ] Hash comparison works (correct ID accepted)
- [ ] Hash comparison rejects incorrect ID
- [ ] Admin approval sets payment_status = 'paid'
- [ ] Admin rejection allows reupload

### 8.2 Frontend Tests (Resident)
- [ ] Payment method selector displays both options
- [ ] Stripe button disabled if unavailable
- [ ] Manual QR button disabled if unavailable
- [ ] QR image loads correctly
- [ ] Proof upload shows success message
- [ ] Payment ID input accepts text
- [ ] Submit Payment ID shows success/error
- [ ] Resend ID works correctly
- [ ] Status messages display correctly

### 8.3 Frontend Tests (Admin)
- [ ] Manual payment status shows in request list
- [ ] "Approve Payment" button appears when submitted
- [ ] "Reject Payment" button opens modal
- [ ] "View Proof" opens signed URL
- [ ] Approve sets payment status to paid
- [ ] Reject with notes works correctly

### 8.4 Integration Tests
- [ ] End-to-end Stripe payment flow
- [ ] End-to-end Manual QR payment flow
- [ ] Stripe maintenance fallback to Manual QR
- [ ] Fee change clears manual payment state
- [ ] Payment method switch works correctly

---

## 9. Deployment Readiness

### 9.1 Required Setup Steps

1. **Supabase Private Bucket**
   ```sql
   -- Create bucket (if not exists)
   INSERT INTO storage.buckets (id, name, public)
   VALUES ('munlinkprivate-files', 'munlinkprivate-files', false);

   -- RLS Policy: Authenticated users can read own files
   CREATE POLICY "Authenticated users can read own files"
   ON storage.objects FOR SELECT
   USING (
     bucket_id = 'munlinkprivate-files'
     AND auth.uid()::text = (storage.foldername(name))[1]
   );

   -- RLS Policy: Service role can do anything
   CREATE POLICY "Service role has full access"
   ON storage.objects FOR ALL
   USING (bucket_id = 'munlinkprivate-files');
   ```

2. **Email Configuration**
   - Set up SendGrid API key (production)
   - OR configure SMTP credentials (development)

3. **QR Code Image**
   - Generate payment QR code
   - Place in `public/qr/payment-qr.jpg`
   - OR set `MANUAL_QR_IMAGE_PATH` to absolute path

4. **Environment Variables**
   - Copy all required env vars to `.env`
   - Verify `SUPABASE_PRIVATE_BUCKET` matches bucket name
   - Verify Stripe keys (test mode for staging)

---

## 10. Verification Summary

| Component | Status | Evidence |
|-----------|--------|----------|
| Database migration | ✅ VERIFIED | `20260202_manual_qr_payments` at head |
| DocumentRequest model | ✅ VERIFIED | All 10 manual payment fields present |
| Payment config endpoint | ✅ VERIFIED | Line 643 in `documents.py` |
| Resident payment endpoints | ✅ VERIFIED | 7 endpoints implemented |
| Admin payment endpoints | ✅ VERIFIED | 3 endpoints implemented |
| Resident API client | ✅ VERIFIED | 9 functions implemented |
| Admin API client | ✅ VERIFIED | 3 functions implemented |
| Payment form component | ✅ VERIFIED | Full dual payment UI |
| Admin review UI | ✅ VERIFIED | Approve/reject/view proof |
| Environment config | ✅ VERIFIED | All vars defined in `config.py` |

---

## 11. Conclusion

**Implementation Status:** ✅ **100% COMPLETE**

The dual payment system (Stripe + Manual QR) has been **FULLY IMPLEMENTED** across:
- ✅ Database layer (migration applied, fields present)
- ✅ Backend API (10 endpoints implemented)
- ✅ Frontend resident app (payment form with dual method selection)
- ✅ Frontend admin app (manual payment review UI)
- ✅ Security measures (private storage, hashed IDs, rate limiting)
- ✅ Configuration system (environment variables defined)

**Recommended Next Steps:**
1. Set up Supabase private bucket with RLS policies
2. Configure email system (SendGrid or SMTP)
3. Generate and place QR code image
4. Set environment variables in `.env`
5. Run integration tests (create test document request with fee)
6. Test end-to-end workflow:
   - Resident uploads proof
   - Receives Payment ID email
   - Submits Payment ID
   - Admin approves payment
7. Test Stripe fallback (temporarily disable Stripe)
8. Load test rate limiting on proof upload

**Potential Issues:**
- None identified in code review
- All critical workflows implemented
- Error handling present in all endpoints
- Security measures in place

---

**Report Generated:** February 3, 2026
**Verified By:** Claude Code Agent
**Verification Method:** Comprehensive code inspection

**Files Inspected:**
- `apps/api/models/document.py`
- `apps/api/routes/documents.py`
- `apps/api/routes/admin.py`
- `apps/api/config.py`
- `apps/api/utils/stripe_payment.py`
- `apps/web/src/components/PaymentForm.tsx`
- `apps/web/src/lib/api.ts`
- `apps/admin/src/pages/Requests.tsx`
- `apps/admin/src/lib/api.ts`
- Database migration history

**Total Lines Reviewed:** ~3,500 lines of code
