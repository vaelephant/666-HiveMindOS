from datetime import datetime
from pathlib import Path


def write_entity_page(wiki_root: Path, org_id: str, entity: dict) -> str:
    out_dir = wiki_root / org_id / "entities"
    out_dir.mkdir(parents=True, exist_ok=True)
    slug = entity["name"].replace("/", "-").replace(" ", "_")
    filepath = out_dir / f"{slug}.md"
    filepath.write_text(_entity_md(entity), encoding="utf-8")
    return f"entities/{slug}.md"


def write_workflow_page(wiki_root: Path, org_id: str, workflow: dict) -> str:
    out_dir = wiki_root / org_id / "workflows"
    out_dir.mkdir(parents=True, exist_ok=True)
    slug = workflow["name"].replace("/", "-").replace(" ", "_")
    filepath = out_dir / f"{slug}.md"
    filepath.write_text(_workflow_md(workflow), encoding="utf-8")
    return f"workflows/{slug}.md"


def write_rule_page(wiki_root: Path, org_id: str, rule: dict) -> str:
    out_dir = wiki_root / org_id / "glossary"
    out_dir.mkdir(parents=True, exist_ok=True)
    slug = rule["name"].replace("/", "-").replace(" ", "_")
    filepath = out_dir / f"{slug}.md"
    filepath.write_text(_rule_md(rule), encoding="utf-8")
    return f"glossary/{slug}.md"


def _entity_md(e: dict) -> str:
    attrs = e.get("attributes", {})
    attr_rows = "\n".join(f"| {k} | {v} |" for k, v in attrs.items()) if attrs else "_暂无_"
    return f"""# {e['name']}

**类型：** {e['type']}
**更新时间：** {datetime.utcnow().strftime('%Y-%m-%d')}

## 描述

{e.get('description', '暂无描述')}

## 属性

| 属性 | 值 |
|------|-----|
{attr_rows}

## 关联实体

<!-- 由 linker 自动填充 -->
"""


def _workflow_md(wf: dict) -> str:
    steps = "\n".join(f"{i+1}. {s}" for i, s in enumerate(wf.get("steps", [])))
    conditions = "\n".join(f"- {c}" for c in wf.get("conditions", [])) or "_无_"
    participants = "、".join(wf.get("participants", [])) or "_未指定_"
    return f"""# {wf['name']}

**更新时间：** {datetime.utcnow().strftime('%Y-%m-%d')}

## 流程步骤

{steps}

## 规则与条件

{conditions}

## 参与角色

{participants}
"""


def _rule_md(rule: dict) -> str:
    return f"""# {rule['name']}

**更新时间：** {datetime.utcnow().strftime('%Y-%m-%d')}

## 触发条件

{rule.get('condition', '')}

## 执行动作

{rule.get('action', '')}
"""
