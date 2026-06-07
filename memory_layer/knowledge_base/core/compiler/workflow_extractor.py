import json
import re
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parents[4]))
from model_layer import client as llm
from memory_layer.knowledge_base import config
from memory_layer.knowledge_base.app.logging_config import get_logger

log = get_logger("hivemind.compiler.workflow")

_SYSTEM = """你是企业流程与规则分析专家。
任务：从企业文档中提取完整的业务流程和可执行规则，构建企业执行知识库。
要求：只输出合法 JSON，不含 markdown 代码块，不含任何解释文字。"""

_PROMPT = """从以下企业文档中提取业务流程和业务规则。

【流程提取要求】
- 只提取文档中有完整步骤描述的流程，每步需含动作主体 + 具体操作
- 捕获流程中的条件分支和例外情况
- 不提取泛泛的管理原则或口号

【规则提取要求】
- 每条规则必须有明确的触发条件（含具体数值、阈值、时间限制等）
- 必须说明违反规则的后果（如有）
- 捕获法律法规引用和内部制度依据
- 不提取没有可执行性的模糊描述

文档内容：
{content}

---
输出格式（严格 JSON，无其他内容）：
{{
  "workflows": [
    {{
      "name": "流程名称（简洁，体现业务目标）",
      "trigger": "触发该流程的事件或条件",
      "steps": [
        "【角色】具体操作步骤"
      ],
      "conditions": ["需满足的前提条件"],
      "participants": ["参与角色"],
      "duration": "预计时长或截止要求（如有，否则留空字符串）",
      "output": "流程产出物"
    }}
  ],
  "rules": [
    {{
      "name": "规则名称",
      "condition": "精确触发条件（必须含具体数值或明确情形）",
      "action": "必须执行的动作（具体且可操作）",
      "source": "规则来源（法规名称、合同条款或内部制度）",
      "penalty": "违规后果（无则留空字符串）"
    }}
  ]
}}"""


def _parse_json(raw: str) -> dict:
    """Strip markdown fences then parse JSON."""
    raw = re.sub(r"^```(?:json)?\s*", "", raw.strip(), flags=re.IGNORECASE)
    raw = re.sub(r"\s*```$", "", raw.strip())
    return json.loads(raw)


def extract_workflows(content: str) -> dict:
    prompt = _PROMPT.format(content=content[:16000])
    raw = llm.complete(prompt, system=_SYSTEM, model=config.FAST_MODEL)
    log.debug("workflow extractor raw response length=%d", len(raw))
    try:
        result = _parse_json(raw)
        log.debug("parsed %d workflows, %d rules",
                  len(result.get("workflows", [])),
                  len(result.get("rules", [])))
        return result
    except (json.JSONDecodeError, AttributeError) as e:
        log.warning("workflow JSON parse failed: %s | raw=%s…", e, raw[:200])
        return {"workflows": [], "rules": []}
