#!/usr/bin/env python3
"""
Inspect and list current MunLink Region 3 database contents.

Outputs:
- Municipalities (id, name, slug, barangays_count)
- Admin users (id, username, email, municipality)
- Document types (code, name, authority)
- Benefit programs per municipality (code, name, type, amount)
- Key table counts (issues, marketplace, announcements, transfers, tokens)
"""

import sys
import os
from collections import defaultdict

# Ensure project root is importable
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
PROJECT_ROOT = os.path.abspath(os.path.join(SCRIPT_DIR, '../../..'))
if PROJECT_ROOT not in sys.path:
    sys.path.insert(0, PROJECT_ROOT)

from apps.api.app import create_app
from apps.api import db
from apps.api.models.municipality import Municipality, Barangay
from apps.api.models.user import User
from apps.api.models.document import DocumentType, DocumentRequest
from apps.api.models.benefit import BenefitProgram, BenefitApplication
from sqlalchemy.exc import OperationalError as SAOperationalError
from apps.api.models.issue import Issue, IssueCategory
from apps.api.models.marketplace import Item, Transaction
from apps.api.models.announcement import Announcement
from apps.api.models.transfer import TransferRequest
from apps.api.models.token_blacklist import TokenBlacklist


def human_amount(v):
    try:
        return f"{float(v):.2f}"
    except Exception:
        return "-"


def main():
    app = create_app()
    with app.app_context():
        print("\n" + "=" * 64)
        print("MUNLINK REGION 3 - DATABASE INSPECTION")
        print("=" * 64 + "\n")

        # Municipalities
        municipalities = Municipality.query.order_by(Municipality.name.asc()).all()
        print(f"Municipalities: {len(municipalities)}")
        for m in municipalities:
            brgy_count = Barangay.query.filter_by(municipality_id=m.id).count()
            print(f"  - [{m.id}] {m.name} (slug={m.slug}) barangays={brgy_count}")
        print()

        # Admin users
        admins = User.query.filter_by(role='municipal_admin').order_by(User.username.asc()).all()
        print(f"Admin users: {len(admins)}")
        for u in admins:
            muni = None
            try:
                if u.admin_municipality_id:
                    muni = Municipality.query.get(u.admin_municipality_id)
                elif u.municipality_id:
                    muni = Municipality.query.get(u.municipality_id)
            except Exception:
                muni = None
            muni_name = muni.name if muni else 'N/A'
            print(f"  - [{u.id}] {u.username} <{u.email}> muni={muni_name}")
        print()

        # Document types
        docs = DocumentType.query.order_by(DocumentType.code.asc()).all()
        print(f"Document types: {len(docs)}")
        for d in docs:
            print(f"  - {d.code}: {d.name} (authority={d.authority_level})")
        print()

        # Benefit programs grouped by municipality
        try:
            programs = BenefitProgram.query.order_by(BenefitProgram.code.asc()).all()
            by_muni = defaultdict(list)
            for p in programs:
                by_muni[p.municipality_id].append(p)
            print(f"Benefit programs: {len(programs)}")
            for m in municipalities:
                group = by_muni.get(m.id, [])
                print(f"  {m.name}: {len(group)}")
                for p in group:
                    print(f"    - {p.code}: {p.name} [{p.program_type}] amount={human_amount(p.benefit_amount)}")
            print()
        except SAOperationalError:
            print("Benefit programs: skipped (schema mismatch)")
            print()

        # Key table counts
        print("Key table counts:")
        print(f"  Issue categories: {IssueCategory.query.count()}")
        print(f"  Issues: {Issue.query.count()}")
        print(f"  Document requests: {DocumentRequest.query.count()}")
        print(f"  Benefit applications: {BenefitApplication.query.count()}")
        print(f"  Marketplace items: {Item.query.count()}")
        print(f"  Transactions: {Transaction.query.count()}")
        print(f"  Announcements: {Announcement.query.count()}")
        print(f"  Transfer requests: {TransferRequest.query.count()}")
        print(f"  Token blacklist entries: {TokenBlacklist.query.count()}")
        print()

        print("Inspection complete.\n")


if __name__ == '__main__':
    main()


