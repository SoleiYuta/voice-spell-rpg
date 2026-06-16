#!/usr/bin/env python3
"""GitHub Actions が issue / マイルストーン状態から進捗を集計し、
README.md と wiki/hot.md の AUTO:phase マーカー間を自動更新する。

「フェーズが進む」= マイルストーンの全issueがクローズされること。
現在フェーズ = まだオープンissueが残る最初のマイルストーン（due_on順）。
"""
import json
import os
import re
import subprocess
import sys
from datetime import datetime, timezone

REPO = os.environ.get("GITHUB_REPOSITORY")
MARK_START = "<!-- AUTO:phase:start -->"
MARK_END = "<!-- AUTO:phase:end -->"
FILES = ["README.md", "wiki/hot.md"]


def gh_json(args):
    out = subprocess.check_output(["gh"] + args, text=True)
    return json.loads(out) if out.strip() else []


def build_block():
    milestones = gh_json(["api", f"repos/{REPO}/milestones?state=all&per_page=100"])
    # due_on 昇順（未設定は末尾）→ タイトル
    milestones.sort(key=lambda m: (m.get("due_on") or "9999-12-31", m.get("title", "")))

    current = None
    for m in milestones:
        if m.get("open_issues", 0) > 0:
            current = m
            break

    rows = []
    for m in milestones:
        openc = m.get("open_issues", 0)
        closedc = m.get("closed_issues", 0)
        total = openc + closedc
        if total == 0:
            status = "—"
        elif openc == 0:
            status = "✅ 完了"
        elif current and m["title"] == current["title"]:
            status = "🔵 進行中"
        else:
            status = "⬜ 未着手"
        rows.append(f"| {m['title']} | {closedc}/{total} | {status} |")

    todo = []
    if current:
        issues = gh_json([
            "issue", "list", "--repo", REPO, "--milestone", current["title"],
            "--state", "open", "--limit", "100",
            "--json", "number,title,assignees",
        ])
        issues.sort(key=lambda i: i["number"])
        for i in issues:
            who = ", ".join(a["login"] for a in i.get("assignees", [])) or "未割当"
            todo.append(f"- #{i['number']} {i['title']} — @{who}")

    cur_title = current["title"] if current else "全フェーズ完了 🎉"
    ts = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M UTC")

    lines = [
        "## 📊 進捗（GitHub Actions が自動更新）",
        "",
        f"**現在フェーズ: {cur_title}**",
        "",
        "| マイルストーン | 完了/全体 | 状態 |",
        "|---|---|---|",
        *rows,
        "",
        "### 今やること（現フェーズのオープンissue）",
        *(todo if todo else ["- （なし）"]),
        "",
        f"_最終更新: {ts} — issue状態から自動生成。マーカー内は手で編集しない。_",
    ]
    return "\n".join(lines)


def main():
    if not REPO:
        print("GITHUB_REPOSITORY 未設定", file=sys.stderr)
        sys.exit(1)

    block = build_block()
    pattern = re.compile(re.escape(MARK_START) + r".*?" + re.escape(MARK_END), re.S)
    replacement = f"{MARK_START}\n{block}\n{MARK_END}"

    changed = False
    for path in FILES:
        if not os.path.exists(path):
            print(f"skip (なし): {path}")
            continue
        text = open(path, encoding="utf-8").read()
        if MARK_START not in text or MARK_END not in text:
            print(f"skip (マーカーなし): {path}")
            continue
        new_text = pattern.sub(replacement, text)
        if new_text != text:
            open(path, "w", encoding="utf-8").write(new_text)
            print(f"updated: {path}")
            changed = True
        else:
            print(f"unchanged: {path}")

    print("CHANGED" if changed else "NO_CHANGE")


if __name__ == "__main__":
    main()
