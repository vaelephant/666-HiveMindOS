import json
import sqlite3
from pathlib import Path
from typing import List, Dict, Optional
from models import Message, SummaryNode

def _estimate_tokens(text: str) -> int:
    """
    粗略估算 token 数。中英混合时约 3 字符/token，纯英文约 4 字符/token。
    这里用 3 作为保守估计（宁多勿少），与 lossless-claw 的 ~4 chars/token 接近。
    """
    return max(1, len(text) // 3)


class SimpleMemory:
    """
    DAG 版记忆系统（token 触发版）：
    1. 保存原始消息
    2. fresh tail 之外的消息 token 超过 leaf_chunk_tokens 时，触发 leaf 压缩
    3. 无父 leaf 积累到 max_leaf_summaries_before_condense 时，合并为 condensed
    4. build_context 先放高层摘要，再放低层，再放 fresh tail 原文
    5. expand_summary 可展开摘要回原文
    """

    def __init__(
        self,
        fresh_tail_count: int = 10,
        leaf_chunk_tokens: int = 2000,      # fresh tail 外的消息超过此 token 数时压缩
        max_leaf_summaries_before_condense: int = 3,
        llm_client=None,
        db_path: Optional[str] = None,
        json_path: Optional[str] = None,
    ):
        self.raw_messages: List[Message] = []
        self.all_messages: List[Message] = []
        self.summaries: List[SummaryNode] = []
        self.fresh_tail_count = fresh_tail_count
        self.leaf_chunk_tokens = leaf_chunk_tokens
        self.max_leaf_summaries_before_condense = max_leaf_summaries_before_condense
        self.summary_counter = 0
        self.llm_client = llm_client
        self.db_path: Optional[str] = db_path
        self.json_path: Optional[str] = json_path
        if self.db_path:
            self._init_db()
            self._load_from_db()
        elif self.json_path:
            self._load_from_json()

    def add_message(self, role: str, content: str) -> None:
        msg = Message(role=role, content=content)
        self.raw_messages.append(msg)
        self.all_messages.append(msg)
        if self.db_path:
            self._save_to_db()
        elif self.json_path:
            self._save_to_json()

    def maybe_compress(self) -> int:
        """
        触发压缩与修复，返回「本轮修复的降级摘要数量」（正常为 0）。
        """
        self._compress_old_messages_to_leaf()
        self._compress_leaf_summaries_to_parent()
        repaired = self._try_repair_degraded_summaries()
        if self.db_path:
            self._save_to_db()
        elif self.json_path:
            self._save_to_json()
        return repaired

    def _tokens_outside_fresh_tail(self) -> int:
        """计算 fresh tail 之外的消息的估算 token 总数（触发压缩的依据）。"""
        if len(self.raw_messages) <= self.fresh_tail_count:
            return 0
        old_messages = self.raw_messages[: len(self.raw_messages) - self.fresh_tail_count]
        return sum(_estimate_tokens(m.content) for m in old_messages)

    def _compress_old_messages_to_leaf(self) -> None:
        """
        token 触发版：fresh tail 之外的消息超过 leaf_chunk_tokens 时压缩。
        每次只压一批（不超过 leaf_chunk_tokens），剩余的下次继续。
        """
        if len(self.raw_messages) <= self.fresh_tail_count:
            return

        if self._tokens_outside_fresh_tail() < self.leaf_chunk_tokens:
            return

        # 取 fresh tail 之外的所有消息，按 token 上限切出本次要压缩的一批
        old_messages = self.raw_messages[: len(self.raw_messages) - self.fresh_tail_count]
        chunk: List[Message] = []
        chunk_tokens = 0
        for msg in old_messages:
            t = _estimate_tokens(msg.content)
            if chunk and chunk_tokens + t > self.leaf_chunk_tokens:
                break
            chunk.append(msg)
            chunk_tokens += t

        if not chunk:
            return

        global_start = len(self.all_messages) - len(self.raw_messages)
        source_indexes = list(range(global_start, global_start + len(chunk)))

        summary_text, summary_quality = self._summarize_messages_with_llm(chunk)
        summary_id = self._next_summary_id()

        leaf = SummaryNode(
            summary_id=summary_id,
            content=summary_text,
            source_indexes=source_indexes,
            depth=0,
            parent_ids=[],
            child_ids=[],
            earliest_at=chunk[0].created_at,
            latest_at=chunk[-1].created_at,
            quality=summary_quality,
        )

        self.summaries.append(leaf)
        # 只去掉本次压缩的 chunk，其余留在 raw_messages
        self.raw_messages = self.raw_messages[len(chunk):]

    def _compress_summaries_at_depth(self, depth: int) -> bool:
        """
        将指定 depth 上积累的无父摘要 condense 成 depth+1 节点。
        返回 True 表示发生了至少一次 condense。
        """
        candidates = [
            s for s in self.summaries
            if s.depth == depth and len(s.parent_ids) == 0
        ]
        if len(candidates) < self.max_leaf_summaries_before_condense:
            return False

        did_condense = False
        while True:
            candidates = [
                s for s in self.summaries
                if s.depth == depth and len(s.parent_ids) == 0
            ]
            if len(candidates) < self.max_leaf_summaries_before_condense:
                break

            selected = candidates[: self.max_leaf_summaries_before_condense]
            summary_text, summary_quality = self._summarize_summaries_with_llm(selected)
            parent_id = self._next_summary_id()

            times = (
                [s.earliest_at for s in selected if s.earliest_at]
                + [s.latest_at for s in selected if s.latest_at]
            )
            parent = SummaryNode(
                summary_id=parent_id,
                content=summary_text,
                source_indexes=[],
                depth=depth + 1,
                parent_ids=[],
                child_ids=[s.summary_id for s in selected],
                earliest_at=min(times) if times else "",
                latest_at=max(times) if times else "",
                quality=summary_quality,
            )
            for child in selected:
                child.parent_ids.append(parent_id)
            self.summaries.append(parent)
            did_condense = True

        return did_condense

    def _compress_leaf_summaries_to_parent(self) -> None:
        """
        多层 DAG 向上传播：
        从 depth=0 开始，每层 condense 完后检查上层是否也需要 condense，
        直到某层不再触发为止。
        """
        depth = 0
        while self._compress_summaries_at_depth(depth):
            depth += 1

    def _try_repair_degraded_summaries(self) -> int:
        """
        对 quality != 'normal' 的摘要尝试 Level 1 重摘要（自愈）。
        - leaf 摘要：从 all_messages 重建原始消息，重跑 Level 1 prompt
        - condensed 摘要：从子摘要重建输入，重跑 Level 1 prompt
        只有 Level 1 成功才升级，否则保持原 quality 不动。
        返回修复成功的数量。
        """
        if self.llm_client is None:
            return 0

        repaired = 0
        for s in self.summaries:
            if s.quality == "normal":
                continue

            if s.depth == 0:
                # Leaf：重建原始消息
                msgs = [
                    self.all_messages[i]
                    for i in s.source_indexes
                    if 0 <= i < len(self.all_messages)
                ]
                if not msgs:
                    continue
                lines = [
                    ("用户" if m.role == "user" else "助手") + ": " + m.content
                    for m in msgs
                ]
                conversation_text = "\n".join(lines)
                input_tokens = sum(_estimate_tokens(m.content) for m in msgs)
                prompt = (
                    "请把下面这段对话总结成一个面向工程执行的历史摘要。\n"
                    "要求：\n"
                    "1. 优先保留：当前目标、实现顺序、已确定决策、技术方案、下一步计划\n"
                    "2. 如果用户明确表达了先做什么、后做什么，必须保留\n"
                    "3. 不要泛泛介绍概念，要更像给后续 Agent 接手时看的工作摘要\n"
                    "4. 尽量简洁，但不能丢关键执行信息\n"
                    "5. 输出使用中文，不要写开场白\n"
                    "6. 不要把局部讨论误写成整体目标\n\n"
                    "对话内容：\n" + conversation_text
                )
                try:
                    r = self.llm_client.chat(
                        [
                            {"role": "system", "content": "你是一个擅长做面向工程执行的工作摘要的助手。"},
                            {"role": "user", "content": prompt},
                        ],
                        temperature=0.2,
                    ).strip()
                    if r and _estimate_tokens(r) < input_tokens * 1.5:
                        s.content = "【Leaf 摘要】\n" + r
                        s.quality = "normal"
                        repaired += 1
                except Exception:
                    pass

            else:
                # Condensed：重建子摘要输入
                children = [self.get_summary_by_id(cid) for cid in s.child_ids]
                children = [c for c in children if c is not None]
                if not children:
                    continue
                summary_lines = [f"{c.summary_id}:\n{c.content}" for c in children]
                summaries_text = "\n\n".join(summary_lines)
                input_tokens = sum(_estimate_tokens(c.content) for c in children)
                prompt = (
                    "请把下面多个低层历史摘要合并成一个面向工程执行的阶段总结。\n"
                    "要求：\n"
                    "1. 优先保留：当前目标、实现顺序、已定决策、技术方案、下一步计划\n"
                    "2. 合并多个子摘要里的先做什么、后做什么顺序\n"
                    "3. 比子摘要更抽象，但不能丢执行主线\n"
                    "4. 输出使用中文，不要写多余开场白\n\n"
                    "低层摘要内容：\n" + summaries_text
                )
                try:
                    r = self.llm_client.chat(
                        [
                            {"role": "system", "content": "你是一个擅长做阶段总结的助手。"},
                            {"role": "user", "content": prompt},
                        ],
                        temperature=0.2,
                    ).strip()
                    if r and _estimate_tokens(r) < input_tokens * 1.5:
                        s.content = "【Condensed 摘要】\n" + r
                        s.quality = "normal"
                        repaired += 1
                except Exception:
                    pass

        return repaired

    def _init_db(self) -> None:
        path = Path(self.db_path)
        path.parent.mkdir(parents=True, exist_ok=True)
        conn = sqlite3.connect(self.db_path)
        conn.executescript("""
            CREATE TABLE IF NOT EXISTS messages (
                seq INTEGER PRIMARY KEY,
                role TEXT NOT NULL,
                content TEXT NOT NULL,
                created_at TEXT NOT NULL DEFAULT ''
            );
            CREATE TABLE IF NOT EXISTS summaries (
                summary_id TEXT PRIMARY KEY,
                content TEXT NOT NULL,
                source_indexes TEXT NOT NULL,
                depth INTEGER NOT NULL,
                parent_ids TEXT NOT NULL,
                child_ids TEXT NOT NULL,
                earliest_at TEXT NOT NULL DEFAULT '',
                latest_at TEXT NOT NULL DEFAULT '',
                quality TEXT NOT NULL DEFAULT 'normal'
            );
            CREATE TABLE IF NOT EXISTS state (
                key TEXT PRIMARY KEY,
                value TEXT NOT NULL
            );
        """)
        # 迁移：旧库可能没有新列，用 ALTER TABLE 兼容补上
        for col, table in [
            ("created_at", "messages"),
            ("earliest_at", "summaries"),
            ("latest_at", "summaries"),
            ("quality", "summaries"),
        ]:
            try:
                conn.execute(f"ALTER TABLE {table} ADD COLUMN {col} TEXT NOT NULL DEFAULT ''")
            except sqlite3.OperationalError:
                pass  # 列已存在，忽略
        conn.commit()
        conn.close()

    def _save_to_db(self) -> None:
        if not self.db_path:
            return
        conn = sqlite3.connect(self.db_path)
        conn.execute("DELETE FROM messages")
        conn.execute("DELETE FROM summaries")
        conn.execute("DELETE FROM state")
        for i, msg in enumerate(self.all_messages):
            conn.execute(
                "INSERT INTO messages (seq, role, content, created_at) VALUES (?, ?, ?, ?)",
                (i, msg.role, msg.content, msg.created_at),
            )
        for s in self.summaries:
            conn.execute(
                "INSERT INTO summaries "
                "(summary_id, content, source_indexes, depth, parent_ids, child_ids, earliest_at, latest_at, quality) "
                "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
                (
                    s.summary_id,
                    s.content,
                    json.dumps(s.source_indexes),
                    s.depth,
                    json.dumps(s.parent_ids),
                    json.dumps(s.child_ids),
                    s.earliest_at,
                    s.latest_at,
                    s.quality,
                ),
            )
        conn.execute("INSERT INTO state (key, value) VALUES ('raw_count', ?)", (str(len(self.raw_messages)),))
        conn.execute("INSERT INTO state (key, value) VALUES ('summary_counter', ?)", (str(self.summary_counter),))
        conn.commit()
        conn.close()

    def _load_from_db(self) -> None:
        if not self.db_path or not Path(self.db_path).exists():
            return
        conn = sqlite3.connect(self.db_path)
        try:
            cur = conn.execute("SELECT seq, role, content, created_at FROM messages ORDER BY seq")
            rows = cur.fetchall()
        except sqlite3.OperationalError:
            conn.close()
            return
        self.all_messages = [
            Message(role=r, content=c, created_at=ca or "")
            for _, r, c, ca in rows
        ]
        try:
            cur = conn.execute(
                "SELECT summary_id, content, source_indexes, depth, parent_ids, child_ids, "
                "earliest_at, latest_at, quality FROM summaries"
            )
            rows = cur.fetchall()
        except sqlite3.OperationalError:
            conn.close()
            return
        self.summaries = []
        for sid, content, si, depth, pids, cids, ea, la, qual in rows:
            self.summaries.append(
                SummaryNode(
                    summary_id=sid,
                    content=content,
                    source_indexes=json.loads(si),
                    depth=depth,
                    parent_ids=json.loads(pids),
                    child_ids=json.loads(cids),
                    earliest_at=ea or "",
                    latest_at=la or "",
                    quality=qual or "normal",
                )
            )
        cur = conn.execute("SELECT key, value FROM state")
        state = dict(cur.fetchall())
        conn.close()
        raw_count = int(state.get("raw_count", 0))
        self.summary_counter = int(state.get("summary_counter", 0))
        if raw_count > 0 and raw_count <= len(self.all_messages):
            self.raw_messages = self.all_messages[-raw_count:]
        else:
            self.raw_messages = list(self.all_messages)

    def _save_to_json(self) -> None:
        if not self.json_path:
            return
        path = Path(self.json_path)
        path.parent.mkdir(parents=True, exist_ok=True)
        data = {
            "messages": [
                {"index": i, "role": m.role, "content": m.content, "created_at": m.created_at}
                for i, m in enumerate(self.all_messages)
            ],
            "summaries": [
                {
                    "summary_id": s.summary_id,
                    "content": s.content,
                    "source_indexes": s.source_indexes,
                    "depth": s.depth,
                    "parent_ids": s.parent_ids,
                    "child_ids": s.child_ids,
                    "earliest_at": s.earliest_at,
                    "latest_at": s.latest_at,
                    "quality": s.quality,
                }
                for s in self.summaries
            ],
            "raw_count": len(self.raw_messages),
            "summary_counter": self.summary_counter,
        }
        with open(self.json_path, "w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False, indent=2)

    def _load_from_json(self) -> None:
        if not self.json_path or not Path(self.json_path).exists():
            return
        with open(self.json_path, encoding="utf-8") as f:
            data = json.load(f)
        # 支持带 index 或不带 index 的旧 JSON
        self.all_messages = [
            Message(role=m["role"], content=m["content"], created_at=m.get("created_at", ""))
            for m in data.get("messages", [])
        ]
        self.summaries = [
            SummaryNode(
                summary_id=s["summary_id"],
                content=s["content"],
                source_indexes=s.get("source_indexes", []),
                depth=s.get("depth", 0),
                parent_ids=s.get("parent_ids", []),
                child_ids=s.get("child_ids", []),
                earliest_at=s.get("earliest_at", ""),
                latest_at=s.get("latest_at", ""),
                quality=s.get("quality", "normal"),
            )
            for s in data.get("summaries", [])
        ]
        raw_count = data.get("raw_count", 0)
        self.summary_counter = data.get("summary_counter", 0)
        if raw_count > 0 and raw_count <= len(self.all_messages):
            self.raw_messages = self.all_messages[-raw_count:]
        else:
            self.raw_messages = list(self.all_messages)

    # ── 确定性截断兜底（Level 3）────────────────────────────────────
    _TRUNCATION_MARKER = "[截断，上下文管理]"
    _TRUNCATION_CHARS = 1536  # ~512 tokens

    def _truncation_fallback_messages(self, messages: List[Message]) -> str:
        """Level 3 兜底：把消息原文拼接后截断，加标记，保证永远不崩。"""
        lines = [
            ("用户" if m.role == "user" else "助手") + ": " + m.content
            for m in messages
        ]
        text = "\n".join(lines)
        if len(text) > self._TRUNCATION_CHARS:
            text = text[: self._TRUNCATION_CHARS] + f"\n{self._TRUNCATION_MARKER}"
        return "【Leaf 摘要·截断版】\n" + text

    def _truncation_fallback_summaries(self, summaries: List[SummaryNode]) -> str:
        """Level 3 兜底：把子摘要拼接后截断，加标记。"""
        lines = [f"{s.summary_id}: {s.content[:200]}" for s in summaries]
        text = "\n".join(lines)
        if len(text) > self._TRUNCATION_CHARS:
            text = text[: self._TRUNCATION_CHARS] + f"\n{self._TRUNCATION_MARKER}"
        return "【Condensed 摘要·截断版】\n" + text

    # ── Leaf summary 三级降级 ──────────────────────────────────────
    def _summarize_messages_with_llm(self, messages: List[Message]) -> str:
        """
        三级降级：
        Level 1 正常  temperature=0.2，完整工程执行摘要
        Level 2 aggressive  temperature=0.1，极简只保关键事实
        Level 3 截断兜底，无需 LLM，保证不崩
        """
        if self.llm_client is None:
            return self._truncation_fallback_messages(messages), "truncated"

        lines = [
            ("用户" if m.role == "user" else "助手") + ": " + m.content
            for m in messages
        ]
        conversation_text = "\n".join(lines)
        input_tokens = sum(_estimate_tokens(m.content) for m in messages)

        # Level 1: 正常
        prompt_l1 = (
            "请把下面这段对话总结成一个面向工程执行的历史摘要。\n"
            "要求：\n"
            "1. 优先保留：当前目标、实现顺序、已确定决策、技术方案、下一步计划\n"
            "2. 如果用户明确表达了先做什么、后做什么，必须保留\n"
            "3. 不要泛泛介绍概念，要更像给后续 Agent 接手时看的工作摘要\n"
            "4. 尽量简洁，但不能丢关键执行信息\n"
            "5. 输出使用中文\n"
            "6. 不要写以下是摘要之类的废话\n"
            "7. 不要把某个局部讨论误写成整体目标；局部话题请写成当前讨论涉及。\n"
            "8. 如果对话中出现先做什么、后做什么、然后做什么，必须显式保留。\n\n"
            "对话内容：\n" + conversation_text
        )
        try:
            r = self.llm_client.chat(
                [
                    {"role": "system", "content": "你是一个擅长做面向工程执行的工作摘要的助手，优先保留开发计划、实现顺序和下一步行动。"},
                    {"role": "user", "content": prompt_l1},
                ],
                temperature=0.2,
            ).strip()
            if r and _estimate_tokens(r) < input_tokens * 1.5:
                return "【Leaf 摘要】\n" + r, "normal"
        except Exception:
            pass

        # Level 2: aggressive
        prompt_l2 = (
            "极简压缩以下对话，只保留不可缺少的事实：目标、决策、执行顺序。\n"
            "不超过 200 字，中文输出，不要开场白。\n\n"
            "对话：\n" + conversation_text
        )
        try:
            r = self.llm_client.chat(
                [
                    {"role": "system", "content": "极简摘要助手，只输出最关键的执行事实。"},
                    {"role": "user", "content": prompt_l2},
                ],
                temperature=0.1,
            ).strip()
            if r:
                return "【Leaf 摘要·简化版】\n" + r, "simplified"
        except Exception:
            pass

        # Level 3: 截断兜底
        return self._truncation_fallback_messages(messages), "truncated"

    # ── Condensed summary 三级降级 ────────────────────────────────
    def _summarize_summaries_with_llm(self, summaries: List[SummaryNode]) -> str:
        """
        三级降级：
        Level 1 正常  阶段总结 prompt，temperature=0.2
        Level 2 aggressive  极简合并，temperature=0.1
        Level 3 截断兜底
        """
        if self.llm_client is None:
            return self._truncation_fallback_summaries(summaries), "truncated"

        summary_lines = [f"{s.summary_id}:\n{s.content}" for s in summaries]
        summaries_text = "\n\n".join(summary_lines)
        input_tokens = sum(_estimate_tokens(s.content) for s in summaries)

        # Level 1
        prompt_l1 = (
            "请把下面多个低层历史摘要合并成一个面向工程执行的阶段总结。\n"
            "要求：\n"
            "1. 优先保留：当前目标、实现顺序、已定决策、技术方案、下一步计划\n"
            "2. 如果多个子摘要里有先做什么、后做什么，必须合并进阶段总结\n"
            "3. 比子摘要更抽象，但不能丢执行主线；更像给后续接手看的阶段小结\n"
            "4. 输出使用中文，不要写多余开场白\n\n"
            "低层摘要内容：\n" + summaries_text
        )
        try:
            r = self.llm_client.chat(
                [
                    {"role": "system", "content": "你是一个擅长做阶段总结的助手，把多段工作摘要合并成一条工程执行向的阶段小结。"},
                    {"role": "user", "content": prompt_l1},
                ],
                temperature=0.2,
            ).strip()
            if r and _estimate_tokens(r) < input_tokens * 1.5:
                return "【Condensed 摘要】\n" + r, "normal"
        except Exception:
            pass

        # Level 2
        prompt_l2 = (
            "极简合并以下摘要，只保留最关键的目标与执行顺序，不超过 150 字，中文，不要开场白。\n\n"
            + summaries_text
        )
        try:
            r = self.llm_client.chat(
                [
                    {"role": "system", "content": "极简摘要助手。"},
                    {"role": "user", "content": prompt_l2},
                ],
                temperature=0.1,
            ).strip()
            if r:
                return "【Condensed 摘要·简化版】\n" + r, "simplified"
        except Exception:
            pass

        # Level 3
        return self._truncation_fallback_summaries(summaries), "truncated"

    def _next_summary_id(self) -> str:
        sid = f"sum_{self.summary_counter}"
        self.summary_counter += 1
        return sid

    def get_summary_by_id(self, summary_id: str) -> Optional[SummaryNode]:
        for s in self.summaries:
            if s.summary_id == summary_id:
                return s
        return None

    def expand_summary(self, summary_id: str) -> Dict:
        node = self.get_summary_by_id(summary_id)
        if node is None:
            return {
                "summary_id": summary_id,
                "found": False,
                "type": None,
                "children": [],
                "messages": [],
            }

        if node.child_ids:
            children = []
            for child_id in node.child_ids:
                child = self.get_summary_by_id(child_id)
                if child:
                    children.append({
                        "summary_id": child.summary_id,
                        "depth": child.depth,
                        "content": child.content,
                    })

            return {
                "summary_id": summary_id,
                "found": True,
                "type": "parent",
                "depth": node.depth,
                "content": node.content,
                "children": children,
                "messages": [],
            }

        messages = []
        for idx in node.source_indexes:
            if 0 <= idx < len(self.all_messages):
                msg = self.all_messages[idx]
                messages.append({
                    "index": idx,
                    "role": msg.role,
                    "content": msg.content,
                })

        return {
            "summary_id": summary_id,
            "found": True,
            "type": "leaf",
            "depth": node.depth,
            "content": node.content,
            "children": [],
            "messages": messages,
        }

    def _format_summary_xml(self, summary: SummaryNode) -> str:
        """
        将 SummaryNode 渲染为 XML 字符串发给模型，模型能看到：
        - id / kind / depth：定位和识别
        - earliest_at / latest_at：覆盖的时间范围
        - parents：condensed 节点的子摘要引用（便于模型主动要求展开）
        - content：摘要正文
        """
        if summary.depth == 0:
            kind = "leaf"
        elif summary.depth == 1:
            kind = "condensed"
        else:
            kind = f"condensed-d{summary.depth}"
        attrs = f'id="{summary.summary_id}" kind="{kind}" depth="{summary.depth}" quality="{summary.quality}"'
        if summary.earliest_at:
            attrs += f' earliest_at="{summary.earliest_at}"'
        if summary.latest_at:
            attrs += f' latest_at="{summary.latest_at}"'

        lines = [f"<summary {attrs}>"]

        if summary.child_ids:
            lines.append("  <parents>")
            for cid in summary.child_ids:
                lines.append(f'    <summary_ref id="{cid}" />')
            lines.append("  </parents>")

        lines.append("  <content>")
        # 缩进摘要正文
        for line in summary.content.splitlines():
            lines.append(f"    {line}")
        lines.append("  </content>")
        lines.append("</summary>")

        return "\n".join(lines)

    def _retrieve_relevant_messages(self, query: str, top_k: int = 5) -> List[Message]:
        """从已压缩的历史消息中，按与 query 的相关性取出 top_k 条原文，用于回答细节问题。"""
        n_raw = len(self.raw_messages)
        n_all = len(self.all_messages)
        if n_raw >= n_all:
            return []
        compressed = self.all_messages[: n_all - n_raw]
        if not compressed or not query.strip():
            return []

        query_chars = set(query.strip())
        scored: List[tuple] = []
        for msg in compressed:
            overlap = len(query_chars & set(msg.content))
            if overlap > 0:
                scored.append((overlap, msg))
        scored.sort(key=lambda x: -x[0])
        return [msg for _, msg in scored[:top_k]]

    def explain_retrieve(self, query: str, top_k: int = 5) -> str:
        """
        可读版 recall：打印候选池、每条消息的相关性得分，以及最终被注入 context 的消息。
        用于调试和理解 recall 过程。
        """
        lines = ["=" * 56]
        lines.append(f"  Recall 过程  query=「{query}」  top_k={top_k}")
        lines.append("=" * 56)

        n_raw = len(self.raw_messages)
        n_all = len(self.all_messages)
        compressed = self.all_messages[: n_all - n_raw]

        lines.append(f"\n候选池：已压缩的历史消息（共 {len(compressed)} 条，fresh tail {n_raw} 条已排除）")
        if not compressed:
            lines.append("  （暂无压缩消息，所有消息都在 fresh tail 里，无需 recall）")
            return "\n".join(lines)

        query_chars = set(query.strip())
        scored: List[tuple] = []
        for i, msg in enumerate(compressed):
            overlap = len(query_chars & set(msg.content))
            scored.append((overlap, i, msg))

        scored_sorted = sorted(scored, key=lambda x: -x[0])

        lines.append(f"\n【全部候选得分】（字符集重叠数，越大越相关）")
        for score, idx, msg in scored_sorted:
            bar = "█" * min(score, 20)
            flag = "  ← 选中" if score > 0 and scored_sorted.index((score, idx, msg)) < top_k else ""
            lines.append(f"  [{idx:3d}] score={score:3d} {bar}")
            lines.append(f"         {msg.role}: {msg.content[:60]}{flag}")

        selected = [msg for score, _, msg in scored_sorted if score > 0][:top_k]
        lines.append(f"\n【最终注入 context 的消息（top {top_k}）】")
        if not selected:
            lines.append("  （无相关消息，query 与历史无字符重叠）")
        else:
            for msg in selected:
                role_cn = "用户" if msg.role == "user" else "助手"
                lines.append(f"  {role_cn}: {msg.content}")

        lines.append("=" * 56)
        return "\n".join(lines)

    def build_context(
        self,
        user_query: Optional[str] = None,
        retrieve_top_k: int = 5,
    ) -> List[Dict[str, str]]:
        context: List[Dict[str, str]] = []

        sorted_summaries = sorted(self.summaries, key=lambda x: x.depth, reverse=True)
        for summary in sorted_summaries:
            context.append({"role": "system", "content": self._format_summary_xml(summary)})

        # 检索与当前问题相关的历史原文，补进 context，便于回答摘要里没有的细节
        if user_query and retrieve_top_k > 0:
            relevant = self._retrieve_relevant_messages(user_query, top_k=retrieve_top_k)
            if relevant:
                lines = []
                for m in relevant:
                    role_cn = "用户" if m.role == "user" else "助手"
                    lines.append(f"{role_cn}: {m.content}")
                context.append({
                    "role": "system",
                    "content": "【以下是与当前问题相关的历史原文，可供回答细节】\n\n" + "\n\n".join(lines),
                })

        for msg in self.raw_messages:
            context.append({"role": msg.role, "content": msg.content})

        return context

    def get_context_preview(self, summary_max_chars: int = 600, message_max_chars: int = 300) -> str:
        """
        返回「即将送给模型的上下文」的可读预览，便于核对模型下一轮到底看到什么。
        包含：当前 summaries、当前 fresh tail、总条数、估计 token 数。
        """
        lines = ["========== 当前上下文预览（下一轮将发给模型）=========="]

        context = self.build_context()
        summary_blocks = [b for b in context if b["role"] == "system"]
        message_blocks = [b for b in context if b["role"] in ("user", "assistant")]

        lines.append("\n--- Summaries（历史摘要，role=system）---")
        for i, block in enumerate(summary_blocks):
            content = block["content"]
            if len(content) > summary_max_chars:
                content = content[:summary_max_chars] + "\n... [截断]"
            lines.append(f"  [{i}] system:\n{content}")

        lines.append(f"\n--- Fresh tail（当前原始消息，共 {len(message_blocks)} 条）---")
        for i, block in enumerate(message_blocks):
            role, content = block["role"], block["content"]
            if len(content) > message_max_chars:
                content = content[:message_max_chars] + "... [截断]"
            lines.append(f"  [{i}] {role}: {content}")

        total_blocks = len(context)
        total_tokens = sum(_estimate_tokens(b["content"]) for b in context)
        outside_fresh = self._tokens_outside_fresh_tail()
        lines.append(f"\n--- 合计 ---")
        lines.append(
            f"  总条数: {total_blocks}  |  约 {total_tokens} tokens"
            f"  |  fresh tail 外待压缩: ~{outside_fresh} tokens"
            f"  |  压缩阈值: {self.leaf_chunk_tokens} tokens"
        )
        lines.append("========================================\n")
        return "\n".join(lines)

    def debug_print(self) -> None:
        print("\n========== Memory Debug ==========")
        print(f"摘要数量: {len(self.summaries)}")
        for s in self.summaries:
            tok = _estimate_tokens(s.content)
            quality_badge = {"normal": "✓", "simplified": "⚡", "truncated": "✂"}.get(s.quality, "?")
            print(
                f"- {s.summary_id} | depth={s.depth} | ~{tok} tokens | quality={quality_badge}{s.quality}"
                f" | parents={s.parent_ids} | children={s.child_ids}"
            )
            print(f"  content: {s.content[:160]}")

        outside = self._tokens_outside_fresh_tail()
        raw_tok = sum(_estimate_tokens(m.content) for m in self.raw_messages)
        print(
            f"当前原始消息: {len(self.raw_messages)} 条 / 约 {raw_tok} tokens"
            f"  |  fresh tail 外待压缩: ~{outside} tokens / 阈值 {self.leaf_chunk_tokens}"
        )
        for i, msg in enumerate(self.raw_messages):
            tok = _estimate_tokens(msg.content)
            preview = msg.content[:100].replace("\n", " ")
            print(f"  [{i}] {msg.role} (~{tok}t): {preview}")

        print("==================================\n")