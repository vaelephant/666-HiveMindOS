import json
import os
from typing import Callable, Optional
from openai import OpenAI

_client: Optional[OpenAI] = None

def _get_client() -> OpenAI:
    global _client
    if _client is None:
        _client = OpenAI(api_key=os.environ.get("OPENAI_API_KEY", ""))
    return _client

DEFAULT_MODEL = os.environ.get("DEFAULT_MODEL", "gpt-4o")
FAST_MODEL = os.environ.get("FAST_MODEL", "gpt-4o-mini")


def complete(
    prompt: str,
    system: Optional[str] = None,
    model: Optional[str] = None,
    max_tokens: int = 8192,
) -> str:
    model = model or DEFAULT_MODEL
    messages = []
    if system:
        messages.append({"role": "system", "content": system})
    messages.append({"role": "user", "content": prompt})
    response = _get_client().chat.completions.create(
        model=model,
        max_tokens=max_tokens,
        messages=messages,
    )
    return response.choices[0].message.content or ""


def agentic_loop(
    system: str,
    user_message: str,
    tools_schema: list[dict],
    tool_executor: Callable[[str, dict], str],
    model: Optional[str] = None,
    max_iterations: int = 10,
    on_step: Optional[Callable[[dict], None]] = None,
) -> tuple[str, list[dict]]:
    """Tool-calling agent loop. Returns (final_answer, steps)."""
    messages: list[dict] = [
        {"role": "system", "content": system},
        {"role": "user", "content": user_message},
    ]
    steps: list[dict] = []

    for _ in range(max_iterations):
        response = _get_client().chat.completions.create(
            model=model or DEFAULT_MODEL,
            messages=messages,
            tools=tools_schema,
            tool_choice="auto",
        )
        choice = response.choices[0]
        msg = choice.message

        if choice.finish_reason == "tool_calls" and msg.tool_calls:
            messages.append(msg.to_dict())
            for tc in msg.tool_calls:
                args = json.loads(tc.function.arguments)
                result = tool_executor(tc.function.name, args)
                step = {"tool": tc.function.name, "args": args, "result": result}
                steps.append(step)
                if on_step:
                    on_step(step)
                messages.append({
                    "role": "tool",
                    "tool_call_id": tc.id,
                    "content": str(result),
                })
        else:
            return msg.content or "", steps

    return "（已达最大步骤数，结果可能不完整）", steps
