# Reasoning Patterns by Problem Type

## Coding / Architecture

**Decomposition strategy:** Separate concerns (data flow, state, UI, API, error handling).

**Path generation:**

- Path A: Top-down design (interfaces first, then implementation)
- Path B: Bottom-up design (primitives first, then composition)
- Path C: Analogy-based (find similar solved problems, adapt patterns)

**Verification checklist:**

- Edge cases and error states covered?
- Performance under load?
- Backwards compatibility?
- Testability?

## Debugging

**Decomposition strategy:** Reproduce → Isolate → Hypothesize → Test → Fix.

**Path generation:**

- Path A: Stack trace / error message analysis (work backwards from symptom)
- Path B: Recent changes analysis (what changed since it last worked?)
- Path C: Binary search isolation (bisect the system to find fault boundary)

**Verification:** Confirm fix doesn't introduce regressions. Explain _why_ the bug occurred, not just _what_ fixed it.

## Math / Logic

**Decomposition strategy:** Identify knowns, unknowns, constraints, relationships.

**Path generation:**

- Path A: Direct computation / algebraic approach
- Path B: Estimation / sanity-check approach
- Path C: Alternative formulation (reframe the problem)

**Verification:** Check with concrete examples. Verify boundary conditions. Does the answer make intuitive sense?

## Analysis / Research

**Decomposition strategy:** Define scope → Gather evidence → Identify patterns → Draw conclusions.

**Path generation:**

- Path A: Pro/con analysis (balanced evaluation)
- Path B: Historical precedent (what happened in similar cases?)
- Path C: First-principles reasoning (derive from fundamentals)

**Verification:** Are sources reliable? Are there counterexamples? Is the conclusion falsifiable?

## Creative / Design

**Decomposition strategy:** Constraints → Inspirations → Prototypes → Refinement.

**Path generation:**

- Path A: Convention-first (follow established patterns, innovate at edges)
- Path B: User-centric (start from user needs, work backwards)
- Path C: Constraint-driven (embrace limitations as creative fuel)

**Verification:** Does it meet the original brief? Is it internally consistent? Would the target audience understand it?
