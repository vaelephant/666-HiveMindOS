"""
知识候选池服务 — Candidate Layer

聊天 / 文档 / 复盘 → knowledge_candidates → Resolver → Wiki（后续）

与 memories（Chat 召回）双轨：
  - memories：L1 轻量提炼，服务智慧进化 + 智慧召回
  - candidates：可晋升为企业 Wiki 的候选事实，待合并审核
"""

from __future__ import annotations

from dataclasses import asdict

from shared import config
from server.logging_config import get_logger
from knowledge_base.core.registry.candidate_registry import CandidateRegistry
from memory_layer.core.registry.memory_registry import MemoryRegistry
from chat_layer.core.compiler.chat_digest_compiler import compile_candidate
from knowledge_base.core.wiki.wiki_manager import WikiManager
from knowledge_base.models.knowledge_candidate import CandidateInput
from knowledge_base.core.domain.taxonomy import (
    category_to_memory_type,
    is_wiki_category,
    memory_type_to_category,
    normalize_category,
)
from memory_layer.models.memory import MemoryCandidate, WikiSuggestion
from knowledge_base.settings import load
import platform_layer.audit_service as audit_service

log = get_logger("hivemind.candidate.service")

_registry = CandidateRegistry()
_memory_registry = MemoryRegistry()


def _resolver_cfg() -> dict:
    return load("resolver")


def should_enqueue_for_wiki(c: MemoryCandidate) -> bool:
    """晋升门槛：是否进入候选池（非直写 Wiki）。"""
    cat = memory_type_to_category(c.memory_type)
    if cat == "preference":
        return False
    if is_wiki_category(cat):
        return True
    threshold = _resolver_cfg()["enqueue"]["importance_fallback"]
    return c.importance >= threshold


def enqueue_from_memory_candidates(
    org_id: str,
    user_id: str | None,
    session_id: str,
    candidates: list[MemoryCandidate],
) -> list[int]:
    """L1/L2 双写：memory 落库后，符合条件的同步写入候选池。"""
    created: list[int] = []
    for c in candidates:
        if not should_enqueue_for_wiki(c):
            continue
        if c.action == "archive":
            continue
        cat = memory_type_to_category(c.memory_type)
        dup = _registry.find_similar_pending(org_id, cat, c.title)
        if dup:
            log.debug("[candidate] skip duplicate pending  title=%s", c.title)
            continue
        mem = _memory_registry.find_by_title(org_id, user_id, c.memory_type, c.title)
        mid = mem.id if mem else None
        action = "update" if c.action == "update" else "create_or_update"
        cid = _registry.create(
            org_id,
            user_id,
            CandidateInput(
                category=cat,
                title=c.title,
                content=c.content,
                source_type="chat",
                source_id=session_id,
                confidence=c.importance,
                proposed_action=action,
                memory_id=mid,
                metadata={"extractor_action": c.action, "match_title": c.match_title},
            ),
        )
        created.append(cid)
    if created:
        log.info(
            "[candidate] enqueued from L1  org=%s  session=%s  count=%d",
            org_id, session_id[:8], len(created),
        )
    return created


def enqueue_from_wiki_suggestions(
    org_id: str,
    user_id: str | None,
    session_id: str,
    suggestions: list[WikiSuggestion],
) -> list[int]:
    """L2 复盘：wiki_suggestions 落库为候选。"""
    created: list[int] = []
    for s in suggestions:
        cat = normalize_category(s.category)
        if not is_wiki_category(cat):
            cat = "other"
        dup = _registry.find_similar_pending(org_id, cat, s.title)
        if dup:
            continue
        cid = _registry.create(
            org_id,
            user_id,
            CandidateInput(
                category=cat,
                title=s.title,
                content=s.content_outline or s.reason,
                source_type="recap",
                source_id=session_id,
                confidence=_resolver_cfg()["recap_suggestion_confidence"],
                proposed_action="create_or_update",
                metadata={"reason": s.reason, "from": "session_recap"},
            ),
        )
        created.append(cid)
    return created


def resolve_pending_candidates(
    org_id: str,
    user_id: str | None = None,
    limit: int = 20,
) -> list[dict]:
    """
    Resolver Layer（P0）：规则 + 轻量匹配，不写 Wiki 文件。

    - 匹配已有 memory 标题 → update
    - 匹配已有 wiki 路径 → supplement + target_wiki_path
    - 高置信无匹配 → approved（待人工或 P1 自动编译）
    - 内容明显矛盾 → conflict
    """
    wiki = WikiManager(config.WIKI_ROOT)
    wiki_pages = {p["path"].lower(): p["path"] for p in wiki.list_pages(org_id)}

    pending = _registry.list_by_status(org_id, user_id, status="pending", limit=limit)
    results: list[dict] = []

    for cand in pending:
        action, note, wiki_path, status = _resolve_one(cand, org_id, user_id, wiki_pages)
        _registry.update_resolver(
            cand.id,
            org_id,
            status=status,
            resolver_action=action,
            resolver_note=note,
            target_wiki_path=wiki_path,
        )
        results.append({
            "candidate_id": cand.id,
            "title": cand.title,
            "resolver_action": action,
            "status": status,
            "target_wiki_path": wiki_path,
            "note": note,
        })

    log.info("[candidate] resolved batch  org=%s  count=%d", org_id, len(results))
    return results


def _resolve_one(
    cand,
    org_id: str,
    user_id: str | None,
    wiki_pages: dict[str, str],
) -> tuple[str, str, str | None, str]:
    """Returns (resolver_action, note, target_wiki_path, status)."""
    # Wiki 标题模糊匹配：候选标题出现在某 wiki 页名中
    title_lower = cand.title.lower()
    for key, path in wiki_pages.items():
        base = key.split("/")[-1].replace(".md", "")
        if title_lower in base or base in title_lower:
            return (
                "supplement",
                f"建议补充已有 Wiki 页：{path}",
                path,
                "approved",
            )

    mem_type = category_to_memory_type(cand.category)
    mem = _memory_registry.find_by_title(org_id, user_id, mem_type, cand.title)
    if mem and cand.memory_id and mem.id != cand.memory_id:
        return (
            "conflict",
            f"与已有智慧「{mem.title}」标题相同但 memory_id 不一致",
            None,
            "conflict",
        )
    if mem:
        return (
            "update",
            f"合并到已有智慧 memory_id={mem.id}",
            None,
            "approved",
        )

    if cand.confidence >= _resolver_cfg()["auto_approve_confidence"]:
        return (
            "create",
            "高置信新候选，待编译进 Wiki",
            None,
            "approved",
        )

    return (
        "noop",
        "待人工审核",
        None,
        "pending",
    )


def list_candidates(
    org_id: str,
    user_id: str | None = None,
    status: str | None = None,
    limit: int = 100,
) -> list[dict]:
    items = _registry.list_by_status(org_id, user_id, status=status, limit=limit)
    return [asdict(x) for x in items]


def get_candidate_stats(org_id: str, user_id: str | None = None) -> dict:
    return asdict(_registry.get_stats(org_id, user_id))


def _candidate_audit_detail(cand) -> dict:
    detail: dict = {"title": cand.title, "candidate_id": cand.id}
    source_type = getattr(cand, "source_type", None)
    source_id = getattr(cand, "source_id", None)
    if source_id and source_type in ("chat", "recap"):
        detail["session_id"] = source_id
        detail["source_type"] = source_type
    return detail


def reject_candidate(candidate_id: int, org_id: str, reason: str = "", user_id: str | None = None) -> None:
    cand = _registry.get_by_id(candidate_id, org_id)
    _registry.update_resolver(
        candidate_id, org_id,
        status="rejected",
        resolver_action="noop",
        resolver_note=reason or "人工驳回",
    )
    summary = f"驳回「{cand.title}」" if cand else (reason or "人工驳回")
    audit_service.log_event(
        org_id,
        user_id=user_id,
        category="candidate",
        action="candidate.reject",
        resource_type="candidate",
        resource_id=str(candidate_id),
        summary=summary,
        detail=_candidate_audit_detail(cand) if cand else {},
    )


def approve_candidate(candidate_id: int, org_id: str, note: str = "", user_id: str | None = None) -> None:
    cand = _registry.get_by_id(candidate_id, org_id)
    _registry.update_resolver(
        candidate_id, org_id,
        status="approved",
        resolver_action="create",
        resolver_note=note or "人工批准",
    )
    summary = f"批准「{cand.title}」" if cand else (note or "人工批准")
    audit_service.log_event(
        org_id,
        user_id=user_id,
        category="candidate",
        action="candidate.approve",
        resource_type="candidate",
        resource_id=str(candidate_id),
        summary=summary,
        detail=_candidate_audit_detail(cand) if cand else {},
    )


def compile_candidate_by_id(
    candidate_id: int,
    org_id: str,
    user_id: str | None = None,
) -> dict:
    """将单条 approved 候选编译进 Wiki。"""
    cand = _registry.get_by_id(candidate_id, org_id)
    if not cand:
        raise ValueError(f"候选不存在: {candidate_id}")
    if cand.status != "approved":
        raise ValueError(f"候选 #{candidate_id} 状态为 {cand.status}，仅 approved 可编译")

    wiki = WikiManager(config.WIKI_ROOT)
    wiki_path = compile_candidate(wiki.root, org_id, cand)
    _registry.update_resolver(
        cand.id,
        org_id,
        status="merged",
        resolver_action=cand.resolver_action or "create",
        resolver_note=f"已编译进 Wiki: {wiki_path}",
        target_wiki_path=wiki_path,
    )
    wiki.update_index(org_id)
    audit_service.log_event(
        org_id,
        user_id=user_id,
        category="wiki",
        action="wiki.compile",
        resource_type="candidate",
        resource_id=str(cand.id),
        summary=f"将「{cand.title}」写入 Wiki",
        detail={
            "title": cand.title,
            "wiki_path": wiki_path,
            "category": cand.category,
            **_candidate_audit_detail(cand),
        },
    )
    return {
        "candidate_id": cand.id,
        "title": cand.title,
        "wiki_path": wiki_path,
        "status": "merged",
    }


def approve_and_compile_candidate(
    candidate_id: int,
    org_id: str,
    note: str = "",
    user_id: str | None = None,
) -> dict:
    """人工批准并立即编译进 Wiki。"""
    approve_candidate(candidate_id, org_id, note=note, user_id=user_id)
    return compile_candidate_by_id(candidate_id, org_id, user_id=user_id)


def compile_approved_candidates(
    org_id: str,
    user_id: str | None = None,
    limit: int = 20,
) -> list[dict]:
    """
    Wiki Layer（P1）：将 status=approved 的候选编译进 Wiki，标记为 merged。
    """
    wiki = WikiManager(config.WIKI_ROOT)
    approved = _registry.list_by_status(org_id, user_id, status="approved", limit=limit)
    results: list[dict] = []

    for cand in approved:
        try:
            wiki_path = compile_candidate(wiki.root, org_id, cand)
            _registry.update_resolver(
                cand.id,
                org_id,
                status="merged",
                resolver_action=cand.resolver_action or "create",
                resolver_note=f"已编译进 Wiki: {wiki_path}",
                target_wiki_path=wiki_path,
            )
            results.append({
                "candidate_id": cand.id,
                "title": cand.title,
                "wiki_path": wiki_path,
                "status": "merged",
            })
            audit_service.log_event(
                org_id,
                user_id=user_id,
                category="wiki",
                action="wiki.compile",
                resource_type="candidate",
                resource_id=str(cand.id),
                summary=f"将「{cand.title}」写入 Wiki",
                detail={
                    "title": cand.title,
                    "wiki_path": wiki_path,
                    "category": cand.category,
                    **_candidate_audit_detail(cand),
                },
            )
        except Exception as exc:
            log.error("[candidate] compile failed  id=%d  err=%s", cand.id, exc)
            results.append({
                "candidate_id": cand.id,
                "title": cand.title,
                "error": str(exc),
                "status": "approved",
            })

    if results:
        wiki.update_index(org_id)
    log.info("[candidate] compiled batch  org=%s  ok=%d", org_id, len(results))
    return results


def enqueue_from_ingest_compile(
    org_id: str,
    source_id: str | None,
    source_filename: str,
    items: list[dict],
) -> list[int]:
    """
    ingest 双写：文档编译产出的 Wiki 页 mirror 到候选池（status=merged，供审计与统一检索）。
    items: {wiki_path, category, title, content}
    """
    created: list[int] = []
    for item in items:
        path = item["wiki_path"]
        if _registry.exists_merged_path(org_id, path):
            continue
        cid = _registry.create(
            org_id,
            None,
            CandidateInput(
                category=item.get("category", "other"),
                title=item["title"],
                content=item.get("content", ""),
                source_type="ingest",
                source_id=source_id,
                confidence=_resolver_cfg()["ingest_mirror_confidence"],
                proposed_action="create",
                metadata={"source_filename": source_filename},
            ),
            status="merged",
            target_wiki_path=path,
            resolver_action="create",
            resolver_note=f"ingest 自动编译: {source_filename}",
        )
        created.append(cid)
    if created:
        log.info(
            "[candidate] ingest mirror  org=%s  file=%s  count=%d",
            org_id, source_filename, len(created),
        )
    return created
