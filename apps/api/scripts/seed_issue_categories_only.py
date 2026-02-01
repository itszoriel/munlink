#!/usr/bin/env python3
"""
Seed only issue categories without touching other data.
"""
import sys
import os

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
PROJECT_ROOT = os.path.abspath(os.path.join(SCRIPT_DIR, '../../..'))
if PROJECT_ROOT not in sys.path:
    sys.path.insert(0, PROJECT_ROOT)

from apps.api.app import create_app
from apps.api import db

try:
    from apps.api.scripts.seed_data import seed_issue_categories
except Exception as e:
    print(f"Error importing seed_issue_categories: {e}")
    sys.exit(1)


def main():
    app = create_app()
    with app.app_context():
        print("Seeding issue categories only...")
        try:
            seed_issue_categories()
            print("✓ Issue categories seeded")
        except Exception as e:
            db.session.rollback()
            print(f"Failed to seed issue categories: {e}")
            sys.exit(1)


if __name__ == '__main__':
    main()


