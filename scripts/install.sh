#!/usr/bin/env bash
# HiveMindOS 一键安装：Python 依赖、数据库迁移、Web UI 依赖
#
# 用法:
#   ./scripts/install.sh              # 完整安装
#   ./scripts/install.sh --with-qdrant  # 额外启动 Qdrant 容器
#   ./scripts/install.sh --skip-webui   # 只装后端
#   ./scripts/install.sh --skip-migrate # 跳过数据库迁移

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

WITH_QDRANT=false
SKIP_WEBUI=false
SKIP_MIGRATE=false

usage() {
  cat <<'EOF'
HiveMindOS 安装脚本

用法: ./scripts/install.sh [选项]

选项:
  --with-qdrant    用 Docker 启动 Qdrant（6333 端口）
  --skip-webui     跳过 Web UI（pnpm install / db:push）
  --skip-migrate   跳过数据库迁移
  -h, --help       显示帮助
EOF
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --with-qdrant) WITH_QDRANT=true ;;
    --skip-webui) SKIP_WEBUI=true ;;
    --skip-migrate) SKIP_MIGRATE=true ;;
    -h|--help) usage; exit 0 ;;
    *) echo "未知选项: $1" >&2; usage; exit 1 ;;
  esac
  shift
done

info()  { echo "→ $*"; }
ok()    { echo "✓ $*"; }
warn()  { echo "⚠ $*" >&2; }
fail()  { echo "✗ $*" >&2; exit 1; }

need_cmd() {
  command -v "$1" >/dev/null 2>&1 || fail "缺少命令: $1"
}

info "检查运行环境…"
need_cmd python3
need_cmd node

PYTHON="${PYTHON:-python3}"
if ! "$PYTHON" -c 'import sys; exit(0 if sys.version_info >= (3, 11) else 1)'; then
  fail "需要 Python 3.11+（当前: $($PYTHON --version)）"
fi

if ! command -v pnpm >/dev/null 2>&1; then
  if command -v corepack >/dev/null 2>&1; then
    info "启用 pnpm（corepack）…"
    corepack enable >/dev/null 2>&1 || true
    corepack prepare pnpm@latest --activate
  else
    fail "缺少 pnpm，请先安装: npm install -g pnpm"
  fi
fi

# ── Python 虚拟环境 ─────────────────────────────────
if [[ ! -d "$ROOT/.venv" ]]; then
  info "创建 Python 虚拟环境 .venv …"
  "$PYTHON" -m venv "$ROOT/.venv"
fi
# shellcheck disable=SC1091
source "$ROOT/.venv/bin/activate"

info "安装 Python 依赖…"
pip install -q --upgrade pip
pip install -q -r "$ROOT/requirements.txt"
ok "Python 依赖已安装"

# ── 环境变量文件 ────────────────────────────────────
if [[ ! -f "$ROOT/.env" ]]; then
  cp "$ROOT/.env.example" "$ROOT/.env"
  warn "已创建 .env，请编辑 OPENAI_API_KEY、DATABASE_URL 等"
else
  ok ".env 已存在，跳过"
fi

if [[ "$SKIP_WEBUI" == false ]]; then
  if [[ ! -f "$ROOT/webui/.env" ]]; then
    cp "$ROOT/webui/.env.example" "$ROOT/webui/.env"
    if command -v openssl >/dev/null 2>&1; then
      secret="$(openssl rand -base64 32)"
      if [[ "$(uname)" == "Darwin" ]]; then
        sed -i '' "s|generate-with-openssl-rand-base64-32|${secret}|" "$ROOT/webui/.env"
      else
        sed -i "s|generate-with-openssl-rand-base64-32|${secret}|" "$ROOT/webui/.env"
      fi
      ok "已创建 webui/.env 并生成 AUTH_SECRET"
    else
      warn "已创建 webui/.env，请手动设置 AUTH_SECRET"
    fi
  else
    ok "webui/.env 已存在，跳过"
  fi
fi

# ── Qdrant（可选）────────────────────────────────────
if [[ "$WITH_QDRANT" == true ]]; then
  need_cmd docker
  if docker ps --format '{{.Names}}' | grep -qx 'hivemind-qdrant'; then
    ok "Qdrant 容器 hivemind-qdrant 已在运行"
  else
    info "启动 Qdrant 容器…"
    docker run -d --name hivemind-qdrant -p 6333:6333 qdrant/qdrant
    ok "Qdrant 已启动 → http://localhost:6333"
  fi
fi

# ── 数据库 ──────────────────────────────────────────
if [[ "$SKIP_MIGRATE" == false ]]; then
  info "测试数据库连接…"
  if python "$ROOT/scripts/test_db_connection.py"; then
    info "执行数据库迁移…"
    python "$ROOT/scripts/migrate_db.py"
    ok "数据库迁移完成"
  else
    warn "数据库连接失败，已跳过迁移。请配置 .env 后运行: python scripts/migrate_db.py"
  fi
fi

# ── Web UI ──────────────────────────────────────────
if [[ "$SKIP_WEBUI" == false ]]; then
  info "安装 Web UI 依赖…"
  (cd "$ROOT/webui" && pnpm install --frozen-lockfile 2>/dev/null || pnpm install)
  ok "pnpm install 完成"

  info "同步 Prisma 表结构…"
  if (cd "$ROOT/webui" && pnpm db:push); then
    ok "Prisma db:push 完成"
  else
    warn "Prisma db:push 失败，请检查 webui/.env 中的 DATABASE_URL"
  fi
fi

cat <<EOF

════════════════════════════════════════
  HiveMindOS 安装完成
════════════════════════════════════════

下一步:
  1. 编辑 .env          → OPENAI_API_KEY、DATABASE_URL
  2. 编辑 webui/.env    → DATABASE_URL（与后端一致）
  3. 启动服务:
       ./scripts/start.sh

单独启动:
  后端  source .venv/bin/activate && uvicorn memory_layer.knowledge_base.app.main:app --reload --port 8006
  前端  cd webui && pnpm dev

文档: 项目文档/0-项目启动.md
EOF
