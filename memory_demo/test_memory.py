from memory import SimpleMemory


def print_title(title: str) -> None:
    print("\n" + "=" * 20)
    print(title)
    print("=" * 20)


def main() -> None:
    memory = SimpleMemory(
        fresh_tail_count=4,
        leaf_chunk_tokens=30,    # 测试用：阈值调低，让少量消息就能触发压缩
        max_leaf_summaries_before_condense=3,
        llm_client=None,  # 先占位，后面会手动注入真实 llm
    )

    # 这里直接复用你项目里的 LLMClient
    from llm_client import LLMClient
    memory.llm_client = LLMClient()

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

    for role, content in test_messages:
        memory.add_message(role, content)
        memory.maybe_compress()

    print_title("DEBUG MEMORY")
    memory.debug_print()

    assert len(memory.summaries) >= 1, "应该至少生成一个摘要"

    leaf_summaries = [s for s in memory.summaries if s.depth == 0]
    assert leaf_summaries, "应该至少有一个 leaf summary"

    # 打印第一个 leaf 便于肉眼检查
    print_title("LEAF SUMMARY CONTENT (sum_0)")
    print(leaf_summaries[0].content)

    # 送给模型的完整上下文 = 所有摘要 + 当前 raw_messages
    # 关键断言应对「整体上下文」做：关键信息要么在摘要里，要么在 fresh tail 里
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

    print_title("ASSERTIONS (against full context)")
    if missing:
        print("缺失关键词:", missing)
    else:
        print("关键词在完整上下文中均存在")

    assert "HivemindOS" in context_text, "完整上下文应包含项目名 HivemindOS"
    assert "MVP" in context_text, "完整上下文应包含当前阶段目标 MVP（可在摘要或 fresh tail）"
    assert "raw store" in context_text, "完整上下文应保留 raw store（执行顺序关键）"
    assert "summary" in context_text, "完整上下文应保留 summary（执行顺序关键）"
    assert (
        "长期知识" in context_text or "Knowledge Memory" in context_text
    ), "完整上下文应包含长期知识或 Knowledge Memory（主线不能丢）"

    # 执行顺序语义：至少在完整上下文中出现
    execution_hints = ["先做", "然后", "后续", "优先", "当前"]
    has_execution_signal = any(hint in context_text for hint in execution_hints)
    assert has_execution_signal, "完整上下文应体现实现顺序或当前阶段信息"

    print("✅ LLM 摘要测试通过")


if __name__ == "__main__":
    main()