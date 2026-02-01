"""
Simple SMTP test script

Usage:
  python apps/api/scripts/test_email.py recipient@example.com
"""
import sys

try:
    from apps.api.app import create_app
except Exception:
    from app import create_app


def main() -> int:
    if len(sys.argv) < 2:
        print("Usage: python apps/api/scripts/test_email.py recipient@example.com")
        return 2

    to_email = sys.argv[1]
    app = create_app()
    with app.app_context():
        try:
            from apps.api.utils.email_sender import send_generic_email
        except Exception:
            from utils.email_sender import send_generic_email

        subj = f"{app.config.get('APP_NAME', 'MunLink Region 3')} SMTP Test"
        body = (
            "This is a test email to confirm SMTP configuration.\n\n"
            f"From: {app.config.get('FROM_EMAIL')}\n"
            f"Server: {app.config.get('SMTP_SERVER')}:{app.config.get('SMTP_PORT')}\n"
        )

        try:
            send_generic_email(to_email, subj, body)
            print("OK: Test email sent. Check the recipient inbox/spam.")
            return 0
        except Exception as e:
            print(f"ERROR: Failed to send test email: {e}")
            return 1


if __name__ == "__main__":
    raise SystemExit(main())


