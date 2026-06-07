"""
demo_steps.py
=============
mock 模式下逐步演示 Session Memory 全部机制。
无需 API Key，直接运行：
    cd memory_demo && python demo_steps.py
"""
import sys, os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from memory import SimpleMemory, _estimate_tokens

SEP  = "=" * 60
SEP2 = "-" * 60

def banner(title: str) -> None:
    print(f"\n{SEP}\n  {title}\n{SEP}")

def show_raw(mem: SimpleMemory) -> None:
    outside = mem._tokens_outside_fresh_tail()
    total   = sum(_estimate_tokens(m.content) for m in mem.raw_messages)
    print(f"  raw_messages : {len(mem.raw_messages)} 条 / ~{total} tokens")
    print(f"  fresh tail 外: ~{outside} tokens  (阈值 {mem.leaf_chunk_tokens})")
    for i, m in enumerate(mem.raw_messages):
        tag = "←fresh" if i >= len(mem.raw_messages) - mem.fresh_tail_count else ""
        print(f"    [{i}] {m.role:9s}: {m.content}  {tag}")

def show_summaries(mem: SimpleMemory) -> None:
    badge = {"normal": "✓", "simplified": "⚡", "truncated": "✂"}
    if not mem.summaries:
        print("  (暂无摘要)")
        return
    for s in mem.summaries:
        b = badge.get(s.quality, "?")
        parent_str = f"→{s.parent_ids}" if s.parent_ids else "孤节点"
        print(f"  {s.summary_id} | depth={s.depth} | quality={b}{s.quality} | {parent_str}")
        print(f"    内容预览: {s.content[:80].replace(chr(10),' ')}")

def show_context_xml(mem: SimpleMemory) -> None:
    ctx = mem.build_context()
    system_blocks = [b for b in ctx if b["role"] == "system"]
    msg_blocks    = [b for b in ctx if b["role"] != "system"]
    print(f"  context 共 {len(ctx)} 块：{len(system_blocks)} 个 system（摘要）+ {len(msg_blocks)} 条原文")
    for i, b in enumerate(system_blocks):
        print(f"\n  [system block {i}]")
        for line in b["content"].splitlines()[:8]:
            print(f"    {line}")
        if b["content"].count("\n") > 7:
            print("    ...")
    print(f"\n  [fresh tail 原文 {len(msg_blocks)} 条]")
    for b in msg_blocks[-4:]:
        print(f"    {b['role']:9s}: {b['content']}")


# ──────────────────────────────────────────────────────────────
# 参数：故意设很小，方便 mock 模式快速触发
# leaf_chunk_tokens=40  → ~13 条短消息（每条~3token）触发一次 leaf
# max_leaf=3            → 3 个 leaf → 1 个 condensed (depth=1)
# max_leaf=3 + 3 depth-1 → depth=2（需要更多消息）
# fresh_tail_count=4    → 保留最近 4 条不压缩
# ──────────────────────────────────────────────────────────────
mem = SimpleMemory(
    fresh_tail_count=4,
    leaf_chunk_tokens=40,
    max_leaf_summaries_before_condense=3,
)

MESSAGES = [
    ("user",      "我在开发 HivemindOS"),
    ("assistant", "好的，这是一个 AI 操作系统项目"),
    ("user",      "它有 Session Memory 和 Knowledge Memory"),
    ("assistant", "分别对应会话记忆和长期知识"),
    ("user",      "Session Memory 用 DAG 摘要"),
    ("assistant", "DAG 可以做分层压缩和可追溯"),
    ("user",      "Knowledge Memory 用图谱"),
    ("assistant", "图谱适合表达长期知识和实体关系"),
    ("user",      "我们先做 MVP"),
    ("assistant", "建议先聚焦最小可行链路"),
    ("user",      "先做 raw store 和 summary"),
    ("assistant", "这样最容易先验证会话记忆链路"),
    ("user",      "然后再加长期知识"),
    ("assistant", "这会是一个更稳妥的迭代顺序"),
    ("user",      "压缩触发的方式从消息数换成 token 数"),
    ("assistant", "token 触发更精确，避免长消息误判"),
    ("user",      "摘要用 XML 格式发给模型"),
    ("assistant", "XML 带 id/depth/quality 属性，模型可感知"),
    ("user",      "失败时三级降级：正常→简化→截断"),
    ("assistant", "截断兜底保证永远不崩"),
    ("user",      "每个摘要节点记录 quality"),
    ("assistant", "quality 有 normal/simplified/truncated 三档"),
    ("user",      "降级的摘要下一轮会自动修复"),
    ("assistant", "自愈机制让摘要质量随时间变好"),
    ("user",      "condensed 也可以继续被 condense"),
    ("assistant", "多层 DAG 是完整复刻 lossless-claw 的最后一步"),
]

prev_leaf_count   = 0
prev_cond_count   = 0

for step, (role, content) in enumerate(MESSAGES, 1):

    banner(f"Step {step:02d} | 加入消息：{role}: {content[:30]}")

    mem.add_message(role, content)

    outside_before = mem._tokens_outside_fresh_tail()
    repaired = mem.maybe_compress()

    # ── 当前 raw store ────────────────────────────────────────
    print(f"\n【raw store】")
    show_raw(mem)

    # ── 检测是否触发了新的 leaf ────────────────────────────────
    cur_leaf_count = sum(1 for s in mem.summaries if s.depth == 0)
    cur_cond_count = sum(1 for s in mem.summaries if s.depth > 0)

    if cur_leaf_count > prev_leaf_count:
        new_leaves = cur_leaf_count - prev_leaf_count
        print(f"\n  🌿 新增 {new_leaves} 个 Leaf 摘要（fresh tail 外 token 超过阈值 {mem.leaf_chunk_tokens}）")

    if cur_cond_count > prev_cond_count:
        new_conds = cur_cond_count - prev_cond_count
        depths = sorted(set(s.depth for s in mem.summaries if s.depth > 0))
        print(f"\n  🌲 新增 {new_conds} 个 Condensed 摘要（深度: {depths}）")

    prev_leaf_count = cur_leaf_count
    prev_cond_count = cur_cond_count

    if repaired:
        print(f"\n  🔧 自愈：修复了 {repaired} 个降级摘要")

    # ── 摘要树 ────────────────────────────────────────────────
    if mem.summaries:
        print(f"\n【摘要树（{len(mem.summaries)} 个节点）】")
        show_summaries(mem)

    print()

# ──────────────────────────────────────────────────────────────
banner("最终状态")

print("\n【完整摘要树】")
show_summaries(mem)

depths = sorted(set(s.depth for s in mem.summaries)) if mem.summaries else []
print(f"\n  节点深度分布: {depths}")
print(f"  all_messages: {len(mem.all_messages)} 条")
print(f"  raw_messages: {len(mem.raw_messages)} 条（fresh tail 最后 {mem.fresh_tail_count} 条）")

banner("build_context() 发给模型的内容")
show_context_xml(mem)

banner("XML 摘要完整示例（取最深节点）")
if mem.summaries:
    deepest = max(mem.summaries, key=lambda s: s.depth)
    print(mem._format_summary_xml(deepest))

banner("Recall 过程演示")

RECALL_QUERIES = [
    "DAG 是什么",
    "MVP 怎么做",
    "token 触发",
]
for q in RECALL_QUERIES:
    print(mem.explain_retrieve(q, top_k=3))
    print()

print(f"\n{SEP}")
print("  演示结束。以上全部在 mock 模式（无 LLM）下运行。")
print("  注意：mock 模式下自愈不生效（llm_client=None），")
print("  真实 LLM 接入后 quality 会从 truncated 升级到 normal。")
print(SEP)
