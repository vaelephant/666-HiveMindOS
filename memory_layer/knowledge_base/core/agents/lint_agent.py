import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parents[4]))
from model_layer import client as llm
from memory_layer.knowledge_base import config
from memory_layer.knowledge_base.core.wiki.wiki_manager import WikiManager

_SYSTEM = "你是知识库质量审查员，检查 Wiki 文档的问题并给出具体建议。"


class LintAgent:
    def __init__(self, wiki: WikiManager):
        self.wiki = wiki

    def run(self, org_id: str) -> dict:
        pages = self.wiki.list_pages(org_id)
        issues: list[dict] = []

        all_content = ""
        page_contents: dict[str, str] = {}
        for page in pages:
            c = self.wiki.read_page(org_id, page["path"])
            if c:
                all_content += c
                page_contents[page["path"]] = c

        for page in pages:
            c = page_contents.get(page["path"], "")
            if len(c.strip()) < 50:
                issues.append({"type": "empty_page", "page": page["path"], "severity": "warning"})
            elif page["path"] != "index.md" and page["name"] not in all_content:
                issues.append({"type": "orphan_page", "page": page["path"], "severity": "info"})

        # AI quality review on first non-index page
        sample_pages = [p for p in pages if p["path"] != "index.md"]
        if sample_pages:
            sample_content = page_contents.get(sample_pages[0]["path"], "")
            if sample_content:
                feedback = llm.complete(
                    f"检查此 Wiki 页面质量，指出内容缺失或需补充的地方：\n\n{sample_content[:3000]}",
                    system=_SYSTEM,
                    model=config.FAST_MODEL,
                )
                issues.append({
                    "type": "ai_review",
                    "page": sample_pages[0]["path"],
                    "feedback": feedback,
                    "severity": "info",
                })

        return {"total_pages": len(pages), "issues_found": len(issues), "issues": issues}
