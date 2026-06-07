import json
import re
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parents[4]))
from model_layer import client as llm
from memory_layer.knowledge_base import config
from memory_layer.knowledge_base.app.logging_config import get_logger

log = get_logger("hivemind.compiler.entity")

_SYSTEM = """你是企业知识图谱构建专家。
任务：从企业文档中提取有实际业务意义的实体，构建结构化知识图谱。
要求：只输出合法 JSON，不含 markdown 代码块，不含任何解释文字。"""

_PROMPT = """从以下企业文档中提取实体。

【实体类型】
- company   : 公司、企业法人（有具体名称）
- person    : 具名自然人（有姓名，非泛指"相关人员"）
- product   : 具体产品或服务
- contract  : 具体合同或协议（有合同号或明确描述）
- department: 部门、机构、政府机关
- rule      : 法律法规（如《企业所得税法》）
- customer  : 客户或合作方企业

【严格排除 — 以下内容不得作为实体】
- 单纯年份数字（2021、2022、2023、2024 等）
- 附件编号（附件1、附件2、Attachment A 等）
- 无特指的通用词（"合同"、"报告"、"说明"、"方案"等）
- 纯数值、金额、百分比
- 文档章节标题或编号

【属性提取】
尽可能从文档中找到并填写：统一社会信用代码、注册资本、地址、金额、
合同编号、签署日期、有效期、税率、联系方式等。无则留 {{}}。
文档中若标注了 [第N页]，请在 attribute_provenance 中填写对应页码与原文片段。

【关系提取】
提取实体间明确存在的关系，类型：
belongs_to（归属）/ manages（管理）/ partners（合作）/
signs（签署）/ audits（审计）/ supplies（供应）/ governed_by（受约束于）

文档内容：
{content}

---
输出格式（严格 JSON，无其他内容）：
{{
  "entities": [
    {{
      "name": "实体全称（与文档一致，不缩写）",
      "type": "company|person|product|contract|department|rule|customer",
      "description": "基于文档的准确描述，不得杜撰，不超过 60 字",
      "attributes": {{
        "属性名": "属性值"
      }},
      "attribute_provenance": {{
        "属性名": {{
          "page": 1,
          "excerpt": "原文中的相关片段",
          "confidence": "high|medium|low"
        }}
      }},
      "relations": [
        {{
          "target": "关联实体名称",
          "type": "关系类型"
        }}
      ]
    }}
  ]
}}"""


def _parse_json(raw: str) -> dict:
    """Strip markdown fences then parse JSON."""
    raw = re.sub(r"^```(?:json)?\s*", "", raw.strip(), flags=re.IGNORECASE)
    raw = re.sub(r"\s*```$", "", raw.strip())
    return json.loads(raw)


def extract_entities(content: str) -> list[dict]:
    # Use more content — 16 000 chars covers most business docs
    prompt = _PROMPT.format(content=content[:16000])
    raw = llm.complete(prompt, system=_SYSTEM, model=config.FAST_MODEL)
    log.debug("entity extractor raw response length=%d", len(raw))
    try:
        result = _parse_json(raw)
        entities = result.get("entities", [])
        log.debug("parsed %d entities", len(entities))
        return entities
    except (json.JSONDecodeError, AttributeError) as e:
        log.warning("entity JSON parse failed: %s | raw=%s…", e, raw[:200])
        return []
