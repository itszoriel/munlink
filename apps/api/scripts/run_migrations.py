"""
Helper script to apply all Alembic migrations using the current environment.
Usage: set DATABASE_URL (and optional FLASK_APP) then run this file.
"""
import os
import subprocess
import sys
from pathlib import Path


def main() -> int:
    env = os.environ.copy()
    env.setdefault("FLASK_APP", "app:create_app")

    api_dir = Path(__file__).resolve().parents[1]
    cmd = [sys.executable, "-m", "flask", "db", "upgrade"]

    result = subprocess.run(cmd, cwd=api_dir, env=env)
    return result.returncode


if __name__ == "__main__":
    sys.exit(main())
