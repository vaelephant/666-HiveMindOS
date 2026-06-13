"""model_layer 配置加载器。"""

from __future__ import annotations

from functools import lru_cache
from pathlib import Path
from typing import Any

import yaml

_SETTINGS_DIR = Path(__file__).parent


@lru_cache(maxsize=4)
def load(name: str = "models") -> dict[str, Any]:
    path = _SETTINGS_DIR / f"{name}.yaml"
    if not path.is_file():
        raise FileNotFoundError(f"model_layer 配置文件不存在: {path}")
    data = yaml.safe_load(path.read_text(encoding="utf-8")) or {}
    return data


def reload(name: str | None = None) -> None:
    del name
    load.cache_clear()
