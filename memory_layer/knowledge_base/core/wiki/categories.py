"""Wiki category metadata — server-side registry, not hardcoded in the frontend."""

from __future__ import annotations

# Known folders produced by the compiler. Additional folders on disk are supported
# with fallback labels derived from the folder name.
REGISTRY: dict[str, dict] = {
    "entities": {
        "label": "实体档案",
        "description": "客户、产品、合同、人员",
        "order": 1,
    },
    "workflows": {
        "label": "业务流程",
        "description": "端到端业务链路",
        "order": 2,
    },
    "glossary": {
        "label": "术语规则",
        "description": "政策、阈值、定义",
        "order": 3,
    },
    "decisions": {
        "label": "历史决策",
        "description": "定价与策略记录",
        "order": 4,
    },
}


def category_meta(key: str) -> dict:
    known = REGISTRY.get(key)
    if known:
        return {"key": key, **known}
    return {
        "key": key,
        "label": key,
        "description": "",
        "order": 99,
    }
