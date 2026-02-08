---
name: deep-think
description: >
  Deep reasoning skill using Claude Code's Agent Teams.
  Spawns multiple personas with enforced minimum depth, includes a challenge round
  where teammates critique each other, and iterates on low-confidence answers.
  Use when the user prefixes with "deep think", "딥씽크", "깊게 생각해", or requests
  thorough analysis. Best for complex architecture, debugging, algorithmic, or
  multi-domain problems. NOT for simple lookups.
  Requires: CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1
---

# Deep Think

Multi-phase reasoning with **forced depth**, **challenge rounds**, and **confidence-based iteration**. Each reasoning path is explored by a separate teammate, then teammates **attack each other's solutions** before synthesis.

## Prerequisites

```bash
export CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1
```

## Architecture

```
You (Team Lead)
├── Phase 1-2: Analysis & Decomposition (you, detailed)
├── Phase 3: Parallel Paths (4-5 teammates, MINIMUM 2000 words each)
│   ├── 🧠 first-principles
│   ├── 🔧 pragmatist
│   ├── 😈 adversarial
│   ├── 💡 innovator
│   └── ⚡ optimizer
├── Phase 3.5: Challenge Round (teammates attack each other)
│   └── Each teammate critiques one other teammate's path
├── Phase 4: Verification + Iteration
│   └── If critical flaws found → request revision (max 2 rounds)
├── Phase 5: Weighted Synthesis
└── Phase 6: Final Answer with Confidence
```

## Workflow

### Phase 1-2: Analysis & Decomposition (You)

**Spend real time here.** This is the foundation. Use `/effort max`.

```bash
python scripts/deep_think.py init "your question" -c extreme -w .deep-think
```

Write `.deep-think/01-analysis/analysis.md` (aim for 500+ words):

- Precise problem restatement with all nuances
- Problem type and why it's complex
- ALL constraints (explicit and implicit)
- Hidden assumptions that might be wrong
- What "perfect" looks like
- What "good enough" looks like
- Known unknowns

Write `.deep-think/02-decomposition/decomposition.md` (aim for 500+ words):

- Sub-problems with dependency graph
- Which sub-problems are hardest and why
- Knowledge gaps that need research
- Risks and what could go wrong
- Attack plan with rationale

### Phase 3: Parallel Paths (Agent Team)

**Critical: Enforce minimum depth.** Each teammate must write extensively.

```
Create an agent team called "deep-think" with /effort max.

IMPORTANT RULES FOR ALL TEAMMATES:
1. Use /effort max
2. Each path MUST be at least 2000 words
3. Do NOT submit a short answer. If your first draft is under 2000 words, expand with:
   - More edge cases and corner cases
   - Alternative sub-approaches you considered and rejected
   - Step-by-step implementation details
   - Failure modes and mitigations
   - Real-world examples or analogies
4. Take your time. Speed is not valued. Depth is.

The problem: [paste from analysis.md]

Spawn these teammates:

1. "first-principles"
   You derive everything from fundamentals. Question every assumption.
   Don't accept "best practices" — ask WHY they're best. Maybe they're not.
   Focus on correctness and logical soundness above all else.
   If the conventional approach is wrong, say so and prove it.

2. "pragmatist"
   You care about what actually works in production at 3am when things break.
   Consider: maintenance burden, onboarding new devs, debugging at scale.
   Favor battle-tested over novel. Ask: "Will this still make sense in 2 years?"
   Include specific examples from real-world systems.

3. "adversarial"
   You are a pessimist. Everything will fail. Find out how.
   Consider: malicious input, network failures, race conditions, resource exhaustion,
   edge cases that happen once per million, cascading failures.
   Your job is to BREAK every other approach. Be paranoid.

4. "innovator"
   Look for unconventional solutions everyone else missed.
   Draw analogies from completely different domains.
   Ask "What if we did the opposite?" or "What would this look like in 10 years?"
   Propose at least one approach that seems crazy but might work.

5. "optimizer"
   Think in O(n), cache lines, memory bandwidth, network round-trips.
   Quantify EVERYTHING. Don't say "faster" — say "3x faster because..."
   Consider the full system: CPU, memory, I/O, network, cold starts.
   Profile before you optimize. Know your bottlenecks.

Each teammate:
- Read .deep-think/01-analysis/analysis.md and .deep-think/02-decomposition/decomposition.md
- Write solution to .deep-think/03-paths/path-{name}.md
- MUST include: approach, detailed reasoning (1000+ words), concrete solution,
  weaknesses you see in your OWN approach, confidence level with justification
- When done, message team-lead with a 3-sentence summary
```

### Phase 3.5: Challenge Round

**This is the key differentiator.** Teammates attack each other's solutions.

```
CHALLENGE ROUND - Each teammate reads and critiques ONE other path:

- first-principles: Read path-pragmatist.md and write a critique
- pragmatist: Read path-adversarial.md and write a critique
- adversarial: Read path-optimizer.md and write a critique
- optimizer: Read path-innovator.md and write a critique
- innovator: Read path-first-principles.md and write a critique

For your critique, write to .deep-think/03.5-challenges/challenge-{you}-vs-{them}.md

Your critique MUST include:
1. The STRONGEST argument against their approach (steelman, then attack)
2. Specific scenarios where their approach fails
3. Logical flaws or unstated assumptions
4. What they missed that you caught
5. Rating: [CRITICAL FLAW / MAJOR WEAKNESS / MINOR ISSUE / SOLID]

Be harsh. Be specific. Find the holes.
```

### Phase 4: Verification + Iteration

After challenges complete, spawn a verifier who triggers iteration if needed:

```
Spawn "verifier" teammate with /effort max.

You are a senior reviewer seeing all this work for the first time.

1. Read ALL files in .deep-think/03-paths/
2. Read ALL files in .deep-think/03.5-challenges/
3. Write .deep-think/04-verification/verification.md with:
   - Score each path (1-10) on: Correctness, Completeness, Practicality, Originality
   - Which challenges revealed real problems vs nitpicks
   - Contradictions between paths — who is RIGHT?
   - Blind spots that ALL paths missed
   - Your devil's advocate argument against the best approach

4. ITERATION CHECK:
   If ANY path was rated CRITICAL FLAW in challenges, OR
   If ANY path scored below 5 in correctness:
   → Message that teammate: "Revise your path addressing: [specific issues]"
   → They must write path-{name}-revised.md
   → You re-evaluate after revision

5. After iteration (or if none needed), proceed to synthesis.
```

### Phase 5: Weighted Synthesis

```
Continue as verifier:

Write .deep-think/05-synthesis/synthesis.md with:

1. WEIGHTED COMBINATION
   - Assign weight to each path based on verification scores
   - Best elements from each, weighted by reliability
   - Explicit attribution: "From first-principles: X, From pragmatist: Y"

2. RESOLVED CONTRADICTIONS
   - Where paths disagreed, state the resolution and WHY

3. ADDRESSED CHALLENGES
   - How the synthesis handles each valid critique

4. REMAINING UNCERTAINTY
   - What we STILL don't know (epistemic humility)

5. CONFIDENCE CALIBRATION
   - Overall confidence: [LOW / MEDIUM / HIGH / VERY HIGH]
   - If LOW or MEDIUM, explain what would increase it
```

### Phase 6: Final Answer

```
Continue as verifier:

Write .deep-think/06-answer/answer.md with:

# Final Answer

## TL;DR (1 paragraph)
[Executive summary]

## Detailed Answer (1000+ words)
[Complete solution with all necessary detail]

## Implementation Notes
[Concrete next steps, code snippets if relevant]

## Thought Process Summary
[3-4 paragraphs explaining:
 - Which perspectives contributed what
 - What challenges revealed and how they were addressed
 - Why this synthesis beats any individual path
 - What we're still uncertain about]

## Confidence: [X/10]
[Detailed justification]

## Dissenting Views
[If any path strongly disagreed with the synthesis, note it here.
 The user deserves to know about unresolved disagreements.]
```

### Shutdown

```
Shutdown the deep-think team. Wait for all teammates to finish current work.
```

Then generate report:

```bash
python scripts/deep_think.py report -w .deep-think
```

## Time Budget Guidelines

| Complexity | Teammates | Expected Wall Time | Min Words/Path |
| ---------- | --------- | ------------------ | -------------- |
| medium     | 3         | 10-15 min          | 1500           |
| high       | 4         | 15-25 min          | 2000           |
| extreme    | 5         | 25-40 min          | 2500           |

**Do NOT rush.** If teammates finish too fast, their output is probably shallow.

## Output Structure

```
.deep-think/
├── 00-question.md
├── 01-analysis/analysis.md           # Your detailed analysis (500+ words)
├── 02-decomposition/decomposition.md # Your sub-problems (500+ words)
├── 03-paths/
│   ├── path-first-principles.md      # Each: 2000+ words
│   ├── path-pragmatist.md
│   ├── path-adversarial.md
│   ├── path-innovator.md
│   ├── path-optimizer.md
│   └── path-{name}-revised.md             # Revisions if needed
├── 03.5-challenges/
│   ├── challenge-first-principles-vs-pragmatist.md
│   ├── challenge-pragmatist-vs-adversarial.md
│   └── ...
├── 04-verification/verification.md   # Scores + iteration decisions
├── 05-synthesis/synthesis.md         # Weighted combination
├── 06-answer/answer.md               # Final polished answer
└── REPORT.md                         # Generated summary
```

## Troubleshooting

**Teammates finishing too fast?**
→ Message them: "Your output is too short. Expand with more edge cases, alternatives, and implementation details."

**Challenge round too soft?**
→ Message challengers: "Find REAL problems. I want to see specific scenarios where this fails."

**Verifier not iterating?**
→ Explicitly ask: "Did any path have critical flaws? If so, request a revision."

## Effort Settings

Always use `/effort max` for deep think sessions. The extra thinking time is the point.
