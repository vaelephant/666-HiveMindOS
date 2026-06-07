import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parents[4]))
from model_layer import client as llm
from memory_layer.knowledge_base import config

_SYSTEM = "你是企业流程提取专家。只输出合法 JSON，不要任何其他内容。"

_PROMPT = """分析以下企业文档，提取所有业务流程和规则。

文档内容：
{content}

以 JSON 格式返回：
{{
  "workflows": [
    {{
      "name": "流程名称",
      "steps": ["步骤1", "步骤2"],
      "conditions": ["超过10万需要审批"],
      "participants": ["销售", "审批人"]
    }}
  ],
  "rules": [
    {{
      "name": "规则名称",
      "condition": "触发条件",
      "action": "执行动作"
    }}
  ]
}}"""


def extract_workflows(content: str) -> dict:
    prompt = _PROMPT.format(content=content[:8000])
    raw = llm.complete(prompt, system=_SYSTEM, model=config.FAST_MODEL)
    try:
        return json.loads(raw)
    except json.JSONDecodeError:
        return {"workflows": [], "rules": []}
