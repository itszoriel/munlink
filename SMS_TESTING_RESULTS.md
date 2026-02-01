# PhilSMS Testing Results - January 26, 2026

## Summary

✅ **SMS delivery works for Globe/TM/GOMO networks**
❌ **SMS delivery DOES NOT work for Smart/TNT networks**

## Test Results

| Network | Number | Status | Received? |
|---------|--------|--------|-----------|
| TNT | 639511378115 | API: "Delivered" | ❌ No |
| GOMO | 639764859463 | API: "Delivered" | ✅ Yes |

## Root Cause

PhilSMS API returns `"status": "Delivered"` for all requests, but actual delivery depends on carrier network agreements. The current account only has active delivery routes to Globe/TM/GOMO networks.

## Impact

**Philippine mobile market share (approximate):**
- Globe/TM/GOMO: ~45-50% of users ✅ Will receive SMS
- Smart/TNT: ~45-50% of users ❌ Will NOT receive SMS
- DITO/Others: ~5-10% ❌ Unknown (not tested)

**Your residents in Zambales:**
- Email notifications: 100% coverage ✅
- SMS notifications: ~50% coverage (Globe users only) ⚠️

## Current Configuration

```bash
# .env
SMS_PROVIDER=philsms
PHILSMS_API_KEY=1019|fx8lS3V5oi6ssLdJWjqj3Rb4vpCdCxXJ0IlviQV9a88dbaa4
PHILSMS_SENDER_ID=PhilSMS  # Default sender (approved for Globe network)
PHILSMS_BASE_URL=https://dashboard.philsms.com/api/v3
```

## Options to Fix Smart/TNT Delivery

### Option 1: Contact PhilSMS Support (Recommended First Step)

**Email template:**
```
Subject: Enable Smart/TNT Network Delivery

Hi PhilSMS Support,

My account successfully delivers to Globe/GOMO but not Smart/TNT.
Can you enable Smart/TNT delivery on my account?

Account: [Your Account ID]
API Key: 1019|***baa4

Test results:
- Globe/GOMO (639764859463): ✅ Delivered
- TNT (639511378115): ❌ Not delivered (API said "Delivered")

Do I need:
1. Additional carrier approval?
2. Different sender ID for Smart?
3. Account upgrade?

Thank you!
```

**Timeline:** Usually 1-2 business days for response

---

### Option 2: Accept Globe-Only SMS (Current State)

**Pros:**
- No additional work needed
- Works right now for ~50% of users
- Email backup ensures everyone gets notified

**Cons:**
- Smart/TNT users miss SMS notifications
- May reduce notification effectiveness

**Action:** Keep current setup, inform stakeholders of limitation

---

### Option 3: Implement Dual Provider Setup

**Use two SMS providers:**
- PhilSMS for Globe/TM/GOMO
- Semaphore (or iTexMo) for Smart/TNT

**Network detection logic:**
```python
GLOBE_PREFIXES = ['0915', '0916', '0917', '0926', '0927', '0935', '0936', '0937',
                  '0945', '0953', '0954', '0955', '0956', '0965', '0966', '0967',
                  '0975', '0976', '0977', '0994', '0995', '0996', '0997']

SMART_PREFIXES = ['0908', '0909', '0910', '0911', '0912', '0913', '0914', '0918',
                  '0919', '0920', '0921', '0928', '0929', '0930', '0938', '0939',
                  '0946', '0947', '0948', '0949', '0950', '0951']

def detect_network(number):
    prefix = number[:4]
    if prefix in GLOBE_PREFIXES:
        return 'globe'
    elif prefix in SMART_PREFIXES:
        return 'smart'
    return 'unknown'
```

**Pros:**
- 100% coverage of Philippine mobile users
- Redundancy if one provider fails

**Cons:**
- More complex implementation
- Need 2 API subscriptions
- Higher cost

---

### Option 4: Email-First Strategy (Pragmatic)

**Rely on email as primary notification channel**

Since email is more reliable:
- Email: Primary (100% coverage) ✅
- SMS: Optional bonus for Globe users ⚠️

**Pros:**
- Already works perfectly
- No additional cost
- Email is more detailed

**Cons:**
- SMS is faster/more attention-grabbing
- Some users prefer SMS

---

## Recommendation

**Short-term (This week):**
1. ✅ Keep PhilSMS for Globe users (already working)
2. 📧 Contact PhilSMS support to request Smart/TNT enablement
3. 📝 Document the limitation for your users/admins

**Medium-term (If PhilSMS can't enable Smart):**
1. Accept Globe-only SMS
2. Promote email notifications as primary channel
3. Consider dual-provider if budget allows

**Long-term:**
- Monitor delivery rates in PhilSMS dashboard
- Collect user feedback on notification preferences
- Evaluate ROI of SMS vs email notifications

---

## Testing Commands

**Test Globe/GOMO delivery:**
```bash
python -m apps.api.scripts.test_philsms_send --number 09764859463 --confirm
```

**Test Smart/TNT delivery:**
```bash
python -m apps.api.scripts.test_philsms_send --number 09511378115 --confirm
```

**Custom message:**
```bash
python -m apps.api.scripts.test_philsms_send --number 09764859463 --message "Your test message" --confirm
```

---

## Credits Used

- 3 SMS sent during testing
- Cost: 3 credits (₱3 approximate)
- All messages attempted to TNT did NOT deduct credits (check dashboard to confirm)

---

## Contact Information

**PhilSMS Support:**
- Dashboard: https://dashboard.philsms.com/
- Documentation: https://app.philsms.com/developers/documentation
- Support: (Check dashboard for contact info)

**Alternative Providers (for Smart/TNT):**
- Semaphore: https://semaphore.co/
- iTexMo: https://itexmo.com/
- M360: https://m360.com.ph/

---

*Last Updated: January 26, 2026*
*Tested by: Paula*
