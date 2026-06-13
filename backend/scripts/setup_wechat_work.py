#!/usr/bin/env python3
"""
Configure WeChat Work (企业微信) for an org and run connectivity checks.

Usage (project root):
    python scripts/setup_wechat_work.py \\
        --org u-1-im2731 \\
        --corp-id ww621b529cfe3ecfb5 \\
        --agent-id 1000006 \\
        --secret "$WECHAT_WORK_SECRET" \\
        --token "$WECHAT_WORK_TOKEN" \\
        --aes-key "$WECHAT_WORK_AES_KEY" \\
        --enable

    # Skip DB write (API + crypto tests only):
    python scripts/setup_wechat_work.py --skip-db ...

Environment fallbacks: WECHAT_WORK_CORP_ID, WECHAT_WORK_AGENT_ID, WECHAT_WORK_SECRET,
WECHAT_WORK_TOKEN, WECHAT_WORK_ENCODING_AES_KEY
"""

from __future__ import annotations

import argparse
import os
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))


def load_dotenv() -> None:
    try:
        from dotenv import load_dotenv as _load
    except ImportError:
        return
    for path in (ROOT.parent / ".env", ROOT.parent / "webui" / ".env", ROOT.parent / ".env.local"):
        if path.is_file():
            _load(path, override=False)


def test_access_token(corp_id: str, secret: str) -> str:
    from integrations.wechat_work.client import WeChatWorkClient

    client = WeChatWorkClient(corp_id, secret)
    token = client.get_access_token()
    print(f"  ✓ access_token OK (prefix: {token[:8]}…)")
    return token


def _encrypt_echostr(token: str, aes_key: str, corp_id: str, echostr: str, timestamp: str, nonce: str) -> tuple[str, str]:
    from wechatpy.crypto import _get_signature
    from wechatpy.enterprise.crypto import PrpCrypto, WeChatCrypto
    from wechatpy.utils import to_text

    crypto = WeChatCrypto(token, aes_key, corp_id)
    encrypted = to_text(PrpCrypto(crypto.key).encrypt(echostr, corp_id))
    msg_sig = _get_signature(token, timestamp, nonce, encrypted)
    return msg_sig, encrypted


def test_webhook_crypto(token: str, aes_key: str, corp_id: str) -> None:
    from integrations.wechat_work.webhook_handler import verify_url

    echostr = "hivemind_echo_test"
    msg_sig, encrypted = _encrypt_echostr(token, aes_key, corp_id, echostr, "1700000000", "nonce_test")
    plain = verify_url(msg_sig, "1700000000", "nonce_test", encrypted, token, aes_key, corp_id)
    if plain != echostr:
        raise RuntimeError(f"crypto round-trip mismatch: {plain!r}")
    print("  ✓ webhook URL verify crypto round-trip OK")


def save_config(
    org_id: str,
    corp_id: str,
    agent_id: str,
    secret: str,
    token: str,
    aes_key: str,
    enabled: bool,
) -> None:
    from integrations.wechat_work.registry import WeChatWorkRegistry

    reg = WeChatWorkRegistry()
    reg.upsert_org_config(org_id, corp_id, agent_id, secret, token, aes_key, enabled)
    cfg = reg.get_org_config(org_id)
    if not cfg or not cfg.enabled:
        raise RuntimeError("config saved but enabled flag mismatch")
    print(f"  ✓ saved org config for {org_id} (enabled={enabled})")


def test_webhook_endpoint(base_url: str, org_id: str, token: str, aes_key: str, corp_id: str) -> None:
    import httpx

    echostr = "endpoint_verify_test"
    msg_sig, encrypted = _encrypt_echostr(token, aes_key, corp_id, echostr, "1700000001", "nonce_ep")
    url = f"{base_url.rstrip('/')}/api/v1/webhooks/wechat-work/{org_id}"
    resp = httpx.get(
        url,
        params={
            "msg_signature": msg_sig,
            "timestamp": "1700000001",
            "nonce": "nonce_ep",
            "echostr": encrypted,
        },
        timeout=15.0,
    )
    if resp.status_code != 200:
        raise RuntimeError(f"webhook GET {resp.status_code}: {resp.text[:200]}")
    if resp.text.strip() != echostr:
        raise RuntimeError(f"webhook echo mismatch: {resp.text!r}")
    print(f"  ✓ live webhook verify OK ({url})")


def main() -> int:
    load_dotenv()
    p = argparse.ArgumentParser(description="Configure and test WeChat Work integration")
    p.add_argument("--org", default=os.environ.get("WECHAT_WORK_ORG_ID", "u-1-im2731"))
    p.add_argument("--corp-id", default=os.environ.get("WECHAT_WORK_CORP_ID", ""))
    p.add_argument("--agent-id", default=os.environ.get("WECHAT_WORK_AGENT_ID", ""))
    p.add_argument("--secret", default=os.environ.get("WECHAT_WORK_SECRET", ""))
    p.add_argument("--token", default=os.environ.get("WECHAT_WORK_TOKEN", ""))
    p.add_argument("--aes-key", default=os.environ.get("WECHAT_WORK_ENCODING_AES_KEY", ""))
    p.add_argument("--enable", action="store_true", help="Enable integration after save")
    p.add_argument("--skip-db", action="store_true", help="Skip PostgreSQL upsert")
    p.add_argument(
        "--webhook-base",
        default=os.environ.get("WECHAT_WORK_WEBHOOK_BASE", ""),
        help="Public API base for live webhook test, e.g. https://www.zhiyuandongli.com",
    )
    args = p.parse_args()

    missing = [k for k, v in [
        ("corp-id", args.corp_id), ("agent-id", args.agent_id),
        ("secret", args.secret), ("token", args.token), ("aes-key", args.aes_key),
    ] if not v.strip()]
    if missing:
        print(f"✗ missing required args: {', '.join(missing)}", file=sys.stderr)
        return 1

    print(f"── WeChat Work setup for org={args.org} ──\n")

    print("1) API token")
    try:
        test_access_token(args.corp_id.strip(), args.secret.strip())
    except Exception as exc:
        print(f"  ✗ {exc}", file=sys.stderr)
        return 1

    print("\n2) Webhook crypto")
    try:
        test_webhook_crypto(args.token.strip(), args.aes_key.strip(), args.corp_id.strip())
    except Exception as exc:
        print(f"  ✗ {exc}", file=sys.stderr)
        return 1

    if not args.skip_db:
        print("\n3) Save to PostgreSQL")
        try:
            save_config(
                args.org.strip(),
                args.corp_id.strip(),
                args.agent_id.strip(),
                args.secret.strip(),
                args.token.strip(),
                args.aes_key.strip(),
                args.enable or True,
            )
        except Exception as exc:
            print(f"  ✗ {exc}", file=sys.stderr)
            print("    Tip: start PostgreSQL or pass --skip-db for API-only tests")
            return 1
    else:
        print("\n3) Save to PostgreSQL — skipped")

    if args.webhook_base.strip():
        print("\n4) Live webhook endpoint")
        try:
            test_webhook_endpoint(
                args.webhook_base.strip(),
                args.org.strip(),
                args.token.strip(),
                args.aes_key.strip(),
                args.corp_id.strip(),
            )
        except Exception as exc:
            print(f"  ✗ {exc}", file=sys.stderr)
            return 1

    print(f"\n✓ Done. Callback URL:\n  {args.webhook_base or 'https://<your-domain>'}/api/v1/webhooks/wechat-work/{args.org}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
