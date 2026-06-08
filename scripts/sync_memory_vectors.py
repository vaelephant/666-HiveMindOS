#!/usr/bin/env python3
"""Backfill Qdrant vectors from PostgreSQL memories."""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from memory_layer.knowledge_base.core.db.postgres import close_pool  # noqa: E402
from memory_layer.knowledge_base.core.services.memory_service import sync_vectors  # noqa: E402


def main() -> int:
    parser = argparse.ArgumentParser(description="Sync memory vectors to Qdrant")
    parser.add_argument("--org", default="demo")
    parser.add_argument("--user", default="demo")
    parser.add_argument("--limit", type=int, default=200)
    args = parser.parse_args()

    try:
        result = sync_vectors(args.org, args.user, limit=args.limit)
        print(result)
        return 0 if result.get("available") else 1
    finally:
        close_pool()


if __name__ == "__main__":
    raise SystemExit(main())
