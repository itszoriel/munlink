"""UTC time helpers (timezone-aware calculation, naive storage)."""
from __future__ import annotations

from datetime import datetime, timezone, date


def utc_now() -> datetime:
    """Return a UTC timestamp without tzinfo for legacy DB columns."""
    return datetime.now(timezone.utc).replace(tzinfo=None)


def utc_today() -> date:
    """Return today's date in UTC (naive)."""
    return utc_now().date()
