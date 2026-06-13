import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parents[3]))
from model_layer import client as llm
from knowledge_base import config
from knowledge_base.core.wiki.wiki_manager import WikiManager
from knowledge_base.prompts import get, render

_LINT = get("agents.lint")


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

        sample_pages = [p for p in pages if p["path"] != "index.md"]
        if sample_pages:
            sample_content = page_contents.get(sample_pages[0]["path"], "")
            if sample_content:
                max_chars = _LINT.limit("sample_max_chars", 3000)
                feedback = llm.complete(
                    render("agents.lint", content=sample_content[:max_chars]),
                    system=_LINT.system,
                    profile=_LINT.resolve_profile(),
                )
                issues.append({
                    "type": "ai_review",
                    "page": sample_pages[0]["path"],
                    "feedback": feedback,
                    "severity": "info",
                })

        return {"total_pages": len(pages), "issues_found": len(issues), "issues": issues}
