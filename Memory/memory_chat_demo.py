import os
import json
from dataclasses import dataclass, field
from typing import List, Dict, Any, Optional

try:
    from openai import OpenAI
except ImportError:
    OpenAI = None


# =========================
# 1. 基础数据结构
# =========================

@dataclass
class Message:
    role: str
    content: str


@dataclass
class SummaryNode:
    summary_id: str
    content: str
    source_indexes: List[int] = field(default_factory=list)


# =========================
# 2. 简单记忆模块
# =========================

class SimpleMemory:
    """
    一个最小可理解版的记忆系统：
    - 保存原始消息
    - 超过阈值时，把旧消息压成摘要
    - 保留最近 fresh_tail_count 条消息不压缩
    """

    def __init__(self, fresh_tail_count: int = 6, compress_trigger: int = 10):
        self.raw_messages: List[Message] = []
        self.summaries: List[SummaryNode] = []
        self.fresh_tail_count = fresh_tail_count
        self.compress_trigger = compress_trigger
        self.summary_counter = 0

    def add_message(self, role: str, content: str) -> None:
        self.raw_messages.append(Message(role=role, content=content))

    def maybe_compress(self) -> None:
        """
        如果消息太多，就把较早的一部分压成摘要。
        这里只做最简单版本：
        - 留下最近 fresh_tail_count 条
        - 更早的消息合并成一个 summary
        """
        if len(self.raw_messages) <= self.compress_trigger:
            return

        if len(self.raw_messages) <= self.fresh_tail_count:
            return

        old_count = len(self.raw_messages) - self.fresh_tail_count
        old_messages = self.raw_messages[:old_count]
        fresh_messages = self.raw_messages[old_count:]

        if not old_messages:
            return

        summary_text = self._simple_summarize(old_messages)

        summary = SummaryNode(
            summary_id=f"sum_{self.summary_counter}",
            content=summary_text,
            source_indexes=list(range(old_count)),
        )
        self.summary_counter += 1

        self.summaries.append(summary)
        self.raw_messages = fresh_messages

    def _simple_summarize(self, messages: List[Message]) -> str:
        """
        为了方便理解，这里不用 LLM 摘要，直接做一个非常简单的拼接摘要。
        真实系统里，这里会调用 LLM 生成 leaf summary。
        """
        lines = []
        for msg in messages:
            role_cn = "用户" if msg.role == "user" else "助手"
            text = msg.content.strip().replace("\n", " ")
            if len(text) > 60:
                text = text[:60] + "..."
            lines.append(f"{role_cn}: {text}")
        return "【历史摘要】\n" + "\n".join(lines)

    def build_context(self) -> List[Dict[str, str]]:
        """
        给大模型组装上下文：
        1. 先放所有摘要
        2. 再放最近 fresh tail 原始消息
        """
        context: List[Dict[str, str]] = []

        for s in self.summaries:
            context.append({
                "role": "system",
                "content": s.content
            })

        for msg in self.raw_messages:
            context.append({
                "role": msg.role,
                "content": msg.content
            })

        return context

    def debug_print(self) -> None:
        print("\n========== Memory Debug ==========")
        print(f"摘要数量: {len(self.summaries)}")
        for s in self.summaries:
            print(f"- {s.summary_id}: {s.content[:100]}")

        print(f"当前原始消息数量: {len(self.raw_messages)}")
        for i, msg in enumerate(self.raw_messages):
            print(f"  [{i}] {msg.role}: {msg.content[:80]}")
        print("==================================\n")


# =========================
# 3. 大模型客户端
# =========================

class LLMClient:
    """
    支持两种模式：
    1. 如果配置了 OPENAI_API_KEY，就调用真实大模型
    2. 如果没配，就进入 mock 模式，方便演示
    """

    def __init__(
        self,
        model: str = "gpt-4o-mini",
        base_url: Optional[str] = None,
        api_key: Optional[str] = None,
    ):
        self.model = model
        self.api_key = api_key or os.getenv("OPENAI_API_KEY")
        self.base_url = base_url or os.getenv("OPENAI_BASE_URL")

        self.client = None
        if OpenAI and self.api_key:
            kwargs: Dict[str, Any] = {"api_key": self.api_key}
            if self.base_url:
                kwargs["base_url"] = self.base_url
            self.client = OpenAI(**kwargs)

    def chat(self, messages: List[Dict[str, str]]) -> str:
        if self.client is None:
            # mock 模式：方便看记忆模块运行效果
            last_user = ""
            for m in reversed(messages):
                if m["role"] == "user":
                    last_user = m["content"]
                    break

            has_summary = any(m["role"] == "system" and "历史摘要" in m["content"] for m in messages)

            if has_summary:
                return f"[MOCK-带记忆] 我结合历史摘要理解你的问题：{last_user}"
            return f"[MOCK-无记忆] 我只根据当前消息回答：{last_user}"

        response = self.client.chat.completions.create(
            model=self.model,
            messages=messages,
            temperature=0.3,
        )
        return response.choices[0].message.content or ""


# =========================
# 4. 聊天程序
# =========================

class MemoryChatApp:
    def __init__(self):
        self.memory = SimpleMemory(
            fresh_tail_count=6,     # 最近 6 条消息不压缩
            compress_trigger=10,    # 超过 10 条时触发压缩
        )
        self.llm = LLMClient()

        self.system_prompt = (
            "你是一个带有记忆能力的助手。"
            "系统可能会提供历史摘要，请结合摘要和最近对话回答。"
        )

    def ask(self, user_input: str) -> str:
        # 1. 写入用户消息
        self.memory.add_message("user", user_input)

        # 2. 看是否需要压缩历史
        self.memory.maybe_compress()

        # 3. 组装上下文
        messages = [{"role": "system", "content": self.system_prompt}]
        messages.extend(self.memory.build_context())

        # 4. 调大模型
        answer = self.llm.chat(messages)

        # 5. 写入助手回答
        self.memory.add_message("assistant", answer)

        return answer

    def run(self) -> None:
        print("=== Memory Chat Demo ===")
        print("输入 exit 退出，输入 debug 查看记忆状态\n")

        while True:
            user_input = input("你: ").strip()

            if user_input.lower() in {"exit", "quit"}:
                print("退出。")
                break

            if user_input.lower() == "debug":
                self.memory.debug_print()
                continue

            answer = self.ask(user_input)
            print(f"助手: {answer}\n")


# =========================
# 5. 程序入口
# =========================

if __name__ == "__main__":
    app = MemoryChatApp()
    app.run()