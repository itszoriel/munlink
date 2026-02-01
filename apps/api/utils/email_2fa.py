"""Email 2FA utility for super admin login.

Handles sending 2FA codes via email for super admin authentication.
"""
from flask import current_app

from utils.email_sender import _send_email


def send_2fa_code(to_email: str, code: str, ip_address: str = None) -> None:
    """
    Send a 2FA login verification code via email.

    Args:
        to_email: Recipient email address
        code: The 6-digit verification code
        ip_address: The IP address of the login attempt (optional)
    """
    app = current_app
    app_name = app.config.get('APP_NAME', 'MunLink Zambales')

    subject = f"{app_name} - Super Admin Login Code"

    # Format the code with spaces for readability
    formatted_code = ' '.join(code)

    body = f"""Hello Super Admin,

Someone is attempting to log in to your account.

Your verification code is:

    {formatted_code}

This code expires in 10 minutes.

Login attempt details:
- IP Address: {ip_address or 'Unknown'}
- Time: Now

If you did not attempt to log in, someone may have your password.
Please change it immediately and contact the system administrator.

---
{app_name}
This is an automated message. Do not reply to this email.
"""

    try:
        _send_email(to_email, subject, body)
        current_app.logger.info(f"2FA code sent to {to_email}")
    except Exception as e:
        current_app.logger.error(f"Failed to send 2FA code to {to_email}: {e}")
        raise


def send_login_alert(to_email: str, ip_address: str = None, success: bool = True) -> None:
    """
    Send a login alert email (optional, for security notifications).

    Args:
        to_email: Recipient email address
        ip_address: The IP address of the login attempt
        success: Whether the login was successful
    """
    app = current_app
    app_name = app.config.get('APP_NAME', 'MunLink Zambales')

    if success:
        subject = f"{app_name} - Successful Super Admin Login"
        body = f"""Hello Super Admin,

A successful login to your account was detected.

Login details:
- IP Address: {ip_address or 'Unknown'}
- Time: Now

If this was not you, please change your password immediately.

---
{app_name}
"""
    else:
        subject = f"{app_name} - Failed Login Attempt"
        body = f"""Hello Super Admin,

A failed login attempt to your account was detected.

Attempt details:
- IP Address: {ip_address or 'Unknown'}
- Time: Now

If you did not attempt to log in, someone may be trying to access your account.

---
{app_name}
"""

    try:
        _send_email(to_email, subject, body)
    except Exception as e:
        # Don't fail the main operation if alert email fails
        current_app.logger.warning(f"Failed to send login alert to {to_email}: {e}")
