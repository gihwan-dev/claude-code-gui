# Phase Templates

Templates for Deep Think workflow phases.

## Phase 1: Analysis (`01-analysis/analysis.md`)

Written by team-lead. **Minimum 500 words.**

```
# Problem Analysis

## Original Question
[Restate with ALL nuances. Don't simplify.]

## Why This Is Hard
[Explain the complexity. What makes this non-trivial?]

## Problem Type
[coding | debugging | math | analysis | creative | hybrid]
[Explain why this classification]

## Constraints (Explicit)
- [constraint 1 — source]
- [constraint 2 — source]

## Constraints (Implicit/Assumed)
- [assumption 1 — is this actually true? what if it's not?]
- [assumption 2 — where did this come from?]

## What "Perfect" Looks Like
[Describe the ideal output in detail]

## What "Good Enough" Looks Like  
[Minimum viable answer that still solves the problem]

## Known Unknowns
[What we don't know that we need to find out]

## Risks
[What could go wrong with this entire endeavor?]
```

## Phase 2: Decomposition (`02-decomposition/decomposition.md`)

Written by team-lead. **Minimum 500 words.**

```
# Problem Decomposition

## Sub-Problems

### 1. [Sub-problem A]
- Why it matters: [...]
- Difficulty: [low/medium/high]
- Dependencies: [what must be solved first]

### 2. [Sub-problem B]
[same structure]

### 3. [Sub-problem C]
[same structure]

## Dependency Graph
[Which sub-problems depend on others? Draw it out.]

A → B → D
    ↘ C ↗

## Hardest Parts
[Which sub-problems are trickiest and why?]

## Knowledge Gaps
[What do we need to research or test?]

## Attack Plan
1. First: [X] because [reason]
2. Then: [Y] because [reason]
3. Finally: [Z] because [reason]

## What Could Go Wrong
[Risks at each stage]
```

## Phase 3: Path (`03-paths/path-{persona}.md`)

Each teammate writes their solution. **Minimum 2000 words.**

```
# Approach: [Descriptive Name]

## Core Idea (1 paragraph)
[High-level summary of approach]

## Why This Approach
[Justify why this is worth exploring. What's the thesis?]

## Detailed Reasoning (1000+ words)

### Step 1: [First major step]
[Detailed explanation with rationale]

### Step 2: [Second major step]
[Detailed explanation with rationale]

### Step 3: [Third major step]
[Detailed explanation with rationale]

[Continue as needed...]

## Concrete Solution

### Implementation
[Specific code, architecture, or recommendations]
[Include actual code snippets if relevant]

### Example Walkthrough
[Walk through a concrete example end-to-end]

## Edge Cases Considered
- [Edge case 1]: handled by [X]
- [Edge case 2]: handled by [Y]
- [Edge case 3]: NOT handled — would need [Z]

## Alternatives Rejected
- [Alternative A]: rejected because [reason]
- [Alternative B]: rejected because [reason]

## Weaknesses of This Approach
[Be honest. Where does this fall short?]
- [Weakness 1]
- [Weakness 2]

## Confidence: [LOW / MEDIUM / HIGH]

Justification: [Why this confidence level? What would change it?]
```

## Phase 3.5: Challenge (`03.5-challenges/challenge-{from}-vs-{to}.md`)

Each teammate critiques one other path. **Be harsh.**

```
# Challenge: {from} vs {to}

## Their Approach Summary
[1-2 sentences summarizing what they proposed]

## Strongest Version of Their Argument (Steelman)
[Present their approach in its best light before attacking]

## Critical Problems

### Problem 1: [Title]
**Severity: [CRITICAL / MAJOR / MINOR]**

[Detailed explanation of the flaw]

Specific scenario where this fails:
> [Concrete example]

### Problem 2: [Title]
[same structure]

## Logical Flaws
- [Unstated assumption that may be false]
- [Reasoning gap]

## What They Missed
- [Blind spot 1]
- [Blind spot 2]

## Overall Rating

**[CRITICAL FLAW / MAJOR WEAKNESS / MINOR ISSUES / SOLID]**

Recommendation: [Should they revise? What specifically?]
```

## Phase 4: Verification (`04-verification/verification.md`)

Written by verifier after reading all paths and challenges.

```
# Verification Report

## Path Scores

| Path | Correctness | Completeness | Practicality | Originality | Total |
|------|-------------|--------------|--------------|-------------|-------|
| first-principles | X/10 | X/10 | X/10 | X/10 | X/40 |
| pragmatist | X/10 | X/10 | X/10 | X/10 | X/40 |
| adversarial | X/10 | X/10 | X/10 | X/10 | X/40 |
| innovator | X/10 | X/10 | X/10 | X/10 | X/40 |
| optimizer | X/10 | X/10 | X/10 | X/10 | X/40 |

## Challenge Analysis

### Valid Critiques
- [Challenge X]: This is a real problem because [...]
- [Challenge Y]: This is a real problem because [...]

### Nitpicks (Ignore)
- [Challenge Z]: This is overblown because [...]

## Contradictions Between Paths

| Issue | Path A Says | Path B Says | Resolution |
|-------|-------------|-------------|------------|
| [Issue 1] | [...] | [...] | [Who's right and why] |

## Blind Spots (All Paths Missed)
- [Thing everyone missed]

## Devil's Advocate
[Strongest argument against the current best approach]

## Iteration Decisions

**Paths requiring revision:**
- [ ] first-principles: [reason or "OK"]
- [ ] pragmatist: [reason or "OK"]  
- [ ] adversarial: [reason or "OK"]
- [ ] innovator: [reason or "OK"]
- [ ] optimizer: [reason or "OK"]

[If any marked for revision, message that teammate with specific feedback]
```

## Phase 5: Synthesis (`05-synthesis/synthesis.md`)

Written by verifier after all iterations complete.

```
# Synthesis

## Weights Applied
Based on verification scores:
- first-principles: [X]% weight
- pragmatist: [X]% weight
- adversarial: [X]% weight
- innovator: [X]% weight
- optimizer: [X]% weight

## Best Elements from Each

### From first-principles (weight: X%)
[What we're taking and why]

### From pragmatist (weight: X%)
[What we're taking and why]

[...continue for each...]

## Integrated Solution
[The combined answer, clearly structured]

## How Challenges Were Addressed
- [Challenge 1]: Addressed by [...]
- [Challenge 2]: Addressed by [...]

## Remaining Contradictions
[Any unresolved disagreements — be honest]

## Remaining Uncertainty
[What we still don't know]

## Confidence: [X/10]
[Justification]
```

## Phase 6: Final Answer (`06-answer/answer.md`)

The deliverable. **Minimum 1000 words for detailed answer.**

```
# Final Answer

## TL;DR
[One paragraph executive summary. The answer in a nutshell.]

## Detailed Answer

### [Section 1]
[Thorough explanation]

### [Section 2]  
[Thorough explanation]

### [Section 3]
[Thorough explanation]

[...continue as needed...]

## Implementation Notes
[Concrete next steps, code if relevant]

## Thought Process Summary

This answer emerged from [N] independent analyses:

[Paragraph 1: What different perspectives contributed]

[Paragraph 2: Key disagreements and how they were resolved]

[Paragraph 3: What the challenge round revealed]

[Paragraph 4: Why this synthesis is better than any single path]

## Confidence: [X/10]

[Detailed justification — what makes us confident, what makes us uncertain]

## Dissenting Views

[If any path strongly disagreed with this synthesis, note it here.
Users deserve to know about unresolved disagreements.]

- [Persona X] argued [alternative] because [reason]. We didn't adopt this because [reason], but it remains a valid consideration if [conditions].
```