"""Email sending utility for verification and notification emails.

Supports both:
- SMTP (for development with Gmail)
- SendGrid API (for production on Render free tier where SMTP is blocked)

The system automatically chooses:
- SendGrid if SENDGRID_API_KEY is configured
- SMTP if SMTP_SERVER is configured (fallback for development)
"""
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
import requests
import json
from flask import current_app


def _send_via_smtp(to_email: str, subject: str, body: str, attachment_data: bytes = None, attachment_name: str = None) -> None:
    """Send email via SMTP (for development with Gmail) with optional PDF attachment."""
    app = current_app
    smtp_server = app.config.get('SMTP_SERVER')
    smtp_port = app.config.get('SMTP_PORT', 587)
    smtp_username = app.config.get('SMTP_USERNAME')
    smtp_password = app.config.get('SMTP_PASSWORD')
    from_email = app.config.get('FROM_EMAIL') or smtp_username
    app_name = app.config.get('APP_NAME', 'MunLink Zambales')

    if not smtp_server:
        raise RuntimeError("SMTP_SERVER is not configured")
    if not smtp_username or not smtp_password:
        raise RuntimeError("SMTP_USERNAME and SMTP_PASSWORD are required for SMTP")
    if not from_email:
        raise RuntimeError("FROM_EMAIL is not configured")

    current_app.logger.info(f"Attempting to send email to {to_email} via SMTP ({smtp_server}:{smtp_port})")

    try:
        from email.mime.application import MIMEApplication

        # Create message
        msg = MIMEMultipart()
        msg['From'] = f"{app_name} <{from_email}>"
        msg['To'] = to_email
        msg['Subject'] = subject
        msg.attach(MIMEText(body, 'plain'))

        # Attach PDF if provided
        if attachment_data and attachment_name:
            pdf_part = MIMEApplication(attachment_data, _subtype='pdf')
            pdf_part.add_header('Content-Disposition', 'attachment', filename=attachment_name)
            msg.attach(pdf_part)

        # Connect and send
        with smtplib.SMTP(smtp_server, smtp_port) as server:
            server.starttls()
            server.login(smtp_username, smtp_password)
            server.sendmail(from_email, to_email, msg.as_string())

        current_app.logger.info(f"Email sent successfully to {to_email} via SMTP")
    except smtplib.SMTPAuthenticationError as e:
        error_msg = f"SMTP authentication failed: {e}"
        current_app.logger.error(error_msg)
        raise RuntimeError(error_msg) from e
    except smtplib.SMTPException as e:
        error_msg = f"SMTP error: {e}"
        current_app.logger.error(error_msg)
        raise RuntimeError(error_msg) from e
    except Exception as e:
        error_msg = f"Failed to send email via SMTP: {e}"
        current_app.logger.error(error_msg)
        raise RuntimeError(error_msg) from e


def _send_via_sendgrid(to_email: str, subject: str, body: str, attachment_data: bytes = None, attachment_name: str = None) -> None:
    """Send email via SendGrid API (works on Render free tier) with optional PDF attachment."""
    import base64
    app = current_app
    api_key = app.config.get('SENDGRID_API_KEY')
    from_email = app.config.get('FROM_EMAIL')
    app_name = app.config.get('APP_NAME', 'MunLink Zambales')

    if not api_key:
        raise RuntimeError("SENDGRID_API_KEY is not configured")

    if not from_email:
        raise RuntimeError("FROM_EMAIL is not configured")

    url = "https://api.sendgrid.com/v3/mail/send"
    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json"
    }
    payload = {
        "personalizations": [{"to": [{"email": to_email}]}],
        "from": {"email": from_email, "name": app_name},
        "subject": subject,
        "content": [{"type": "text/plain", "value": body}]
    }

    # Add PDF attachment if provided
    if attachment_data and attachment_name:
        base64_content = base64.b64encode(attachment_data).decode('utf-8')
        payload["attachments"] = [{
            "content": base64_content,
            "type": "application/pdf",
            "filename": attachment_name,
            "disposition": "attachment"
        }]

    current_app.logger.info(f"Attempting to send email to {to_email} via SendGrid API")

    try:
        response = requests.post(url, headers=headers, json=payload, timeout=30)
        # SendGrid returns 202 Accepted on success
        if response.status_code not in [200, 201, 202]:
            error_msg = f"SendGrid API error: {response.status_code}"
            try:
                error_detail = response.json()
                error_msg += f" - {json.dumps(error_detail)}"
            except:
                error_msg += f" - {response.text[:200]}"
            current_app.logger.error(error_msg)
            raise RuntimeError(error_msg)
        current_app.logger.info(f"Email sent successfully to {to_email} via SendGrid")
    except requests.exceptions.RequestException as e:
        error_msg = f"SendGrid API request failed: {e}"
        current_app.logger.error(error_msg)
        raise RuntimeError(error_msg) from e


def _send_email(to_email: str, subject: str, body: str, attachment_data: bytes = None, attachment_name: str = None) -> None:
    """
    Send email using the best available method with optional PDF attachment.

    Priority:
    1. SendGrid API (if SENDGRID_API_KEY is set) - preferred for production
    2. SMTP (if SMTP_SERVER is set) - for development with Gmail
    """
    app = current_app

    # Check for SendGrid first (production)
    if app.config.get('SENDGRID_API_KEY'):
        current_app.logger.debug("Using SendGrid for email delivery")
        _send_via_sendgrid(to_email, subject, body, attachment_data, attachment_name)
        return

    # Fall back to SMTP (development)
    if app.config.get('SMTP_SERVER'):
        current_app.logger.debug("Using SMTP for email delivery")
        _send_via_smtp(to_email, subject, body, attachment_data, attachment_name)
        return

    # No email provider configured
    raise RuntimeError(
        "No email provider configured. "
        "Set SENDGRID_API_KEY for production or SMTP_SERVER/SMTP_USERNAME/SMTP_PASSWORD for development."
    )


def send_verification_email(to_email: str, verify_link: str) -> None:
    """Send an email verification message with a verification link."""
    app = current_app
    app_name = app.config.get('APP_NAME', 'MunLink Zambales')

    subject = f"Verify your email for {app_name}"
    body = (
        f"Hello,\n\n"
        f"Please verify your email to complete your registration to {app_name}.\n\n"
        f"Click the link below (valid for 24 hours):\n"
        f"{verify_link}\n\n"
        f"If you did not sign up, you can ignore this email.\n\n"
        f"Thank you,\n{app_name} Team"
    )

    try:
        _send_email(to_email, subject, body)
    except Exception as exc:
        current_app.logger.exception("Failed to send verification email to %s: %s", to_email, exc)
        raise


def send_generic_email(to_email: str, subject: str, body: str) -> None:
    """Send a generic email, with fallback to logging if sending fails."""
    try:
        _send_email(to_email, subject, body)
    except Exception:
        try:
            current_app.logger.info("Email (fallback log): to=%s subject=%s body=%s", to_email, subject, body)
        except Exception:
            pass


def send_user_status_email(to_email: str, approved: bool, reason: str | None = None) -> None:
    """Send user registration status email."""
    app = current_app
    app_name = app.config.get('APP_NAME', 'MunLink Zambales')
    if approved:
        subject = f"{app_name}: Registration Approved"
        body = (
            "Your registration has been approved.\n"
            "You can now log in to your account.\n"
        )
    else:
        subject = f"{app_name}: Registration Rejected"
        body = (
            "Your registration has been rejected.\n"
            f"Reason: {reason or 'Not specified.'}\n"
        )
    send_generic_email(to_email, subject, body)


def send_document_request_status_email(to_email: str, doc_name: str, requested_at: str, approved: bool, reason: str | None = None) -> None:
    """Send document request status email."""
    app = current_app
    app_name = app.config.get('APP_NAME', 'MunLink Zambales')
    if approved:
        subject = f"{app_name}: Document Request Approved"
        body = (
            f"Your document request has been approved.\n"
            f"Document: {doc_name}\n"
            f"Date of request: {requested_at}\n"
            "You can now log in to your account.\n"
        )
    else:
        subject = f"{app_name}: Document Request Rejected"
        body = (
            f"Your document request has been rejected.\n"
            f"Document: {doc_name}\n"
            f"Date of request: {requested_at}\n"
            f"Reason: {reason or 'Not specified.'}\n"
        )
    send_generic_email(to_email, subject, body)


def send_admin_welcome_email(to_email: str, admin_name: str, role: str) -> None:
    """Send welcome email to newly created admin with terms and privacy policy PDF.

    Args:
        to_email: Admin's email address
        admin_name: Admin's full name
        role: Admin's role (municipal_admin, barangay_admin, etc.)
    """
    app = current_app
    app_name = app.config.get('APP_NAME', 'MunLink Zambales')

    # Generate PDF
    try:
        from utils.pdf_generator import generate_admin_terms_pdf
        pdf_data = generate_admin_terms_pdf()
    except Exception as e:
        current_app.logger.error(f"Failed to generate admin terms PDF: {e}")
        # Send email without attachment if PDF generation fails
        pdf_data = None

    # Format role for display
    role_display = role.replace('_', ' ').title()

    subject = f"Welcome to {app_name} - Administrative Account Created"
    body = (
        f"Dear {admin_name},\n\n"
        f"Thank you for your interest in joining the {app_name} team!\n\n"
        f"Your administrative account has been successfully created with the role of {role_display}. "
        f"You can now log in to the admin portal using your credentials to begin serving the residents "
        f"of Zambales province.\n\n"
        f"IMPORTANT: Please review the attached Terms of Service and Privacy Policy document. "
        f"By using your administrative account, you agree to comply with all terms outlined in this document, "
        f"including the Data Privacy Act of 2012 (Republic Act No. 10173) and other applicable laws.\n\n"
        f"Your responsibilities include:\n"
        f"• Verifying resident information with care and accuracy\n"
        f"• Processing document requests promptly and fairly\n"
        f"• Managing announcements and communications professionally\n"
        f"• Moderating marketplace listings to ensure community safety\n"
        f"• Handling issue reports with diligence and respect\n"
        f"• Protecting resident privacy and data at all times\n\n"
        f"Please note that all your actions on the platform are logged for security and accountability purposes. "
        f"Violations of the terms may result in serious legal consequences, including criminal prosecution "
        f"under Philippine law.\n\n"
        f"If you have any questions or need assistance, please contact your supervisor or the system administrator.\n\n"
        f"We look forward to working with you to serve the people of Zambales!\n\n"
        f"Best regards,\n"
        f"{app_name} Team"
    )

    try:
        if pdf_data:
            _send_email(to_email, subject, body, pdf_data, "MunLink_Admin_Terms_and_Privacy.pdf")
        else:
            _send_email(to_email, subject, body)
        current_app.logger.info(f"Admin welcome email sent to {to_email}")
    except Exception as e:
        current_app.logger.error(f"Failed to send admin welcome email to {to_email}: {e}")
        raise
