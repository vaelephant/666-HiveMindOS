"""
Wiki Merger — incremental page updates.

Rules:
- New entity  → create fresh page
- Existing entity → append update log, merge attributes, record conflicts
- Never overwrite existing description unless it was empty
- Source tracking on every update
"""
from __future__ import annotations

import re
from datetime import datetime, timezone
from pathlib import Path

from memory_layer.knowledge_base.app.logging_config import get_logger
from memory_layer.knowledge_base.core.compiler.entity_resolver import ResolvedEntity

log = get_logger("hivemind.compiler.wiki_merger")

# ── Section markers ───────────────────────────────────────────────────────────
_SEC_ATTRS    = "## 属性"
_SEC_RELATIONS = "## 关联实体"
_SEC_LOG      = "## 更新记录"
_SEC_CONFLICTS = "## 冲突信息"


def _now() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m-%d")


def _slug(name: str) -> str:
    return name.replace("/", "-").replace(" ", "_")


# ── Public API ────────────────────────────────────────────────────────────────

def upsert_entity_page(
    wiki_root: Path,
    org_id: str,
    resolution: ResolvedEntity,
    source_filename: str,
) -> str:
    out_dir = wiki_root / org_id / "entities"
    out_dir.mkdir(parents=True, exist_ok=True)
    slug = _slug(resolution.name)
    filepath = out_dir / f"{slug}.md"

    if resolution.is_new or not filepath.exists():
        filepath.write_text(
            _new_entity_page(resolution, source_filename), encoding="utf-8"
        )
        log.debug("wiki CREATE  %s", filepath.name)
    else:
        existing = filepath.read_text(encoding="utf-8")
        filepath.write_text(
            _merge_entity_page(existing, resolution, source_filename), encoding="utf-8"
        )
        log.debug("wiki UPDATE  %s  new_attrs=%d  conflicts=%d",
                  filepath.name, len(resolution.new_attributes), len(resolution.conflicts))

    return f"entities/{slug}.md"


def upsert_workflow_page(wiki_root: Path, org_id: str, workflow: dict, source_filename: str) -> str:
    out_dir = wiki_root / org_id / "workflows"
    out_dir.mkdir(parents=True, exist_ok=True)
    slug = _slug(workflow["name"])
    filepath = out_dir / f"{slug}.md"

    if filepath.exists():
        existing = filepath.read_text(encoding="utf-8")
        filepath.write_text(
            _append_log(existing, source_filename, "流程内容已更新"), encoding="utf-8"
        )
    else:
        filepath.write_text(_workflow_page(workflow, source_filename), encoding="utf-8")

    return f"workflows/{slug}.md"


def upsert_rule_page(wiki_root: Path, org_id: str, rule: dict, source_filename: str) -> str:
    out_dir = wiki_root / org_id / "glossary"
    out_dir.mkdir(parents=True, exist_ok=True)
    slug = _slug(rule["name"])
    filepath = out_dir / f"{slug}.md"

    if filepath.exists():
        existing = filepath.read_text(encoding="utf-8")
        filepath.write_text(
            _append_log(existing, source_filename, "规则内容已更新"), encoding="utf-8"
        )
    else:
        filepath.write_text(_rule_page(rule, source_filename), encoding="utf-8")

    return f"glossary/{slug}.md"


# ── Page generators ───────────────────────────────────────────────────────────

def _new_entity_page(r: ResolvedEntity, source: str) -> str:
    attr_table = _build_attr_table(r.all_attributes)
    rel_lines = _build_rel_lines(r.relations)
    return f"""# {r.name}

**类型：** {r.entity_type}
**首次录入：** {_now()}
**最后更新：** {_now()}

## 描述

{r.description or '暂无描述'}

{_SEC_ATTRS}

{attr_table}

{_SEC_RELATIONS}

{rel_lines}

{_SEC_LOG}

### {_now()} · {source}

_初始创建_ · 属性 {len(r.all_attributes)} 项 · 关联 {len(r.relations)} 条

"""


def _merge_entity_page(existing: str, r: ResolvedEntity, source: str) -> str:
    # 1. 更新「最后更新」日期（兼容旧格式 **更新时间：** 和新格式 **最后更新：**）
    content = re.sub(
        r"\*\*(?:最后更新|更新时间)：\*\*.*",
        f"**最后更新：** {_now()}",
        existing,
    )

    # 2. 合并属性表
    content = _merge_attr_section(content, r.all_attributes)

    # 3. 追加新关联
    if r.relations:
        content = _merge_rel_section(content, r.relations)

    # 4. 追加更新日志条目
    entry_lines = []
    if r.new_attributes:
        for k, v in r.new_attributes.items():
            entry_lines.append(f"- 新增属性：**{k}** = {v}")
    if r.relations:
        for rel in r.relations:
            entry_lines.append(f"- 新增关联：{rel['target']} ({rel['type']})")
    if not entry_lines:
        entry_lines.append("- 来源文件重新编译，无新增信息")

    log_entry = f"\n### {_now()} · {source}\n\n" + "\n".join(entry_lines) + "\n"
    content = _insert_into_section(content, _SEC_LOG, log_entry)

    # 5. 更新冲突信息
    if r.conflicts:
        conflict_rows = "\n".join(
            f"| {c.field} | {c.existing_value} | {c.new_value} | {source} |"
            for c in r.conflicts
        )
        conflict_table = (
            "\n| 字段 | 现有值 | 新值 | 新来源 |\n"
            "|------|--------|------|--------|\n"
            + conflict_rows + "\n"
        )
        content = _upsert_section(content, _SEC_CONFLICTS, conflict_table)

    return content


# ── Markdown helpers ──────────────────────────────────────────────────────────

def _build_attr_table(attrs: dict) -> str:
    if not attrs:
        return "_暂无_"
    rows = "\n".join(f"| {k} | {v} |" for k, v in attrs.items())
    return f"| 属性 | 值 |\n|------|-----|\n{rows}"


def _build_rel_lines(relations: list[dict]) -> str:
    if not relations:
        return "_暂无_"
    return "\n".join(
        f"- [{r['target']}](../entities/{_slug(r['target'])}.md) · {r['type']}"
        for r in relations
    )


def _merge_attr_section(content: str, all_attrs: dict) -> str:
    """Replace the entire attributes table with the merged version."""
    new_table = _build_attr_table(all_attrs)
    # Find ## 属性 section and replace its table
    pattern = re.compile(
        rf"({re.escape(_SEC_ATTRS)}\n\n)(.+?)(\n\n##|\Z)",
        re.DOTALL
    )
    if pattern.search(content):
        return pattern.sub(lambda m: m.group(1) + new_table + "\n" + m.group(3), content, count=1)
    return content + f"\n\n{_SEC_ATTRS}\n\n{new_table}\n"


def _merge_rel_section(content: str, new_relations: list[dict]) -> str:
    """Append new relations, avoiding duplicates."""
    new_lines = []
    for r in new_relations:
        line = f"- [{r['target']}](../entities/{_slug(r['target'])}.md) · {r['type']}"
        if line not in content:
            new_lines.append(line)
    if not new_lines:
        return content

    pattern = re.compile(
        rf"({re.escape(_SEC_RELATIONS)}\n\n(?:_暂无_\n)?)(.*?)(\n\n##|\Z)",
        re.DOTALL
    )
    addition = "\n".join(new_lines)
    if pattern.search(content):
        def replacer(m):
            existing_body = m.group(2).replace("_暂无_", "").strip()
            body = (existing_body + "\n" + addition).strip()
            return m.group(1).replace("_暂无_\n", "") + body + "\n" + m.group(3)
        return pattern.sub(replacer, content, count=1)
    return content + f"\n\n{_SEC_RELATIONS}\n\n{addition}\n"


def _insert_into_section(content: str, section_header: str, entry: str) -> str:
    """Insert entry right after the section header line."""
    if section_header in content:
        return content.replace(
            section_header + "\n",
            section_header + "\n" + entry,
            1,
        )
    return content + f"\n{section_header}\n{entry}"


def _upsert_section(content: str, section_header: str, body: str) -> str:
    """Replace entire section body, or append section if not found."""
    pattern = re.compile(
        rf"({re.escape(section_header)}\n)(.*?)(\n\n##|\Z)",
        re.DOTALL
    )
    if pattern.search(content):
        return pattern.sub(lambda m: m.group(1) + body + m.group(3), content, count=1)
    return content + f"\n\n{section_header}\n{body}"


def _append_log(content: str, source: str, note: str) -> str:
    entry = f"\n### {_now()} · {source}\n\n- {note}\n"
    return _insert_into_section(content, _SEC_LOG, entry)


# ── Workflow / Rule pages ─────────────────────────────────────────────────────

def _workflow_page(wf: dict, source: str) -> str:
    steps = "\n".join(f"{i+1}. {s}" for i, s in enumerate(wf.get("steps", [])))
    conditions = "\n".join(f"- {c}" for c in wf.get("conditions", [])) or "_无_"
    participants = "、".join(wf.get("participants", [])) or "_未指定_"
    trigger = wf.get("trigger", "")
    duration = wf.get("duration", "")
    output = wf.get("output", "")
    extras = ""
    if trigger:  extras += f"\n**触发事件：** {trigger}\n"
    if duration: extras += f"\n**时限要求：** {duration}\n"
    if output:   extras += f"\n**产出物：** {output}\n"

    return f"""# {wf['name']}

**最后更新：** {_now()}
{extras}
## 流程步骤

{steps}

## 前提条件

{conditions}

## 参与角色

{participants}

{_SEC_LOG}

### {_now()} · {source}

_初始创建_

"""


def _rule_page(rule: dict, source: str) -> str:
    src = rule.get("source", "")
    penalty = rule.get("penalty", "")
    src_line = f"\n**规则来源：** {src}" if src else ""
    penalty_sec = f"\n## 违规后果\n\n{penalty}" if penalty else ""

    return f"""# {rule['name']}

**最后更新：** {_now()}{src_line}

## 触发条件

{rule.get('condition', '')}

## 执行动作

{rule.get('action', '')}
{penalty_sec}

{_SEC_LOG}

### {_now()} · {source}

_初始创建_

"""
