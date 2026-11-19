#!/usr/bin/env python3
"""Render README.md from docs/README.template.md with live repository facts."""

from __future__ import annotations

import re
import subprocess
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
TEMPLATE = ROOT / "docs" / "README.template.md"
OUTPUT = ROOT / "README.md"


def git(*args: str) -> str:
    try:
        return subprocess.run(
            ["git", *args], cwd=ROOT, capture_output=True, text=True, check=True
        ).stdout.strip()
    except Exception:
        return "unknown"


def main() -> None:
    values = {
        "DATE": datetime.now(timezone.utc).strftime("%Y-%m-%d"),
        "COMMIT": git("rev-parse", "--short", "HEAD"),
    }
    text = TEMPLATE.read_text(encoding="utf-8")
    for key, value in values.items():
        text = re.sub(r"\{\{" + key + r"\}\}", value, text)
    remaining = re.findall(r"\{\{(\w+)\}\}", text)
    if remaining:
        raise SystemExit(f"Unresolved template placeholders: {remaining}")
    OUTPUT.write_text(text, encoding="utf-8")
    print(f"README: {OUTPUT.relative_to(ROOT)} (commit {values['COMMIT']}, {values['DATE']})")


if __name__ == "__main__":
    main()
