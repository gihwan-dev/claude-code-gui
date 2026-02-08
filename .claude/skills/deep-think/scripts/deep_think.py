#!/usr/bin/env python3
"""
Deep Think — Session Utilities
Workspace initialization and report generation for Agent Teams workflow
with challenge rounds and iteration support.
"""

import argparse
import json
import sys
from datetime import datetime
from pathlib import Path

PHASES = [
    {"id": "01-analysis", "name": "Problem Analysis", "emoji": "🔍", "min_words": 500},
    {"id": "02-decomposition", "name": "Decomposition", "emoji": "🧩", "min_words": 500},
    {"id": "03-paths", "name": "Parallel Paths", "emoji": "🔀", "min_words": 2000},
    {"id": "03.5-challenges", "name": "Challenge Round", "emoji": "⚔️", "min_words": 300},
    {"id": "04-verification", "name": "Verification", "emoji": "✅", "min_words": 500},
    {"id": "05-synthesis", "name": "Synthesis", "emoji": "🧬", "min_words": 500},
    {"id": "06-answer", "name": "Final Answer", "emoji": "💡", "min_words": 1000},
]

COMPLEXITY_CONFIG = {
    "medium": {"teammates": 3, "min_words": 1500, "expected_time": "10-15 min"},
    "high": {"teammates": 4, "min_words": 2000, "expected_time": "15-25 min"},
    "extreme": {"teammates": 5, "min_words": 2500, "expected_time": "25-40 min"},
}


def count_words(text: str) -> int:
    """Count words in text."""
    return len(text.split())


def init_session(workspace: str, question: str, complexity: str = "high") -> dict:
    """Initialize a new deep think workspace."""
    ws = Path(workspace)
    ws.mkdir(parents=True, exist_ok=True)

    config = COMPLEXITY_CONFIG.get(complexity, COMPLEXITY_CONFIG["high"])

    session = {
        "id": datetime.now().strftime("%Y%m%d_%H%M%S"),
        "question": question,
        "complexity": complexity,
        "workspace": str(ws),
        "created_at": datetime.now().isoformat(),
        "config": config,
    }

    # Create all phase directories including challenge round
    for phase in PHASES:
        (ws / phase["id"]).mkdir(exist_ok=True)

    # Save session metadata
    with open(ws / "session.json", "w") as f:
        json.dump(session, f, indent=2, ensure_ascii=False)

    # Create initial question file
    with open(ws / "00-question.md", "w") as f:
        f.write(f"# Deep Think Session\n\n")
        f.write(f"**Question/Task:**\n\n{question}\n\n")
        f.write(f"**Complexity:** {complexity}\n")
        f.write(f"**Teammates:** {config['teammates']}\n")
        f.write(f"**Min words per path:** {config['min_words']}\n")
        f.write(f"**Expected time:** {config['expected_time']}\n")
        f.write(f"**Created:** {session['created_at']}\n")

    print(f"✅ Deep Think workspace initialized: {ws}")
    print(f"   Complexity: {complexity}")
    print(f"   Teammates: {config['teammates']}")
    print(f"   Min words/path: {config['min_words']}")
    print(f"   Expected time: {config['expected_time']}")
    print(f"\n📋 Next steps:")
    print(f"   1. Write analysis to {ws}/01-analysis/analysis.md (500+ words)")
    print(f"   2. Write decomposition to {ws}/02-decomposition/decomposition.md (500+ words)")
    print(f"   3. Spawn agent team with /effort max (see SKILL.md)")
    print(f"   4. Wait for challenge round to complete")
    print(f"   5. Spawn verifier for synthesis")
    return session


def generate_report(workspace: str) -> None:
    """Generate a summary report from completed session."""
    ws = Path(workspace)

    if not (ws / "session.json").exists():
        print(f"❌ No session found at {ws}")
        sys.exit(1)

    session = json.loads((ws / "session.json").read_text())

    report_lines = [
        "# 🧠 Deep Think — Session Report",
        "",
        f"**Question:** {session['question']}",
        f"**Complexity:** {session['complexity']}",
        f"**Created:** {session['created_at']}",
        "",
    ]

    # Word count summary
    report_lines.append("## 📊 Word Counts\n")
    total_words = 0
    for phase in PHASES:
        phase_dir = ws / phase["id"]
        if phase_dir.exists():
            phase_words = 0
            for md_file in phase_dir.glob("*.md"):
                content = md_file.read_text(encoding="utf-8")
                phase_words += count_words(content)
            total_words += phase_words
            min_req = phase.get("min_words", 0)
            status = "✅" if phase_words >= min_req else "⚠️"
            report_lines.append(f"- {status} **{phase['name']}**: {phase_words} words (min: {min_req})")

    report_lines.append(f"\n**Total:** {total_words} words\n")
    report_lines.append("---\n")

    # Collect content from each phase
    for phase in PHASES:
        phase_dir = ws / phase["id"]
        if phase_dir.exists():
            md_files = sorted(phase_dir.glob("*.md"))
            if md_files:
                report_lines.append(f"## {phase['emoji']} {phase['name']}\n")
                for md_file in md_files:
                    content = md_file.read_text(encoding="utf-8").strip()
                    if content:
                        words = count_words(content)
                        report_lines.append(f"### {md_file.name} ({words} words)\n")
                        report_lines.append(content)
                        report_lines.append("")

    report = "\n".join(report_lines)
    report_path = ws / "REPORT.md"
    report_path.write_text(report, encoding="utf-8")

    print(f"✅ Report generated: {report_path}")
    print(f"   Total words: {total_words}")


def status(workspace: str) -> None:
    """Show workspace status with word counts."""
    ws = Path(workspace)

    if not (ws / "session.json").exists():
        print(f"❌ No session found at {ws}")
        sys.exit(1)

    session = json.loads((ws / "session.json").read_text())
    config = session.get("config", {})

    print(f"\n🧠 Deep Think Session")
    print(f"   Question: {session['question'][:60]}...")
    print(f"   Complexity: {session['complexity']}")
    print(f"   Expected time: {config.get('expected_time', 'unknown')}")
    print()

    total_words = 0
    for phase in PHASES:
        phase_dir = ws / phase["id"]
        if phase_dir.exists():
            files = list(phase_dir.glob("*.md"))
            if files:
                phase_words = sum(count_words(f.read_text()) for f in files)
                total_words += phase_words
                min_req = phase.get("min_words", 0)
                status_icon = "✅" if phase_words >= min_req else "⚠️"
                print(f"   {status_icon} {phase['name']}: {len(files)} file(s), {phase_words} words")
            else:
                print(f"   ⬜ {phase['name']}: empty")
        else:
            print(f"   ⬜ {phase['name']}: not created")

    print(f"\n   📊 Total: {total_words} words")


def validate(workspace: str) -> None:
    """Validate that all phases meet minimum word requirements."""
    ws = Path(workspace)

    if not (ws / "session.json").exists():
        print(f"❌ No session found at {ws}")
        sys.exit(1)

    session = json.loads((ws / "session.json").read_text())
    config = session.get("config", {})
    min_path_words = config.get("min_words", 2000)

    print(f"\n🔍 Validating Deep Think session...\n")

    issues = []

    # Check analysis
    analysis_file = ws / "01-analysis" / "analysis.md"
    if analysis_file.exists():
        words = count_words(analysis_file.read_text())
        if words < 500:
            issues.append(f"Analysis too short: {words} words (need 500+)")
    else:
        issues.append("Missing: 01-analysis/analysis.md")

    # Check decomposition
    decomp_file = ws / "02-decomposition" / "decomposition.md"
    if decomp_file.exists():
        words = count_words(decomp_file.read_text())
        if words < 500:
            issues.append(f"Decomposition too short: {words} words (need 500+)")
    else:
        issues.append("Missing: 02-decomposition/decomposition.md")

    # Check paths
    paths_dir = ws / "03-paths"
    if paths_dir.exists():
        path_files = list(paths_dir.glob("path-*.md"))
        for pf in path_files:
            words = count_words(pf.read_text())
            if words < min_path_words:
                issues.append(f"{pf.name} too short: {words} words (need {min_path_words}+)")
    else:
        issues.append("Missing: 03-paths directory")

    # Check challenges
    challenges_dir = ws / "03.5-challenges"
    if challenges_dir.exists():
        challenge_files = list(challenges_dir.glob("challenge-*.md"))
        if not challenge_files:
            issues.append("No challenge files found in 03.5-challenges/")
    else:
        issues.append("Missing: 03.5-challenges directory (challenge round not done?)")

    # Check final answer
    answer_file = ws / "06-answer" / "answer.md"
    if answer_file.exists():
        words = count_words(answer_file.read_text())
        if words < 1000:
            issues.append(f"Final answer too short: {words} words (need 1000+)")
    else:
        issues.append("Missing: 06-answer/answer.md")

    if issues:
        print("❌ Issues found:\n")
        for issue in issues:
            print(f"   • {issue}")
        print()
        sys.exit(1)
    else:
        print("✅ All validations passed!")


def main():
    parser = argparse.ArgumentParser(description="Deep Think Session Utilities")
    sub = parser.add_subparsers(dest="command", required=True)

    # init
    p_init = sub.add_parser("init", help="Initialize workspace")
    p_init.add_argument("question", help="The question or task")
    p_init.add_argument("--workspace", "-w", default=".deep-think")
    p_init.add_argument("--complexity", "-c",
                       choices=["medium", "high", "extreme"],
                       default="high")

    # report
    p_report = sub.add_parser("report", help="Generate summary report")
    p_report.add_argument("--workspace", "-w", default=".deep-think")

    # status
    p_status = sub.add_parser("status", help="Show workspace status")
    p_status.add_argument("--workspace", "-w", default=".deep-think")

    # validate
    p_validate = sub.add_parser("validate", help="Validate word counts")
    p_validate.add_argument("--workspace", "-w", default=".deep-think")

    args = parser.parse_args()

    if args.command == "init":
        init_session(args.workspace, args.question, args.complexity)
    elif args.command == "report":
        generate_report(args.workspace)
    elif args.command == "status":
        status(args.workspace)
    elif args.command == "validate":
        validate(args.workspace)


if __name__ == "__main__":
    main()