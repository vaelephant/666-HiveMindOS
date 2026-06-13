#!/usr/bin/env python3
"""
灌入 Web UI 演示样例：Skills / Playbook 文件已在 storage/；
本脚本额外写入 demo 组织的智慧记忆，便于 daily_digest 跑出丰富摘要。

用法（项目根目录）：
    python scripts/seed_demo_ui_samples.py
    python scripts/seed_demo_ui_samples.py --org acme --user demo
"""

from __future__ import annotations

import argparse
import shutil
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from shared import config
from memory_layer.models.memory import MemoryCandidate
from memory_layer.core.registry.memory_registry import MemoryRegistry

ORG_DEFAULT = "demo"
USER_DEFAULT = "demo"

STORAGE = config.STORAGE_ROOT

DEMO_MEMORIES: list[MemoryCandidate] = [
    MemoryCandidate(
        action="create",
        memory_type="project",
        title="HiveMind 华东售前试点",
        content="Q2 在华东区选 3 家装备制造客户做 Chat+企微试点，重点验证工单闭环与 Wiki 检索。",
        importance=0.88,
    ),
    MemoryCandidate(
        action="create",
        memory_type="preference",
        title="汇报格式偏好",
        content="销售同事偏好「结论前置 + 表格对比」，不喜欢长段叙述；对外邮件 48h 内跟进。",
        importance=0.92,
    ),
    MemoryCandidate(
        action="create",
        memory_type="decision",
        title="POC 默认周期",
        content="标准 POC 2 周：第 1 周企微+Wiki，第 2 周跑通 1 条真实工单；全模块打包需额外 2 周。",
        importance=0.85,
    ),
    MemoryCandidate(
        action="create",
        memory_type="project",
        title="竞品对标节奏",
        content="每月更新一次竞品报价 Wiki；A/B/C 三家公司为华东区重点对标对象。",
        importance=0.78,
    ),
    MemoryCandidate(
        action="create",
        memory_type="decision",
        title="daily_digest 推送窗口",
        content="每日摘要建议 09:00 推送到企微；仅在工作日发送，内容 150–300 字。",
        importance=0.7,
    ),
]

SAMPLE_DIGEST = """【HiveMind 每日摘要 · Demo】

近 24h 平台侧：活跃智慧 5 条，以 preference / project 为主。华东售前试点进入第 2 周，销售同学习惯「结论+表格」的竞品对比格式；POC 默认 2 周节奏已在团队内统一。

建议今日关注：1）在定时运维确认 daily_digest 已开启企微推送；2）工具箱查看新沉淀的 3 条 Skill；3）新同事可走 onboarding Skill 完成产品熟悉。

（此为样例文案；实际「运行」daily_digest 时由模型根据当日数据生成。）"""


def copy_demo_assets(org_id: str, demo_storage: Path, runtime_storage: Path) -> None:
    """Copy skills + playbook from demo org template to target org runtime storage."""
    if org_id == ORG_DEFAULT and demo_storage.resolve() == runtime_storage.resolve():
        return
    src_skills = demo_storage / "skills" / ORG_DEFAULT
    dst_skills = runtime_storage / "skills" / org_id
    if src_skills.is_dir() and not any(dst_skills.glob("*/SKILL.md")):
        shutil.copytree(src_skills, dst_skills, dirs_exist_ok=True)
        print(f"[copy] skills → {runtime_storage / 'skills' / org_id}")

    src_pb = demo_storage / "orgs" / ORG_DEFAULT / "playbook.md"
    dst_pb = runtime_storage / "orgs" / org_id / "playbook.md"
    if src_pb.is_file() and not dst_pb.is_file():
        dst_pb.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(src_pb, dst_pb)
        print(f"[copy] playbook → {dst_pb}")


def seed_memories(org_id: str, user_id: str) -> list[int]:
    reg = MemoryRegistry()
    existing = {m.title for m in reg.list_active(org_id, user_id)}
    to_apply = [c for c in DEMO_MEMORIES if c.title not in existing]
    if not to_apply:
        print(f"[memories] org={org_id} 已有演示智慧，跳过")
        return []
    ids = reg.apply_candidates(org_id, user_id, to_apply, session_id="seed-demo-ui")
    print(f"[memories] 写入 {len(ids)} 条  ids={ids}")
    return ids


def main() -> None:
    parser = argparse.ArgumentParser(description="Seed demo UI samples")
    parser.add_argument("--org", default=ORG_DEFAULT)
    parser.add_argument("--user", default=USER_DEFAULT)
    parser.add_argument(
        "--demo-storage",
        default=str(ROOT / "knowledge_base" / "storage"),
        help="内置 demo 样例文件目录（仓库内模板）",
    )
    args = parser.parse_args()

    demo_storage = Path(args.demo_storage)
    runtime_storage = STORAGE
    copy_demo_assets(args.org, demo_storage, runtime_storage)
    skills = list((runtime_storage / "skills" / args.org).glob("*/SKILL.md"))
    playbook = runtime_storage / "orgs" / args.org / "playbook.md"

    print("━" * 50)
    print("  HiveMindOS · Demo UI 样例")
    print("━" * 50)
    print(f"STORAGE_ROOT   = {runtime_storage}")
    print(f"Skills ({len(skills)}): {[p.parent.name for p in skills]}")
    print(f"Playbook: {'✓' if playbook.is_file() else '✗'} {playbook}")
    try:
        seed_memories(args.org, args.user)
    except Exception as exc:
        print(f"[memories] 跳过（需 PostgreSQL）: {exc}")
    print("\n--- daily_digest 样例输出（参考）---\n")
    print(SAMPLE_DIGEST)
    print("\n--- 在 Web UI 查看 ---")
    print("  工具箱          → /tools")
    print("  集成·Playbook   → /integrations/playbook")
    print("  定时运维        → /tasks/ops  → 运行「每日智慧摘要」")
    if args.org != ORG_DEFAULT:
        print(f"\n  提示：演示文件已从 demo 复制到 org={args.org}")
        print("  账号 org 可在 Web UI「账户」页或 JWT session 中查看")
    print("━" * 50)


if __name__ == "__main__":
    main()
