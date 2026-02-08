#!/usr/bin/env python3
"""
Deep Think — Path Evaluator
Reads multiple reasoning paths and generates a structured comparison matrix.
Helps Claude systematically evaluate and compare different approaches.
"""

import argparse
import json
import sys
from pathlib import Path


def evaluate_paths(workspace: str) -> None:
    """Read all path files and generate an evaluation template."""
    ws = Path(workspace)
    paths_dir = ws / "03-paths"

    if not paths_dir.exists():
        print("❌ No paths directory found. Run multi-path exploration first.")
        sys.exit(1)

    path_files = sorted(paths_dir.glob("path-*.md"))
    if not path_files:
        print("❌ No path files found in 03-paths/")
        sys.exit(1)

    print(f"📊 Found {len(path_files)} reasoning paths\n")

    # Read each path
    paths = []
    for pf in path_files:
        content = pf.read_text(encoding="utf-8").strip()
        name = pf.stem
        paths.append({"name": name, "file": str(pf), "content": content})
        # Extract first line as title
        title = content.split("\n")[0].replace("#", "").strip() if content else name
        print(f"  📄 {name}: {title}")

    # Generate evaluation template
    eval_template = [
        "# 🔍 Path Evaluation Matrix\n",
        "## Paths Under Evaluation\n",
    ]

    for i, p in enumerate(paths, 1):
        title = p["content"].split("\n")[0].replace("#", "").strip() if p["content"] else p["name"]
        eval_template.append(f"{i}. **{p['name']}**: {title}")

    eval_template.extend([
        "",
        "## Evaluation Criteria\n",
        "| Criterion | " + " | ".join(p["name"] for p in paths) + " |",
        "|-----------|" + "|".join("---" for _ in paths) + "|",
        "| Correctness | " + " | ".join("?/5" for _ in paths) + " |",
        "| Completeness | " + " | ".join("?/5" for _ in paths) + " |",
        "| Efficiency | " + " | ".join("?/5" for _ in paths) + " |",
        "| Robustness | " + " | ".join("?/5" for _ in paths) + " |",
        "| Maintainability | " + " | ".join("?/5" for _ in paths) + " |",
        "",
        "## Contradictions & Conflicts\n",
        "<!-- List any contradictions found between paths -->\n",
        "## Blind Spots\n",
        "<!-- What did ALL paths miss? -->\n",
        "## Verdict\n",
        "<!-- Which path (or combination) is best and why? -->\n",
    ])

    eval_path = ws / "04-verification" / "evaluation-matrix.md"
    eval_path.write_text("\n".join(eval_template), encoding="utf-8")
    print(f"\n✅ Evaluation template generated: {eval_path}")
    print("   Fill in the scores and analysis in the evaluation matrix.")


def main():
    parser = argparse.ArgumentParser(description="Deep Think Path Evaluator")
    parser.add_argument("--workspace", "-w", default=".deep-think", help="Workspace directory")
    args = parser.parse_args()
    evaluate_paths(args.workspace)


if __name__ == "__main__":
    main()