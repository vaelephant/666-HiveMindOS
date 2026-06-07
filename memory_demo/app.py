import os
from memory import SimpleMemory
from llm_client import LLMClient

# 持久化文件固定放在 memory_demo 目录下，与运行时的 cwd 无关
_MEMORY_DEMO_DIR = os.path.dirname(os.path.abspath(__file__))
_SESSION_DB = os.path.join(_MEMORY_DEMO_DIR, "session.db")


class MemoryChatApp:
    def __init__(self):
        self.llm = LLMClient()

        self.memory = SimpleMemory(
            fresh_tail_count=10,       # 保留最近 10 条不压缩
            leaf_chunk_tokens=2000,    # fresh tail 外累积超过 2000 token 时触发压缩
            max_leaf_summaries_before_condense=3,
            llm_client=self.llm,
            db_path=_SESSION_DB,  # SQLite 持久化，数据库在 memory_demo/session.db
        )

        self.system_prompt = (
            "你是一个带有记忆能力的助手。"
            "系统可能会提供历史摘要，请结合摘要和最近对话回答。"
            "不要臆测自己的具体模型版本；若不确定，直接说你是AI助手。"
        )

    def ask(self, user_input: str) -> str:
        self.memory.add_message("user", user_input)
        repaired = self.memory.maybe_compress()
        if repaired:
            print(f"[Memory] 自愈修复了 {repaired} 个降级摘要 ✓")

        messages = [{"role": "system", "content": self.system_prompt}]
        messages.extend(
            self.memory.build_context(user_query=user_input, retrieve_top_k=5)
        )

        # 每次聊天前打印本轮发给大模型的内容
        print("\n" + "=" * 50)
        print("【本轮发给大模型的消息】")
        print("=" * 50)
        print("[system]", self.system_prompt)
        print("-" * 50)
        for i, block in enumerate(messages[1:], start=1):  # 跳过 system
            role = block["role"]
            content = block["content"]
            preview = content[:300] + "..." if len(content) > 300 else content
            print(f"[{i}] {role}:\n{preview}")
            if len(content) > 300:
                print()
        print("=" * 50 + "\n")

        answer = self.llm.chat(messages)
        self.memory.add_message("assistant", answer)
        return answer

    def run(self) -> None:
        print("=== Memory Chat Demo (with expand) ===")
        # 启动恢复：若持久化里有数据则已在此前通过 SimpleMemory(db_path=...) 自动恢复
        n_all = len(self.memory.all_messages)
        n_raw = len(self.memory.raw_messages)
        n_sum = len(self.memory.summaries)
        if n_all > 0:
            print(f"已从持久化恢复：all_messages={n_all} 条，raw_messages={n_raw} 条，summaries={n_sum} 个，summary_counter={self.memory.summary_counter}")
        else:
            print("新会话（无历史）")
        print("输入 exit 退出，输入 debug 查看记忆状态，输入 context 查看当前将发给模型的上下文")
        print("输入 expand sum_x 展开某个摘要\n")

        while True:
            user_input = input("你: ").strip()

            if not user_input:
                print("请输入内容。\n")
                continue

            if user_input.lower() in {"exit", "quit"}:
                print("退出。")
                break

            if user_input.lower() == "debug":
                self.memory.debug_print()
                continue

            if user_input.lower() == "context":
                print(self.memory.get_context_preview())
                continue

            if user_input.startswith("recall "):
                query = user_input.split(" ", 1)[1].strip()
                print(self.memory.explain_retrieve(query))
                continue

            if user_input.startswith("expand "):
                summary_id = user_input.split(" ", 1)[1].strip()
                result = self.memory.expand_summary(summary_id)

                print("\n========== 展开结果 ==========")
                print(f"summary_id: {result['summary_id']}")
                print(f"found: {result['found']}")
                print(f"type: {result['type']}")
                print(f"depth: {result.get('depth')}")
                print(f"content: {result.get('content', '')}")

                if result["children"]:
                    print("\n--- children ---")
                    for child in result["children"]:
                        print(f"- {child['summary_id']} | depth={child['depth']}")
                        print(f"  {child['content'][:120]}")

                if result["messages"]:
                    print("\n--- messages ---")
                    for msg in result["messages"]:
                        print(f"[{msg['index']}] {msg['role']}: {msg['content']}")

                print("================================\n")
                continue

            answer = self.ask(user_input)
            print(f"助手: {answer}\n")


if __name__ == "__main__":
    app = MemoryChatApp()
    app.run()