import os
from typing import List, Dict, Any, Optional

try:
    from openai import OpenAI
except ImportError:
    OpenAI = None


class LLMClient:
    """
    支持两种模式：
    1. 配了 OPENAI_API_KEY -> 调真实模型
    2. 没配 -> 进入 mock 模式，方便演示记忆效果
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

    def chat(self, messages: List[Dict[str, str]], temperature: float = 0.3) -> str:
        if self.client is None:
            last_user = ""
            for m in reversed(messages):
                if m["role"] == "user":
                    last_user = m["content"]
                    break

            has_summary = any(
                m["role"] == "system" and ("历史摘要" in m["content"] or "<summary" in m["content"])
                for m in messages
            )

            if has_summary:
                return f"[MOCK-带记忆] 我结合历史摘要理解你的问题：{last_user}"
            return f"[MOCK-无记忆] 我只根据当前消息回答：{last_user}"

        response = self.client.chat.completions.create(
            model=self.model,
            messages=messages,
            temperature=temperature,
        )
        return response.choices[0].message.content or ""