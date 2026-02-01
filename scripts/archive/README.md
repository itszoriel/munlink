# Archived scripts

These are one-off or heavy diagnostics kept for reference. They aren’t needed for day-to-day dev or Railway deploys.

- `psgc_sync.py`: PSGC Excel sync to dev/prod + regenerates location JSON/TS. Contains hardcoded connection strings; use only if you intentionally re-sync PSGC data.
- `database_manager.py`, `db_manager.ps1`, `quick_db_ops.py`: Legacy SQLite user/db maintenance utilities.
- `diagnose_db_connection.py`, `test_supabase_connection.py`: Connection diagnostics for Postgres/Supabase.
- `test_backend.py`, `test_registration.py`, `test_render_api.py`: Ad-hoc HTTP smoke checks for legacy endpoints.

Keep using the live scripts in `scripts/` for startup, networking, and normal dev workflows.
