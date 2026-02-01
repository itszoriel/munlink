# SMS Notification System - Setup and Troubleshooting Guide

## Overview
MunLink uses a notification outbox system for reliable SMS and email delivery. Notifications are queued in the database and processed by a background worker.

## How It Works

1. **Admin creates announcement/program** → Notification rows created in `notification_outbox` table
2. **Notification worker runs** → Processes pending notifications from outbox
3. **SMS provider sends** → PhilSMS API delivers to users' mobile numbers

## Prerequisites

### 1. SMS Provider Configuration

Edit your `.env` file:

```bash
# Enable PhilSMS provider
SMS_PROVIDER=philsms

# Add your PhilSMS credentials
PHILSMS_API_KEY=your-philsms-api-token
PHILSMS_SENDER_ID=PhilSMS
PHILSMS_BASE_URL=https://dashboard.philsms.com/api/v3
```

**Important**: PhilSMS currently delivers to **Globe/TM/GOMO networks only**. Smart/TNT users will NOT receive SMS. Contact PhilSMS support to enable Smart network delivery.

### 2. User SMS Preferences

By default, SMS notifications are **DISABLED** for all users. Users must enable SMS notifications in their profile:

**Database field**: `users.notify_sms_enabled = TRUE`

**To manually enable SMS for a user**:
```sql
UPDATE users SET notify_sms_enabled = TRUE WHERE id = <user_id>;
```

**Users also need a valid mobile number**:
```sql
UPDATE users SET mobile_number = '09123456789' WHERE id = <user_id>;
```

### 3. Run the Notification Worker

The notification worker **MUST be running** to process queued notifications:

```bash
cd apps/api
python scripts/notification_worker.py
```

**Run continuously (recommended for production)**:
```bash
python scripts/notification_worker.py --interval 10
```

**Process once and exit (testing)**:
```bash
python scripts/notification_worker.py --once
```

**Available options**:
- `--once` - Process one batch then exit
- `--interval <seconds>` - Seconds between batches (default: 10)
- `--max-items <count>` - Max notifications per batch (default: 200)
- `--max-attempts <count>` - Max retry attempts (default: 5)

## Testing SMS Notifications

### Step 1: Verify User Setup

Check user has SMS enabled and valid mobile number:

```sql
SELECT id, first_name, email, mobile_number, notify_sms_enabled, municipality_id, admin_verified
FROM users
WHERE role = 'resident' AND id = <user_id>;
```

Expected:
- `notify_sms_enabled` = TRUE
- `mobile_number` = valid PH number (09XXXXXXXXX format)
- `admin_verified` = TRUE
- `municipality_id` = valid Zambales municipality ID

### Step 2: Create Test Announcement

As admin, create a **PUBLISHED** announcement:
1. Login to admin dashboard
2. Go to Announcements
3. Create new announcement with status = "PUBLISHED"
4. Set scope to match your test user's municipality

### Step 3: Check Notification Outbox

Query the notification outbox table:

```sql
SELECT id, resident_id, channel, event_type, status, attempts, last_error, created_at
FROM notification_outbox
WHERE resident_id = <user_id>
ORDER BY created_at DESC
LIMIT 10;
```

**Expected statuses**:
- `pending` - Waiting to be processed
- `sent` - Successfully delivered
- `failed` - Delivery failed after max attempts
- `skipped` - User preferences disabled or missing data

### Step 4: Run Notification Worker

```bash
cd apps/api
python scripts/notification_worker.py --once
```

Check the output for:
```
[INFO] Processing batch...
[INFO] Processed X notifications
```

### Step 5: Verify SMS Sent

Query the outbox again to check status:

```sql
SELECT id, channel, event_type, status, attempts, last_error
FROM notification_outbox
WHERE resident_id = <user_id> AND channel = 'sms'
ORDER BY created_at DESC;
```

**If status = 'sent'**: SMS was delivered successfully
**If status = 'failed'**: Check `last_error` column for reason
**If status = 'skipped'**: Check user preferences or mobile number

## Cross-Municipality Sharing

When admin creates announcement and shares it with other municipalities, residents from ALL shared municipalities will receive SMS.

**Example**:
- Iba admin creates announcement
- Shares with Masinloc (via `shared_with_municipalities` field)
- Result: Both Iba AND Masinloc residents receive SMS

**How it works**:
1. Announcement created with `municipality_id` = Iba (108)
2. `shared_with_municipalities` = [109] (Masinloc)
3. Notification system queries users where `municipality_id IN (108, 109)`
4. All verified residents in both municipalities get SMS

## Troubleshooting

### Issue: User Not Receiving SMS

**Check 1: SMS Enabled?**
```sql
SELECT notify_sms_enabled FROM users WHERE id = <user_id>;
```
If FALSE, enable it:
```sql
UPDATE users SET notify_sms_enabled = TRUE WHERE id = <user_id>;
```

**Check 2: Valid Mobile Number?**
```sql
SELECT mobile_number FROM users WHERE id = <user_id>;
```
Should be in format: `09XXXXXXXXX` or `639XXXXXXXXX`

**Check 3: User Verified?**
```sql
SELECT admin_verified FROM users WHERE id = <user_id>;
```
Must be TRUE

**Check 4: Notification Queued?**
```sql
SELECT * FROM notification_outbox
WHERE resident_id = <user_id> AND channel = 'sms'
ORDER BY created_at DESC LIMIT 5;
```

**Check 5: Worker Running?**
Run the worker manually and check output:
```bash
python scripts/notification_worker.py --once
```

**Check 6: SMS Provider Configured?**
Check `.env` file has:
- `SMS_PROVIDER=philsms`
- `PHILSMS_API_KEY=<your-key>`

### Issue: Announcements Queue But Programs Don't

This was the original bug - now fixed! Ensure you have the latest code:
- `apps/api/utils/notifications.py` includes `queue_benefit_program_notifications()`
- `apps/api/routes/admin.py` imports and calls this function after program creation

### Issue: PhilSMS Returns Error

Common errors:

**"Invalid API key"**: Check `PHILSMS_API_KEY` in `.env`

**"Insufficient credits"**: Top up your PhilSMS account

**"Invalid recipient"**: Check mobile number format (must be 639XXXXXXXXX)

**"Network not supported"**: User is on Smart/TNT network (PhilSMS limitation)

### Issue: Duplicate Notifications

The system uses dedupe keys to prevent duplicates:
```
{event_type}:{entity_id}:{resident_id}:{channel}
```

If you need to resend, delete the old outbox entry:
```sql
DELETE FROM notification_outbox
WHERE dedupe_key = 'announcement_published:123:456:sms';
```

## Testing Console Mode (Development)

For testing without PhilSMS API:

```bash
# In .env
SMS_PROVIDER=console
```

SMS will be logged to console instead of sent:
```
[SMS console] to=['****6789'] message="Announcement: Test. See details in MunLink."
```

## Monitoring Production

### Check Outbox Health

```sql
-- Pending notifications
SELECT COUNT(*) FROM notification_outbox WHERE status = 'pending';

-- Failed notifications
SELECT COUNT(*) FROM notification_outbox WHERE status = 'failed';

-- Recent failures with errors
SELECT event_type, last_error, COUNT(*) as count
FROM notification_outbox
WHERE status = 'failed' AND created_at > NOW() - INTERVAL '24 hours'
GROUP BY event_type, last_error;
```

### Worker as Systemd Service (Linux Production)

Create `/etc/systemd/system/munlink-notifier.service`:

```ini
[Unit]
Description=MunLink Notification Worker
After=network.target

[Service]
Type=simple
User=munlink
WorkingDirectory=/path/to/apps/api
Environment="PATH=/path/to/venv/bin"
ExecStart=/path/to/venv/bin/python scripts/notification_worker.py --interval 10
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
```

Enable and start:
```bash
sudo systemctl enable munlink-notifier
sudo systemctl start munlink-notifier
sudo systemctl status munlink-notifier
```

## Summary

1. Configure SMS provider in `.env`
2. Enable SMS for users: `notify_sms_enabled = TRUE`
3. Run notification worker: `python scripts/notification_worker.py`
4. Create announcements/programs as admin
5. Monitor `notification_outbox` table
6. Check PhilSMS dashboard for delivery status

For questions, contact Princhprays :>
