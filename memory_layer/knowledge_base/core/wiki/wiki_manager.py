from pathlib import Path
from typing import Optional


class WikiManager:
    def __init__(self, wiki_root: Path):
        self.root = wiki_root

    def org_root(self, org_id: str) -> Path:
        p = self.root / org_id
        p.mkdir(parents=True, exist_ok=True)
        return p

    def read_page(self, org_id: str, wiki_path: str) -> Optional[str]:
        p = self.root / org_id / wiki_path
        return p.read_text(encoding="utf-8") if p.exists() else None

    def write_page(self, org_id: str, wiki_path: str, content: str):
        p = self.root / org_id / wiki_path
        p.parent.mkdir(parents=True, exist_ok=True)
        p.write_text(content, encoding="utf-8")

    def list_pages(self, org_id: str, category: Optional[str] = None) -> list[dict]:
        base = self.root / org_id
        if category:
            base = base / category
        if not base.exists():
            return []
        return [
            {
                "path": str(f.relative_to(self.root / org_id)),
                "name": f.stem,
                "category": f.relative_to(self.root / org_id).parts[0]
                if len(f.relative_to(self.root / org_id).parts) > 1
                else "root",
            }
            for f in base.rglob("*.md")
        ]

    def update_index(self, org_id: str):
        pages = self.list_pages(org_id)
        by_cat: dict[str, list] = {}
        for p in pages:
            by_cat.setdefault(p["category"], []).append(p)

        lines = ["# 知识库索引\n"]
        for cat, cat_pages in sorted(by_cat.items()):
            if cat == "root":
                continue
            lines.append(f"\n## {cat}\n")
            for page in sorted(cat_pages, key=lambda x: x["name"]):
                lines.append(f"- [{page['name']}]({page['path']})")

        self.write_page(org_id, "index.md", "\n".join(lines))
