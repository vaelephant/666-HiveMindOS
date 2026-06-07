#!/usr/bin/env python3
"""
Session Memory 测试脚本：分步打印执行过程与预期，便于观察行为。

用法: python run_memory_test.py

测试结束后会把当前记忆状态写入 memory_demo/test_session.json，便于查看「跑完测试后 JSON 长什么样」。

参数说明（本脚本使用）:
  fresh_tail_count=4    保留最近 4 条不压缩
  compress_trigger=6     raw 条数 > 6 时触发压缩
  max_leaf_summaries_before_condense=3  满 3 个无父 leaf 时合并为 Condensed

若使用真实 LLM（配置好 API），摘要内容会变为自然语言；否则为 mock 占位内容。
"""
import os
from memory import SimpleMemory


def sep(title: str, char: str = "=") -> None:
    line = char * 50
    print(f"\n{line}\n  {title}\n{line}")


def show_state(memory: SimpleMemory, label: str = "") -> None:
    raw_n = len(memory.raw_messages)
    all_n = len(memory.all_messages)
    summary_n = len(memory.summaries)
    leafs = [s for s in memory.summaries if s.depth == 0 and len(s.parent_ids) == 0]
    parents = [s for s in memory.summaries if s.depth == 1]
    print(f"  [状态] raw_messages={raw_n}  all_messages={all_n}  summaries={summary_n}  (无父 leaf={len(leafs)}, condensed={len(parents)})")
    if label:
        print(f"  → {label}")


def main() -> None:
    _dir = os.path.dirname(os.path.abspath(__file__))
    test_json = os.path.join(_dir, "test_session.json")

    sep("1. 初始化 Memory", "=")
    memory = SimpleMemory(
        fresh_tail_count=4,
        leaf_chunk_tokens=30,    # 测试用：阈值调低，让少量消息就能触发压缩
        max_leaf_summaries_before_condense=3,
        llm_client=None,
        json_path=test_json,  # 测试过程中写入，结束后可打开 test_session.json 查看完整状态
    )
    from llm_client import LLMClient
    memory.llm_client = LLMClient()

    print("  参数: fresh_tail_count=4, leaf_chunk_tokens=30, max_leaf_before_condense=3")
    print("  预期: fresh tail 外累积超过 100 token 时触发压缩；无父 leaf ≥ 3 时合并成 condensed")
    show_state(memory, "初始：raw=0, 无摘要")

    test_messages = [
        ("user", "我在开发 HivemindOS"),
        ("assistant", "好的，这是一个 AI 操作系统方向的项目。"),
        ("user", "它有 Session Memory 和 Knowledge Memory"),
        ("assistant", "明白，分别对应会话记忆和长期知识记忆。"),
        ("user", "Session Memory 用 DAG 摘要"),
        ("assistant", "这样可以做分层压缩和可追溯。"),
        ("user", "Knowledge Memory 用图谱"),
        ("assistant", "这样适合表达长期知识和实体关系。"),
        ("user", "我们先做 MVP"),
        ("assistant", "建议先聚焦最小可行链路。"),
        ("user", "先做 raw store 和 summary"),
        ("assistant", "这样最容易先验证会话记忆链路。"),
        ("user", "然后再加长期知识"),
        ("assistant", "这会是一个更稳妥的迭代顺序。"),
    ]

    sep("2. 逐条添加消息并执行 maybe_compress", "-")
    for i, (role, content) in enumerate(test_messages):
        memory.add_message(role, content)
        memory.maybe_compress()

        n = i + 1
        raw_n = len(memory.raw_messages)
        summary_n = len(memory.summaries)

        outside_tok = memory._tokens_outside_fresh_tail()
        exp = (
            f"fresh tail 外 ~{outside_tok} tokens / 阈值 {memory.leaf_chunk_tokens}"
            + ("  → 触发压缩" if outside_tok >= memory.leaf_chunk_tokens else "")
        )
        print(f"  第 {n:2d} 条 ({role:9s}): {content[:36]}...")
        show_state(memory, exp)

    sep("3. 预期 vs 实际：摘要与 raw", "=")
    print("  预期: 至少 1 个摘要；raw_messages 为最近若干条（≤ fresh_tail_count 或略多几轮内）；")
    print("        若有多段压缩，应有 leaf 且可能有一个 condensed（depth=1）。")
    print("  实际:")
    memory.debug_print()

    sep("4. 完整上下文（送给模型的内容）", "=")
    context_preview = memory.get_context_preview(summary_max_chars=400, message_max_chars=200)
    print(context_preview)

    sep("5. 断言：关键信息是否在上下文中", "=")
    context = memory.build_context()
    context_text = "\n".join(block["content"] for block in context)
    required_keywords = [
        "HivemindOS",
        "Session Memory",
        "Knowledge Memory",
        "DAG",
        "MVP",
        "raw store",
        "summary",
    ]
    missing = [kw for kw in required_keywords if kw not in context_text]
    print("  预期: 以上关键词均应出现在「完整上下文」中（可在摘要或 fresh tail）。")
    if missing:
        print(f"  实际: 缺失关键词 → {missing}")
    else:
        print("  实际: 所有关键词均在上下文中 ✓")

    assert len(memory.summaries) >= 1, "应该至少生成一个摘要"
    assert "HivemindOS" in context_text, "完整上下文应包含 HivemindOS"
    assert "MVP" in context_text, "完整上下文应包含 MVP"
    assert "raw store" in context_text, "完整上下文应保留 raw store"
    assert "summary" in context_text, "完整上下文应保留 summary"
    assert (
        "长期知识" in context_text or "Knowledge Memory" in context_text
    ), "完整上下文应包含长期知识或 Knowledge Memory"
    execution_hints = ["先做", "然后", "后续", "优先", "当前"]
    assert any(h in context_text for h in execution_hints), "应体现实现顺序或当前阶段"

    sep("6. 结果", "=")
    print("  ✅ 全部断言通过，Session Memory 行为符合预期。")
    print(f"  完整状态已写入: {test_json}")
    print("")


if __name__ == "__main__":
    main()
