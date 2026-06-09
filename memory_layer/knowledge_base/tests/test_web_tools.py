from unittest.mock import MagicMock, patch

from memory_layer.knowledge_base.core.tools.web_tools import read_url, web_search


def test_web_search_empty_query():
    r = web_search("")
    assert r["count"] == 0
    assert "error" in r


@patch("memory_layer.knowledge_base.core.tools.web_tools._tavily_search", return_value=[])
@patch("memory_layer.knowledge_base.core.tools.web_tools._duckduckgo_search")
def test_web_search_duckduckgo_fallback(mock_ddg, _mock_tavily):
    mock_ddg.return_value = [
        {"title": "Acme Corp", "url": "https://acme.example", "snippet": "B2B SaaS"},
    ]
    r = web_search("Acme Corp", limit=3)
    assert r["count"] == 1
    assert r["first_url"] == "https://acme.example"
    assert r["provider"] == "duckduckgo"


@patch("memory_layer.knowledge_base.core.tools.web_tools.httpx.Client")
def test_read_url_success(mock_client_cls):
    mock_resp = MagicMock()
    mock_resp.headers = {"content-type": "text/html"}
    mock_resp.text = "<html><body><p>Hello world</p></body></html>"
    mock_resp.raise_for_status = MagicMock()
    mock_client = MagicMock()
    mock_client.__enter__ = MagicMock(return_value=mock_client)
    mock_client.__exit__ = MagicMock(return_value=False)
    mock_client.get.return_value = mock_resp
    mock_client_cls.return_value = mock_client

    r = read_url("https://example.com")
    assert r["ok"] is True
    assert "Hello world" in r["content"]
