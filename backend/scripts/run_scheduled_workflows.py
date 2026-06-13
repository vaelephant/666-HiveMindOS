#!/usr/bin/env python3
"""执行到期的 YAML 工作流（可挂系统 cron，建议每分钟一次）。"""

from __future__ import annotations

import argparse
import json
import os
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if ROOT not in sys.path:
    sys.path.insert(0, ROOT)

from knowledge_base.core.db.postgres import close_pool
from knowledge_base.core.services.workflow_scheduler import run_scheduled_tick


def main() -> None:
    parser = argparse.ArgumentParser(description="HiveMind 工作流 cron 调度 tick")
    parser.add_argument("--org", default=None, help="仅执行指定 org 的工作流")
    parser.add_argument("--json", action="store_true", help="JSON 输出")
    args = parser.parse_args()

    results = run_scheduled_tick(org_id=args.org)
    if args.json:
        print(json.dumps(results, ensure_ascii=False, indent=2))
    else:
        for r in results:
            status = "ok" if r.get("ok") else "FAIL"
            print(
                f"[{status}] org={r['org_id']} workflow={r['workflow_id']} "
                f"run={r.get('run_id', '—')}"
                + (f" err={r['error']}" if r.get("error") else "")
            )
        print(f"done: {len(results)} workflow(s) fired")
    close_pool()


if __name__ == "__main__":
    main()
