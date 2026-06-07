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


def _clean_attrs(raw: dict) -> dict:
    """Remove placeholder/empty values the LLM returns when it can't find data."""
    result = {}
    for k, v in raw.items():
        if v is None or v == {} or v == [] or str(v).strip() in ("", "{}", "[]", "null", "N/A", "无", "—"):
            continue
        result[k] = v
    return result


def _entity_md(e: dict) -> str:
    attrs = _clean_attrs(e.get("attributes", {}))
    attr_section = (
        "| 属性 | 值 |\n|------|-----|\n"
        + "\n".join(f"| {k} | {v} |" for k, v in attrs.items())
        if attrs else "_暂无_"
    )

    relations = e.get("relations", [])
    rel_lines = "\n".join(
        f"- [{r['target']}](../entities/{r['target'].replace('/', '-')}.md) · {r['type']}"
        for r in relations
    ) if relations else "_暂无_"

    return f"""# {e['name']}

**类型：** {e['type']}
**更新时间：** {datetime.utcnow().strftime('%Y-%m-%d')}

## 描述

{e.get('description', '暂无描述')}

## 属性

{attr_section}

## 关联实体

{rel_lines}
"""


def _workflow_md(wf: dict) -> str:
    steps = "\n".join(f"{i+1}. {s}" for i, s in enumerate(wf.get("steps", [])))
    conditions = "\n".join(f"- {c}" for c in wf.get("conditions", [])) or "_无_"
    participants = "、".join(wf.get("participants", [])) or "_未指定_"
    trigger = wf.get("trigger", "")
    duration = wf.get("duration", "")
    output = wf.get("output", "")

    extra = ""
    if trigger:
        extra += f"\n**触发事件：** {trigger}\n"
    if duration:
        extra += f"\n**时限要求：** {duration}\n"
    if output:
        extra += f"\n**产出物：** {output}\n"

    return f"""# {wf['name']}

**更新时间：** {datetime.utcnow().strftime('%Y-%m-%d')}
{extra}
## 流程步骤

{steps}

## 前提条件

{conditions}

## 参与角色

{participants}
"""


def _rule_md(rule: dict) -> str:
    source = rule.get("source", "")
    penalty = rule.get("penalty", "")

    source_line = f"\n**规则来源：** {source}" if source else ""
    penalty_section = f"\n## 违规后果\n\n{penalty}" if penalty else ""

    return f"""# {rule['name']}

**更新时间：** {datetime.utcnow().strftime('%Y-%m-%d')}{source_line}

## 触发条件

{rule.get('condition', '')}

## 执行动作

{rule.get('action', '')}
{penalty_section}
"""
