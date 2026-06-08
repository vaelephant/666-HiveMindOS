#!/usr/bin/env python3
"""列出 prompts.yaml 中所有提示词 key（便于统一管理）。"""

from __future__ import annotations

import os
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if ROOT not in sys.path:
    sys.path.insert(0, ROOT)

from memory_layer.knowledge_base.prompts import get, list_keys

def main() -> None:
    for key in list_keys():
        spec = get(key)
        limits = ", ".join(f"{k}={v}" for k, v in (spec.limits or {}).items())
        model = spec.model or "fast"
        print(f"{key}")
        print(f"  label: {spec.label}")
        print(f"  model: {model}")
        if limits:
            print(f"  limits: {limits}")
        if spec.allowed_types:
            print(f"  types: {', '.join(sorted(spec.allowed_types))}")
        print()

if __name__ == "__main__":
    main()
