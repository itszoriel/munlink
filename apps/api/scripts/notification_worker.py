"""Notification outbox worker.

Runs in a loop (or once with --once) to deliver queued email/SMS notifications.
Delivery logic lives in apps.api.utils.notification_delivery so it can be
shared with the inline flush that runs after admin actions.
"""
from __future__ import annotations

import time
import argparse

try:
    from apps.api.app import create_app
    from apps.api import db
    from apps.api.utils.notification_delivery import process_batch
except ImportError:
    import sys
    from pathlib import Path
    # Ensure parent directory (API root) is in path at the beginning
    # This prevents 'import __init__' in app.py from picking up scripts/__init__.py
    sys.path.insert(0, str(Path(__file__).parent.parent))

    from app import create_app
    from apps.api import db
    from apps.api.utils.notification_delivery import process_batch


MAX_ATTEMPTS_DEFAULT = 5


def run_loop(interval: int = 10, max_items: int = 200, max_attempts: int = MAX_ATTEMPTS_DEFAULT):
    """Run worker continuously."""
    while True:
        try:
            processed = process_batch(max_items=max_items, max_attempts=max_attempts)
            if processed < max_items:
                time.sleep(interval)
        except Exception:
            # Keep running even if a batch fails
            db.session.rollback()
            time.sleep(interval)


def main():
    parser = argparse.ArgumentParser(description="Notification outbox worker")
    parser.add_argument('--once', action='store_true', help='Process a single batch then exit')
    parser.add_argument('--interval', type=int, default=10, help='Seconds to wait between batches (loop mode)')
    parser.add_argument('--max-items', type=int, default=200, help='Max outbox rows per batch')
    parser.add_argument('--max-attempts', type=int, default=MAX_ATTEMPTS_DEFAULT, help='Max retry attempts before marking failed')
    args = parser.parse_args()

    app = create_app()
    with app.app_context():
        if args.once:
            process_batch(max_items=args.max_items, max_attempts=args.max_attempts)
        else:
            run_loop(interval=args.interval, max_items=args.max_items, max_attempts=args.max_attempts)


if __name__ == '__main__':
    main()
