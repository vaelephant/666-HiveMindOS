#!/usr/bin/env python3
"""统计项目代码行数。

用法:
  python scripts/count_loc.py              # 全项目统计
  python scripts/count_loc.py --git        # 仅统计未提交变更（新增行）
  python scripts/count_loc.py --git main   # 相对 main 分支的变更
  python scripts/count_loc.py --detail     # 按目录细分
"""

from __future__ import annotations

import argparse
import os
import subprocess
import sys
from collections import defaultdict
from dataclasses import dataclass
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent

# 视为源代码的扩展名 → 显示名
EXTENSIONS: dict[str, str] = {
    ".py": "Python",
    ".ts": "TypeScript",
    ".tsx": "TSX",
    ".js": "JavaScript",
    ".jsx": "JSX",
    ".sql": "SQL",
    ".sh": "Shell",
    ".yaml": "YAML",
    ".yml": "YAML",
    ".md": "Markdown",
    ".css": "CSS",
    ".json": "JSON",
    ".prisma": "Prisma",
}

# 跳过的目录
SKIP_DIRS = {
    "node_modules",
    "__pycache__",
    ".next",
    ".git",
    "dist",
    "build",
    ".venv",
    "venv",
    ".turbo",
    "coverage",
    ".pytest_cache",
    ".mypy_cache",
    "mcps",
}

# 跳过的文件（生成物、锁文件等）
SKIP_FILES = {
    "package-lock.json",
    "pnpm-lock.yaml",
    "yarn.lock",
}


@dataclass
class FileStats:
    total: int = 0
    code: int = 0
    blank: int = 0
    comment: int = 0


def should_skip(path: Path) -> bool:
    parts = set(path.parts)
    if parts & SKIP_DIRS:
        return True
    if path.name in SKIP_FILES:
        return True
    return False


def count_file_lines(path: Path) -> FileStats:
    """统计单文件：总行、代码行、空行、注释行（近似）。"""
    try:
        text = path.read_text(encoding="utf-8", errors="replace")
    except OSError:
        return FileStats()

    lines = text.splitlines()
    ext = path.suffix.lower()
    total = len(lines)
    blank = 0
    comment = 0
    code = 0

    in_block = False
    for line in lines:
        stripped = line.strip()
        if not stripped:
            blank += 1
            continue

        # 块注释（Python / SQL）
        if ext in {".py", ".sql"}:
            if in_block:
                comment += 1
                if '"""' in stripped or "'''" in stripped:
                    in_block = False
                continue
            if stripped.startswith('"""') or stripped.startswith("'''"):
                comment += 1
                quote = '"""' if stripped.startswith('"""') else "'''"
                if stripped.count(quote) < 2:
                    in_block = True
                continue

        # 行注释
        if stripped.startswith("#") or stripped.startswith("//"):
            comment += 1
            continue
        if stripped.startswith("/*") or stripped.startswith("*"):
            comment += 1
            continue

        code += 1

    return FileStats(total=total, code=code, blank=blank, comment=comment)


def iter_source_files(root: Path) -> list[Path]:
    files: list[Path] = []
    for path in root.rglob("*"):
        if not path.is_file():
            continue
        if should_skip(path):
            continue
        if path.suffix.lower() not in EXTENSIONS:
            continue
        files.append(path)
    return sorted(files)


def collect_stats(files: list[Path]) -> tuple[dict[str, FileStats], dict[str, int], dict[str, int]]:
    by_lang: dict[str, FileStats] = defaultdict(FileStats)
    by_dir: dict[str, int] = defaultdict(int)
    file_counts: dict[str, int] = defaultdict(int)

    for path in files:
        stats = count_file_lines(path)
        lang = EXTENSIONS.get(path.suffix.lower(), path.suffix)
        lang_stats = by_lang[lang]
        lang_stats.total += stats.total
        lang_stats.code += stats.code
        lang_stats.blank += stats.blank
        lang_stats.comment += stats.comment
        file_counts[lang] += 1

        rel = path.relative_to(ROOT)
        top = rel.parts[0] if rel.parts else "."
        by_dir[top] += stats.code

    return dict(by_lang), dict(by_dir), dict(file_counts)


def git_changed_files(base: str | None) -> list[Path]:
    """获取 git 变更涉及的源代码文件。"""
    if base:
        cmd = ["git", "diff", "--name-only", "--diff-filter=ACMR", base, "HEAD"]
    else:
        cmd = ["git", "diff", "--name-only", "--diff-filter=ACMR", "HEAD"]

    result = subprocess.run(
        cmd,
        cwd=ROOT,
        capture_output=True,
        text=True,
        check=False,
    )
    if result.returncode != 0:
        print(f"git 命令失败: {result.stderr.strip()}", file=sys.stderr)
        sys.exit(1)

    # 未跟踪文件
    untracked = subprocess.run(
        ["git", "ls-files", "--others", "--exclude-standard"],
        cwd=ROOT,
        capture_output=True,
        text=True,
        check=False,
    )
    names = {n for n in result.stdout.splitlines() if n}
    names.update(untracked.stdout.splitlines())

    files: list[Path] = []
    for name in sorted(names):
        path = ROOT / name
        if not path.is_file():
            continue
        if should_skip(path):
            continue
        if path.suffix.lower() not in EXTENSIONS:
            continue
        files.append(path)
    return files


def git_added_lines(base: str | None) -> int:
    """统计 git diff 中新增的行数（含修改文件中的 + 行）。"""
    if base:
        cmd = ["git", "diff", "--numstat", base, "HEAD"]
    else:
        cmd = ["git", "diff", "--numstat", "HEAD"]

    result = subprocess.run(cmd, cwd=ROOT, capture_output=True, text=True, check=False)
    added = sum(int(parts[0]) for parts in (line.split() for line in result.stdout.splitlines()) if parts and parts[0].isdigit())

    untracked = git_changed_files(base)
    for path in untracked:
        if not _is_tracked(path):
            try:
                added += len(path.read_text(encoding="utf-8", errors="replace").splitlines())
            except OSError:
                pass
    return added


def _is_tracked(path: Path) -> bool:
    rel = path.relative_to(ROOT).as_posix()
    result = subprocess.run(
        ["git", "ls-files", "--error-unmatch", rel],
        cwd=ROOT,
        capture_output=True,
        check=False,
    )
    return result.returncode == 0


def print_table(
    by_lang: dict[str, FileStats],
    file_counts: dict[str, int],
    title: str,
) -> None:
    print(f"\n{title}")
    print("-" * 62)
    print(f"{'语言':<14} {'文件':>6} {'代码':>8} {'注释':>8} {'空行':>8} {'总计':>8}")
    print("-" * 62)

    totals = FileStats()
    for lang, stats in sorted(by_lang.items(), key=lambda x: x[1].code, reverse=True):
        print(f"{lang:<14} {file_counts[lang]:>6} {stats.code:>8} {stats.comment:>8} {stats.blank:>8} {stats.total:>8}")
        totals.total += stats.total
        totals.code += stats.code
        totals.blank += stats.blank
        totals.comment += stats.comment

    print("-" * 62)
    print(f"{'合计':<14} {sum(file_counts.values()):>6} {totals.code:>8} {totals.comment:>8} {totals.blank:>8} {totals.total:>8}")


def print_table_for_files(files: list[Path], title: str) -> None:
    by_lang: dict[str, FileStats] = defaultdict(FileStats)
    file_counts: dict[str, int] = defaultdict(int)

    for path in files:
        stats = count_file_lines(path)
        lang = EXTENSIONS.get(path.suffix.lower(), path.suffix)
        s = by_lang[lang]
        s.total += stats.total
        s.code += stats.code
        s.blank += stats.blank
        s.comment += stats.comment
        file_counts[lang] += 1

    print(f"\n{title}")
    print("-" * 62)
    print(f"{'语言':<14} {'文件':>6} {'代码':>8} {'注释':>8} {'空行':>8} {'总计':>8}")
    print("-" * 62)

    totals = FileStats()
    for lang, stats in sorted(by_lang.items(), key=lambda x: x[1].code, reverse=True):
        print(f"{lang:<14} {file_counts[lang]:>6} {stats.code:>8} {stats.comment:>8} {stats.blank:>8} {stats.total:>8}")
        totals.total += stats.total
        totals.code += stats.code
        totals.blank += stats.blank
        totals.comment += stats.comment

    print("-" * 62)
    print(f"{'合计':<14} {len(files):>6} {totals.code:>8} {totals.comment:>8} {totals.blank:>8} {totals.total:>8}")


def print_dir_breakdown(by_dir: dict[str, int]) -> None:
    print("\n按顶层目录（代码行）")
    print("-" * 30)
    for name, count in sorted(by_dir.items(), key=lambda x: x[1], reverse=True):
        print(f"  {name:<20} {count:>8}")


def main() -> None:
    parser = argparse.ArgumentParser(description="统计 HiveMindOS 代码行数")
    parser.add_argument(
        "--git",
        nargs="?",
        const="",
        metavar="BASE",
        help="统计 git 变更（可选基准分支，如 main）",
    )
    parser.add_argument("--detail", action="store_true", help="显示按目录细分")
    args = parser.parse_args()

    print(f"项目根目录: {ROOT}")

    if args.git is not None:
        base = args.git or None
        label = f"相对 {base}" if base else "未提交变更"
        files = git_changed_files(base)
        print_table_for_files(files, f"Git 变更统计（{label}，{len(files)} 个源文件）")

        added = git_added_lines(base)
        print(f"\nGit diff 新增行数（+）: {added}")

        if args.detail and files:
            by_dir: dict[str, int] = defaultdict(int)
            for path in files:
                rel = path.relative_to(ROOT)
                top = rel.parts[0] if rel.parts else "."
                by_dir[top] += count_file_lines(path).code
            print_dir_breakdown(dict(by_dir))
    else:
        files = iter_source_files(ROOT)
        by_lang, by_dir, file_counts = collect_stats(files)
        print_table(by_lang, file_counts, f"全项目统计（{len(files)} 个源文件）")
        if args.detail:
            print_dir_breakdown(by_dir)


if __name__ == "__main__":
    main()
