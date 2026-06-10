#!/usr/bin/env python3
"""列出业务配置 yaml（知识沉淀层 + 自主任务引擎）。"""

from __future__ import annotations

import os
import sys
from pathlib import Path

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if ROOT not in sys.path:
    sys.path.insert(0, ROOT)

from agent_engine.settings import load as load_agent
from memory_layer.knowledge_base import config
from memory_layer.knowledge_base.settings import load as load_kb
from model_layer.registry import list_profiles, startup_report
from model_layer.settings.loader import load as load_models


def _print_cfg(label: str, name: str, cfg: dict) -> None:
    print(f"[{label}] {name}.yaml")
    for key, value in cfg.items():
        if isinstance(value, dict):
            print(f"  {key}: {len(value)} keys")
        elif isinstance(value, list):
            print(f"  {key}: {len(value)} items")
        else:
            print(f"  {key}: {value}")
    print()


def main() -> None:
    print("=== model_layer (模型注册表) ===\n")
    models_cfg = load_models("models")
    _print_cfg("Model", "models", models_cfg)
    print("Resolved profiles:")
    for pid, prof in sorted(list_profiles().items()):
        extra = f" dim={prof.dim}" if prof.dim else ""
        print(f"  {pid}: {prof.provider}/{prof.model}{extra}")
    warnings = startup_report()
    if warnings:
        print("\nWarnings:")
        for w in warnings:
            print(f"  ! {w}")
    print()

    print("=== memory_layer (知识沉淀) ===\n")
    for path in sorted(config.SETTINGS_DIR.glob("*.yaml")):
        _print_cfg("KB", path.stem, load_kb(path.stem))

    agent_dir = Path(ROOT) / "agent_engine" / "settings"
    print("=== agent_engine (自主任务) ===\n")
    for path in sorted(agent_dir.glob("*.yaml")):
        _print_cfg("Agent", path.stem, load_agent(path.stem))
    rubrics = agent_dir / "rubrics"
    if rubrics.is_dir():
        for path in sorted(rubrics.glob("*.yaml")):
            import yaml
            data = yaml.safe_load(path.read_text(encoding="utf-8")) or {}
            _print_cfg("Agent/rubrics", path.stem, data)


if __name__ == "__main__":
    main()
