from pathlib import Path
from typing import Optional

from knowledge_base.core.wiki.categories import category_meta
from knowledge_base.core.wiki import wiki_meta


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
        org_base = self.root / org_id
        pages = []
        for f in base.rglob("*.md"):
            if f.name == "index.md":
                continue
            rel = str(f.relative_to(org_base))
            sidecar = wiki_meta.load_meta(self.root, org_id, rel)
            summary = wiki_meta.list_summary_from_meta(sidecar, rel)
            pages.append(
                {
                    "path": rel,
                    "name": f.stem,
                    "category": f.relative_to(org_base).parts[0]
                    if len(f.relative_to(org_base).parts) > 1
                    else "root",
                    **summary,
                }
            )
        return pages

    def list_categories(self, org_id: str) -> list[dict]:
        """Return wiki categories that currently have at least one page."""
        counts: dict[str, int] = {}
        for page in self.list_pages(org_id):
            cat = page["category"]
            if cat == "root":
                continue
            counts[cat] = counts.get(cat, 0) + 1

        categories = []
        for key, page_count in counts.items():
            meta = category_meta(key)
            categories.append(
                {
                    "key": key,
                    "label": meta["label"],
                    "description": meta["description"],
                    "page_count": page_count,
                    "order": meta["order"],
                }
            )

        categories.sort(key=lambda c: (c["order"], c["key"]))
        return categories

    def update_index(self, org_id: str):
        pages = self.list_pages(org_id)
        by_cat: dict[str, list] = {}
        for p in pages:
            by_cat.setdefault(p["category"], []).append(p)

        lines = ["# Wiki 索引\n"]
        for cat, cat_pages in sorted(by_cat.items()):
            if cat == "root":
                continue
            lines.append(f"\n## {cat}\n")
            for page in sorted(cat_pages, key=lambda x: x["name"]):
                lines.append(f"- [{page['name']}]({page['path']})")

        self.write_page(org_id, "index.md", "\n".join(lines))
