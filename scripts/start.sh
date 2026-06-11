#!/usr/bin/env bash
# HiveMindOS 本地启动：后端 :8006 + 前端 :3000
#
# 用法:
#   ./scripts/start.sh           # 同时启动前后端
#   ./scripts/start.sh --api     # 只启动后端
#   ./scripts/start.sh --web     # 只启动前端

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

MODE="all"
API_PID=""
WEB_PID=""

usage() {
  cat <<'EOF'
HiveMindOS 启动脚本

用法: ./scripts/start.sh [选项]

选项:
  --api    只启动后端 API（:8006）
  --web    只启动 Web UI（:3000）
  -h, --help
EOF
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --api) MODE="api" ;;
    --web) MODE="web" ;;
    -h|--help) usage; exit 0 ;;
    *) echo "未知选项: $1" >&2; usage; exit 1 ;;
  esac
  shift
done

cleanup() {
  echo ""
  echo "正在停止服务…"
  [[ -n "$API_PID" ]] && kill "$API_PID" 2>/dev/null || true
  [[ -n "$WEB_PID" ]] && kill "$WEB_PID" 2>/dev/null || true
  wait 2>/dev/null || true
  echo "已退出"
}

if [[ "$MODE" == "all" ]]; then
  trap cleanup EXIT INT TERM
fi

start_api() {
  if [[ ! -d "$ROOT/.venv" ]]; then
    echo "✗ 未找到 .venv，请先运行: ./scripts/install.sh" >&2
    exit 1
  fi
  # shellcheck disable=SC1091
  source "$ROOT/.venv/bin/activate"
  echo "→ 后端 API  http://localhost:8006/docs"
  uvicorn memory_layer.knowledge_base.app.main:app --reload --port 8006
}

start_web() {
  if [[ ! -d "$ROOT/webui/node_modules" ]]; then
    echo "✗ 未找到 webui 依赖，请先运行: ./scripts/install.sh" >&2
    exit 1
  fi
  echo "→ Web UI   http://localhost:3000"
  (cd "$ROOT/webui" && pnpm dev)
}

case "$MODE" in
  api) start_api ;;
  web) start_web ;;
  all)
    # shellcheck disable=SC1091
    source "$ROOT/.venv/bin/activate"
    echo "→ 后端 API  http://localhost:8006/docs"
    uvicorn memory_layer.knowledge_base.app.main:app --reload --port 8006 &
    API_PID=$!
    sleep 1
    echo "→ Web UI   http://localhost:3000"
    (cd "$ROOT/webui" && pnpm dev) &
    WEB_PID=$!
    echo ""
    echo "按 Ctrl+C 停止全部服务"
    wait
    ;;
esac
