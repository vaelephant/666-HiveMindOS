#!/usr/bin/env python3
"""批量第二级会话复盘（可挂 cron，建议每日一次）。"""

from __future__ import annotations

import argparse
import os
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if ROOT not in sys.path:
    sys.path.insert(0, ROOT)

from knowledge_base.core.db.postgres import close_pool
from knowledge_base.core.services.memory_service import recap_idle_sessions


def main() -> None:
    parser = argparse.ArgumentParser(description="HiveMind 会话级智慧复盘（L2）")
    parser.add_argument("--org", default="demo")
    parser.add_argument("--user", default="demo")
    parser.add_argument("--limit", type=int, default=10)
    parser.add_argument("--idle-hours", type=int, default=24)
    args = parser.parse_args()

    results = recap_idle_sessions(
        args.org, args.user, idle_hours=args.idle_hours, limit=args.limit,
    )
    for r in results:
        print(
            f"session={r.session_id[:8]}…  updated={len(r.memory_ids)}  "
            f"archived={len(r.archived_ids)}  wiki={len(r.wiki_suggestions)}"
        )
        if r.summary:
            print(f"  summary: {r.summary[:120]}")
    print(f"done: {len(results)} session(s)")
    close_pool()


if __name__ == "__main__":
    main()
