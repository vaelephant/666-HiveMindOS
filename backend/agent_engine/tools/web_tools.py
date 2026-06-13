"""外域网络工具 — web_search / read_url（Phase 1.5）。"""

from __future__ import annotations

import os
import re
from html import unescape
from urllib.parse import quote_plus, urlparse

import httpx

from server.logging_config import get_logger

log = get_logger("hivemind.web_tools")

_TAG_RE = re.compile(r"<[^>]+>")
_WS_RE = re.compile(r"\s+")


def _strip_html(html: str) -> str:
    text = unescape(_TAG_RE.sub(" ", html))
    return _WS_RE.sub(" ", text).strip()


def _tavily_search(query: str, limit: int) -> list[dict]:
    api_key = os.environ.get("TAVILY_API_KEY", "")
    if not api_key:
        return []
    try:
        with httpx.Client(timeout=20.0) as client:
            resp = client.post(
                "https://api.tavily.com/search",
                json={
                    "api_key": api_key,
                    "query": query,
                    "max_results": limit,
                    "search_depth": "basic",
                },
            )
            resp.raise_for_status()
            data = resp.json()
        items = []
        for r in data.get("results") or []:
            items.append({
                "title": r.get("title") or "",
                "url": r.get("url") or "",
                "snippet": (r.get("content") or "")[:500],
            })
        return items
    except Exception as exc:
        log.warning("[web] tavily failed: %s", exc)
        return []


def _duckduckgo_search(query: str, limit: int) -> list[dict]:
    """DuckDuckGo HTML lite — 无需 API Key。"""
    items: list[dict] = []
    try:
        url = f"https://lite.duckduckgo.com/lite/?q={quote_plus(query)}"
        with httpx.Client(timeout=15.0, follow_redirects=True) as client:
            resp = client.get(url, headers={"User-Agent": "HiveMindOS/1.0"})
            resp.raise_for_status()
            html = resp.text

        # lite 结果：<a rel="nofollow" href="...">title</a> ... <td class="result-snippet">
        link_pat = re.compile(
            r'<a[^>]+rel="nofollow"[^>]+href="([^"]+)"[^>]*>([^<]+)</a>',
            re.IGNORECASE,
        )
        snippet_pat = re.compile(
            r'<td[^>]*class="result-snippet"[^>]*>([^<]+(?:<[^>]+>[^<]*)*)</td>',
            re.IGNORECASE,
        )
        links = link_pat.findall(html)
        snippets = [_strip_html(s) for s in snippet_pat.findall(html)]

        for i, (href, title) in enumerate(links[:limit]):
            if not href.startswith("http"):
                continue
            snippet = snippets[i][:500] if i < len(snippets) else ""
            items.append({"title": _strip_html(title), "url": href, "snippet": snippet})
            if len(items) >= limit:
                break

        if not items:
            # Instant Answer API 兜底
            api_url = f"https://api.duckduckgo.com/?q={quote_plus(query)}&format=json&no_html=1"
            with httpx.Client(timeout=10.0) as client:
                data = client.get(api_url).json()
            abstract = data.get("AbstractText") or ""
            abs_url = data.get("AbstractURL") or ""
            if abstract:
                items.append({
                    "title": data.get("Heading") or query,
                    "url": abs_url or "",
                    "snippet": abstract[:500],
                })
            for topic in (data.get("RelatedTopics") or [])[: limit - len(items)]:
                if isinstance(topic, dict) and topic.get("Text"):
                    items.append({
                        "title": topic["Text"][:80],
                        "url": topic.get("FirstURL") or "",
                        "snippet": topic["Text"][:500],
                    })
    except Exception as exc:
        log.warning("[web] duckduckgo failed: %s", exc)
    return items[:limit]


def web_search(query: str, *, limit: int = 5) -> dict:
    query = (query or "").strip()
    if not query:
        return {"count": 0, "items": [], "error": "搜索词为空", "provider": "none"}

    items = _tavily_search(query, limit)
    provider = "tavily" if items else "duckduckgo"
    if not items:
        items = _duckduckgo_search(query, limit)

    first_url = ""
    for it in items:
        if it.get("url"):
            first_url = it["url"]
            break

    return {
        "count": len(items),
        "items": items,
        "first_url": first_url,
        "provider": provider,
        "query": query,
    }


def read_url(url: str, *, max_chars: int = 8000) -> dict:
    url = (url or "").strip()
    if not url:
        return {"ok": False, "error": "URL 为空", "chars": 0, "content": ""}
    parsed = urlparse(url)
    if parsed.scheme not in ("http", "https"):
        return {"ok": False, "error": "仅支持 http/https", "chars": 0, "content": ""}

    try:
        with httpx.Client(timeout=20.0, follow_redirects=True) as client:
            resp = client.get(url, headers={"User-Agent": "HiveMindOS/1.0"})
            resp.raise_for_status()
            content_type = (resp.headers.get("content-type") or "").lower()
            raw = resp.text
        if "html" in content_type or "<html" in raw[:500].lower():
            text = _strip_html(raw)
        else:
            text = raw
        text = text[:max_chars]
        return {"ok": True, "url": url, "chars": len(text), "content": text}
    except Exception as exc:
        log.warning("[web] read_url failed url=%s err=%s", url[:60], exc)
        return {"ok": False, "url": url, "error": str(exc), "chars": 0, "content": ""}
