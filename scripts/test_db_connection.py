#!/usr/bin/env python3
"""Test PostgreSQL connectivity using DB_* / DATABASE_URL from .env files."""

from __future__ import annotations

import os
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def load_dotenv() -> list[str]:
    loaded: list[str] = []
    try:
        from dotenv import load_dotenv as _load
    except ImportError:
        print("⚠ python-dotenv 未安装，仅使用当前 shell 环境变量")
        return loaded

    for path in (ROOT / ".env", ROOT / "webui" / ".env", ROOT / ".env.local"):
        if path.is_file():
            _load(path, override=False)
            loaded.append(str(path.relative_to(ROOT)))
    return loaded


def connection_params() -> dict[str, str]:
    if os.environ.get("DATABASE_URL"):
        return {"url": os.environ["DATABASE_URL"]}

    return {
        "host": os.environ.get("DB_HOST", "localhost"),
        "port": os.environ.get("DB_PORT", "5432"),
        "user": os.environ.get("DB_USER", "postgres"),
        "password": os.environ.get("DB_PASSWORD", ""),
        "dbname": os.environ.get("DB_NAME", "hivemindos"),
    }


def mask_url(url: str) -> str:
    if "@" not in url:
        return url
    return f"postgresql://***:***@{url.split('@', 1)[1]}"


def main() -> int:
    loaded = load_dotenv()
    params = connection_params()

    print("── 环境 ──")
    if loaded:
        print("已加载:", ", ".join(loaded))
    else:
        print("未加载 .env 文件")

    print("\n── 连接参数 ──")
    if "url" in params:
        print(f"DATABASE_URL = {mask_url(params['url'])}")
    else:
        print(f"DB_HOST     = {params['host']}")
        print(f"DB_PORT     = {params['port']}")
        print(f"DB_USER     = {params['user']}")
        print(f"DB_NAME     = {params['dbname']}")
        print(f"DB_PASSWORD = {'(已设置)' if params['password'] else '(空)'}")

    try:
        import psycopg
    except ImportError:
        print("\n✗ 缺少依赖: pip install 'psycopg[binary]'", file=sys.stderr)
        return 1

    print("\n── 测试连接 ──")
    try:
        if "url" in params:
            conn = psycopg.connect(params["url"], connect_timeout=5)
        else:
            conn = psycopg.connect(
                host=params["host"],
                port=params["port"],
                user=params["user"],
                password=params["password"],
                dbname=params["dbname"],
                connect_timeout=5,
            )

        with conn:
            row = conn.execute(
                "SELECT current_user, current_database(), version()"
            ).fetchone()

        print("✓ 连接成功")
        print(f"  用户:     {row[0]}")
        print(f"  数据库:   {row[1]}")
        print(f"  版本:     {row[2].split(',')[0]}")
        return 0

    except Exception as exc:
        print(f"✗ 连接失败: {exc}")
        print("\n常见原因:")
        print("  1. DB_USER / DB_PASSWORD 与本地 PostgreSQL 不一致")
        print("  2. 数据库不存在 → createdb -U <user> hivemindos")
        print("  3. PostgreSQL 未启动 → brew services start postgresql@16")
        print("  4. 应连远程库 → 在 webui/.env 改 DB_HOST / DB_PORT")
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
