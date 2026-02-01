#!/usr/bin/env python3
"""Test script for PhilSMS API v3 SMS sending.

Usage:
    python -m apps.api.scripts.test_philsms_send --number 09511378115 [--confirm]
    python -m apps.api.scripts.test_philsms_send --number +639511378115 --message "Custom test" --confirm

WARNING: Only use with phone numbers you own or have explicit consent to message.

Environment variables required:
    PHILSMS_API_KEY      - Your PhilSMS API token (required)
    PHILSMS_BASE_URL     - API base URL (optional, defaults to https://app.philsms.com/api/v3)
    PHILSMS_SENDER_ID    - Sender name (optional, recommended)

Exit codes:
    0   - Success (200-299 response)
    1   - Configuration error (missing API key, invalid args)
    2   - API error (non-2xx response)
    3   - Network error
"""
import os
import sys
import argparse
import requests
from typing import Optional
from pathlib import Path

# Try to load .env file if it exists
try:
    from dotenv import load_dotenv
    # Look for .env in project root (3 levels up from this script)
    env_path = Path(__file__).parent.parent.parent.parent / '.env'
    if env_path.exists():
        load_dotenv(env_path)
except ImportError:
    pass  # dotenv not installed, assume env vars are set manually


def normalize_ph_number(number: str) -> str:
    """
    Normalize Philippine phone number to E.164 format (+639XXXXXXXXX).

    Accepts:
        - 09XXXXXXXXX (11 digits starting with 09)
        - +639XXXXXXXXX (already E.164 format)
        - 639XXXXXXXXX (without + prefix)

    Raises:
        ValueError: If number format is invalid
    """
    # Strip whitespace and common separators
    cleaned = ''.join(ch for ch in number if ch.isdigit() or ch == '+')

    if cleaned.startswith('+639') and len(cleaned) == 13:
        # Already in E.164 format: +639XXXXXXXXX
        return cleaned

    if cleaned.startswith('639') and len(cleaned) == 12:
        # Missing + prefix: 639XXXXXXXXX
        return f'+{cleaned}'

    if cleaned.startswith('09') and len(cleaned) == 11:
        # Local format: 09XXXXXXXXX -> +639XXXXXXXXX
        return f'+63{cleaned[1:]}'

    # Invalid format
    raise ValueError(
        f"Invalid Philippine phone number format: {number}\n"
        "Expected formats:\n"
        "  - 09XXXXXXXXX (11 digits)\n"
        "  - +639XXXXXXXXX (E.164)\n"
        "  - 639XXXXXXXXX (without +)"
    )


def send_sms_via_philsms(
    api_key: str,
    base_url: str,
    recipient: str,
    message: str,
    sender_id: Optional[str] = None,
    timeout: int = 15,
    dry_run: bool = True,
) -> dict:
    """
    Send SMS via PhilSMS API v3.

    Args:
        api_key: PhilSMS API token
        base_url: API base URL
        recipient: Normalized phone number (+639XXXXXXXXX)
        message: SMS content
        sender_id: Optional sender name
        timeout: Request timeout in seconds
        dry_run: If True, only simulate the request

    Returns:
        dict with keys: success (bool), status_code (int), response (dict/str), error (str)
    """
    endpoint = f"{base_url.rstrip('/')}/sms/send"

    headers = {
        'Authorization': f'Bearer {api_key}',
        'Content-Type': 'application/json',
        'Accept': 'application/json',
    }

    # PhilSMS API v3 required fields per documentation
    payload = {
        'recipient': recipient,
        'message': message,
        'type': 'plain',  # Use 'plain' for standard SMS (or 'unicode' for special chars)
    }

    # Add sender_id if provided (recommended but optional)
    if sender_id:
        payload['sender_id'] = sender_id

    if dry_run:
        return {
            'success': True,
            'status_code': None,
            'response': '[DRY RUN - No actual request sent]',
            'error': None,
            'request': {
                'url': endpoint,
                'headers': {k: v if k != 'Authorization' else f'Bearer ***{api_key[-4:]}' for k, v in headers.items()},
                'payload': payload,
            }
        }

    try:
        response = requests.post(
            endpoint,
            json=payload,
            headers=headers,
            timeout=timeout
        )

        # Try to parse JSON response
        try:
            response_data = response.json()
        except Exception:
            response_data = response.text

        success = 200 <= response.status_code < 300

        return {
            'success': success,
            'status_code': response.status_code,
            'response': response_data,
            'error': None if success else f'HTTP {response.status_code}',
        }

    except requests.exceptions.Timeout:
        return {
            'success': False,
            'status_code': None,
            'response': None,
            'error': f'Request timeout after {timeout}s',
        }
    except requests.exceptions.RequestException as exc:
        return {
            'success': False,
            'status_code': None,
            'response': None,
            'error': f'Network error: {exc}',
        }


def main():
    parser = argparse.ArgumentParser(
        description='Test PhilSMS API v3 SMS sending',
        epilog='WARNING: Only use with phone numbers you own or have explicit consent to message.',
        formatter_class=argparse.RawDescriptionHelpFormatter,
    )

    parser.add_argument(
        '--number',
        required=True,
        help='Recipient phone number (e.g., 09511378115 or +639511378115)'
    )
    parser.add_argument(
        '--message',
        default='MunLink test message',
        help='SMS content (default: "MunLink test message")'
    )
    parser.add_argument(
        '--confirm',
        action='store_true',
        help='Actually send the SMS (without this flag, dry-run mode is used)'
    )
    parser.add_argument(
        '--timeout',
        type=int,
        default=15,
        help='Request timeout in seconds (default: 15)'
    )

    args = parser.parse_args()

    # Print warning
    print("=" * 70)
    print("WARNING: Only use with phone numbers you own or have consent to message.")
    print("=" * 70)
    print()

    # Load environment variables
    api_key = os.getenv('PHILSMS_API_KEY')
    base_url = os.getenv('PHILSMS_BASE_URL', 'https://dashboard.philsms.com/api/v3')
    sender_id = os.getenv('PHILSMS_SENDER_ID', '')

    if not api_key:
        print("ERROR: PHILSMS_API_KEY environment variable is not set.")
        print("Please set it in your .env file or export it:")
        print("  export PHILSMS_API_KEY='your-api-token-here'")
        return 1

    # Normalize phone number
    try:
        normalized_number = normalize_ph_number(args.number)
    except ValueError as exc:
        print(f"ERROR: {exc}")
        return 1

    # Print configuration
    mode = "DRY RUN" if not args.confirm else "LIVE SEND"
    print(f"Mode: {mode}")
    print(f"API Base URL: {base_url}")
    print(f"API Key: ***{api_key[-4:] if len(api_key) > 4 else '***'}")
    print(f"Sender ID: {sender_id or '(not set)'}")
    print(f"Recipient: {normalized_number}")
    print(f"Message: {args.message}")
    print(f"Timeout: {args.timeout}s")
    print()

    if not args.confirm:
        print("NOTE: This is a DRY RUN. Use --confirm to actually send the SMS.")
        print()

    # Send SMS
    result = send_sms_via_philsms(
        api_key=api_key,
        base_url=base_url,
        recipient=normalized_number,
        message=args.message,
        sender_id=sender_id,
        timeout=args.timeout,
        dry_run=not args.confirm,
    )

    # Print results
    print("-" * 70)
    print("RESULT:")
    print("-" * 70)

    if 'request' in result:
        print(f"Would send to: {result['request']['url']}")
        print(f"Payload: {result['request']['payload']}")
        print()

    if result['status_code'] is not None:
        print(f"HTTP Status: {result['status_code']}")

    if result['error']:
        print(f"Error: {result['error']}")

    if result['response']:
        print(f"Response:")
        if isinstance(result['response'], dict):
            import json
            print(json.dumps(result['response'], indent=2))
        else:
            print(result['response'])

    print("-" * 70)

    if result['success']:
        print("\n[SUCCESS]")
        print("\nIMPORTANT: API returned success, but this doesn't guarantee delivery.")
        print("Check your phone to confirm SMS arrival.")
        print("Note: Some SMS providers have carrier-specific limitations:")
        print("  - PhilSMS may work better with Globe/TM/GOMO networks")
        print("  - Smart/TNT delivery may require additional approval")
        print("  - Check PhilSMS dashboard for actual delivery status")
        return 0
    else:
        print("\n[FAILED]")
        if result['status_code'] is not None:
            return 2  # API error
        else:
            return 3  # Network error


if __name__ == '__main__':
    sys.exit(main())
