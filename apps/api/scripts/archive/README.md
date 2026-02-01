# Archived maintenance scripts

These scripts were used for one-off data cleanups and Region 3 migrations. They are kept here for reference but are not part of the normal deploy/run flow. Only run them if you intentionally need to repeat the related migration or investigation.

Highlights:
- `check_*`, `compare_*`, `export_*`: ad-hoc validation of PSGC/location data.
- `fix_*`, `add_*`, `verify_*`: one-time data repairs (barangay/municipality slug and ID fixes).
- `reassign_benefit_programs.py`: single migration to move benefit program ownership.
- `inspect_psgc_file.py`, `analyze_id_impact.py`: inspection/analysis helpers.

Core operational scripts remain in `apps/api/scripts/` (seeding, setup, RLS fixes, admin creation, etc.).
