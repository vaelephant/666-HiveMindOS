#!/usr/bin/env python3
"""列出 settings/*.yaml 业务配置（便于统一管理）。"""

from __future__ import annotations

import os
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if ROOT not in sys.path:
    sys.path.insert(0, ROOT)

from memory_layer.knowledge_base import config
from memory_layer.knowledge_base.settings import load


def main() -> None:
    names = sorted(p.stem for p in config.SETTINGS_DIR.glob("*.yaml"))
    for name in names:
        cfg = load(name)
        print(f"{name}.yaml")
        for key, value in cfg.items():
            if isinstance(value, dict):
                print(f"  {key}: {len(value)} keys")
            elif isinstance(value, list):
                print(f"  {key}: {len(value)} items")
            else:
                print(f"  {key}: {value}")
        print()


if __name__ == "__main__":
    main()
