import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parents[4]))
from model_layer import client as llm
from memory_layer.knowledge_base import config

_SYSTEM = "你是企业知识提取专家。只输出合法 JSON，不要任何其他内容。"

_PROMPT = """分析以下企业文档，提取所有重要实体。

文档内容：
{content}

以 JSON 格式返回：
{{
  "entities": [
    {{
      "name": "实体名称",
      "type": "person|product|process|rule|customer|contract|department",
      "description": "简短描述",
      "attributes": {{}}
    }}
  ]
}}"""


def extract_entities(content: str) -> list[dict]:
    prompt = _PROMPT.format(content=content[:8000])
    raw = llm.complete(prompt, system=_SYSTEM, model=config.FAST_MODEL)
    try:
        return json.loads(raw).get("entities", [])
    except (json.JSONDecodeError, AttributeError):
        return []
