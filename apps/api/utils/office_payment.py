"""Office payment verification utilities for pickup documents."""
import random
import string
import bcrypt
from flask import current_app
from apps.api.utils.email_sender import send_email


def generate_office_payment_code() -> str:
    """
    Generate a 6-character alphanumeric code for office payment verification.
    Format: XXXYYY (3 letters + 3 digits) for easy verbal communication.
    Example: 'ABC123'
    """
    letters = ''.join(random.choices(string.ascii_uppercase, k=3))
    digits = ''.join(random.choices(string.digits, k=3))
    return f"{letters}{digits}"


def hash_office_payment_code(code: str) -> str:
    """
    Hash the office payment code using bcrypt.
    Args:
        code: The plaintext 6-character code
    Returns:
        Hashed code string
    """
    code_bytes = code.encode('utf-8')
    salt = bcrypt.gensalt()
    hashed = bcrypt.hashpw(code_bytes, salt)
    return hashed.decode('utf-8')


def verify_office_payment_code(code: str, code_hash: str) -> bool:
    """
    Verify an office payment code against its hash.
    Args:
        code: The plaintext code to verify
        code_hash: The stored hash to check against
    Returns:
        True if code matches hash, False otherwise
    """
    try:
        code_bytes = code.encode('utf-8')
        hash_bytes = code_hash.encode('utf-8')
        return bcrypt.checkpw(code_bytes, hash_bytes)
    except Exception:
        return False


def send_office_payment_code_email(
    to_email: str,
    first_name: str,
    request_number: str,
    code: str,
    amount: float,
    pickup_location: str
) -> bool:
    """
    Send office payment verification code to the resident.
    Args:
        to_email: Recipient email address
        first_name: Resident's first name
        request_number: Document request number
        code: The 6-character payment verification code
        amount: Payment amount
        pickup_location: Office location where payment will be made
    Returns:
        True if email sent successfully, False otherwise
    """
    platform_name = current_app.config.get('APP_NAME', 'MunLink Zambales')
    is_free = amount <= 0

    if is_free:
        subject = f"{platform_name}: Pickup Verification Code for {request_number}"
        code_label = "Your Pickup Verification Code:"
        header_subtitle = "Document Pickup Verification Code"
        amount_line = '<span class="info-value" style="color: #059669; font-weight: bold;">Free - No payment required</span>'
        amount_text = "Free - No payment required"
        instructions_title = "Pickup Instructions:"
        instructions_html = f"""
                <ol>
                    <li>Visit the office at the pickup location shown above</li>
                    <li>Bring this verification code: <strong>{code}</strong></li>
                    <li>Staff will verify your code and release your document</li>
                </ol>"""
        instructions_text = f"""1. Visit the office at the pickup location shown above
2. Bring this verification code: {code}
3. Staff will verify your code and release your document"""
    else:
        subject = f"{platform_name}: Office Payment Code for {request_number}"
        code_label = "Your Payment Verification Code:"
        header_subtitle = "Office Payment Verification Code"
        amount_line = f'<span class="info-value">PHP {amount:.2f}</span>'
        amount_text = f"PHP {amount:.2f}"
        instructions_title = "Payment Instructions:"
        instructions_html = f"""
                <ol>
                    <li>Visit the office at the pickup location shown above</li>
                    <li>Bring this verification code: <strong>{code}</strong></li>
                    <li>Pay the amount: <strong>PHP {amount:.2f}</strong></li>
                    <li>Staff will verify your code and process the payment</li>
                    <li>Collect your document after payment is confirmed</li>
                </ol>"""
        instructions_text = f"""1. Visit the office at the pickup location shown above
2. Bring this verification code: {code}
3. Pay the amount: PHP {amount:.2f}
4. Staff will verify your code and process the payment
5. Collect your document after payment is confirmed"""

    html_content = f"""
<!DOCTYPE html>
<html>
<head>
    <style>
        body {{
            font-family: Arial, sans-serif;
            line-height: 1.6;
            color: #333;
        }}
        .container {{
            max-width: 600px;
            margin: 0 auto;
            padding: 20px;
        }}
        .header {{
            background-color: #1e40af;
            color: white;
            padding: 20px;
            text-align: center;
            border-radius: 5px 5px 0 0;
        }}
        .content {{
            background-color: #f9fafb;
            padding: 30px;
            border: 1px solid #e5e7eb;
        }}
        .code-box {{
            background-color: #fef3c7;
            border: 2px solid #f59e0b;
            border-radius: 5px;
            padding: 20px;
            text-align: center;
            margin: 20px 0;
        }}
        .code {{
            font-size: 32px;
            font-weight: bold;
            letter-spacing: 8px;
            color: #92400e;
            font-family: 'Courier New', monospace;
        }}
        .info-section {{
            background-color: white;
            padding: 15px;
            border-radius: 5px;
            margin: 15px 0;
        }}
        .info-label {{
            font-weight: bold;
            color: #1f2937;
        }}
        .info-value {{
            color: #4b5563;
        }}
        .instructions {{
            background-color: #dbeafe;
            border-left: 4px solid #3b82f6;
            padding: 15px;
            margin: 20px 0;
        }}
        .instructions ol {{
            margin: 10px 0;
            padding-left: 20px;
        }}
        .footer {{
            text-align: center;
            padding: 20px;
            color: #6b7280;
            font-size: 12px;
        }}
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h2 style="margin: 0;">{platform_name}</h2>
            <p style="margin: 5px 0 0 0;">{header_subtitle}</p>
        </div>
        <div class="content">
            <p>Hello {first_name},</p>

            <p>Your document request <strong>{request_number}</strong> has been approved!</p>

            <div class="code-box">
                <p style="margin: 0 0 10px 0; font-size: 14px; color: #92400e;">{code_label}</p>
                <div class="code">{code}</div>
                <p style="margin: 10px 0 0 0; font-size: 12px; color: #92400e;">Keep this code safe and bring it when you visit the office.</p>
            </div>

            <div class="info-section">
                <div style="margin-bottom: 10px;">
                    <span class="info-label">Request Number:</span>
                    <span class="info-value">{request_number}</span>
                </div>
                <div style="margin-bottom: 10px;">
                    <span class="info-label">Fee:</span>
                    {amount_line}
                </div>
                <div>
                    <span class="info-label">Pickup Location:</span>
                    <span class="info-value">{pickup_location}</span>
                </div>
            </div>

            <div class="instructions">
                <p style="margin-top: 0; font-weight: bold;">{instructions_title}</p>
                {instructions_html}
            </div>

            <p style="margin-top: 20px; font-size: 14px; color: #6b7280;">
                <strong>Important:</strong> This code is valid for this transaction only. Do not share it with anyone except the office staff when claiming your document.
            </p>
        </div>
        <div class="footer">
            <p>This is an automated message from {platform_name}.</p>
            <p>If you have questions, please contact your local government office.</p>
        </div>
    </div>
</body>
</html>
"""

    text_content = f"""
{platform_name} - {header_subtitle}

Hello {first_name},

Your document request {request_number} has been approved!

YOUR VERIFICATION CODE: {code}

Request Number: {request_number}
Fee: {amount_text}
Pickup Location: {pickup_location}

{instructions_title.upper()}
{instructions_text}

IMPORTANT: This code is valid for this transaction only. Do not share it with anyone except the office staff when claiming your document.

---
This is an automated message from {platform_name}.
If you have questions, please contact your local government office.
"""

    try:
        send_email(
            to_email=to_email,
            subject=subject,
            html_content=html_content,
            text_content=text_content
        )
        return True
    except Exception as e:
        print(f"Failed to send office payment code email: {e}")
        return False
