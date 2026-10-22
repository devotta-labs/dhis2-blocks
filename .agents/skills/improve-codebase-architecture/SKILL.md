---
name: improve-codebase-architecture
description: Scan a codebase for deepening opportunities, present a visual HTML report, then work through the selected refactor.
disable-model-invocation: true
---

# Improve Codebase Architecture

Surface architectural friction and propose **deepening opportunities**: refactors that turn shallow modules into deep ones. The aim is testability and AI-navigability. This skill is standalone and works with any repository or language.

## Design principles

A **module** has an **interface** and an **implementation**. Its interface includes everything a caller needs to know: inputs, outputs, invariants, ordering, error modes, configuration and performance constraints.

**Depth** is leverage at that interface: how much behavior a caller can exercise per unit of interface they must learn. A **deep** module hides substantial behavior behind a small interface; a **shallow** module has an interface nearly as complex as its implementation. Depth is not a line-count ratio.

A **seam** is a place where behavior can vary without editing the caller. An **adapter** is a concrete implementation at that seam. **Leverage** is the capability callers gain; **locality** means changes, bugs and verification concentrate in one place instead of spreading across callers.

- **The deletion test.** Imagine deleting a module. If complexity vanishes, it was a pass-through. If complexity reappears across callers, it was earning its keep.
- **The interface is the test surface.** Callers and tests cross the same seam. If meaningful tests must reach past it, reconsider the module's shape.
- **One adapter means a hypothetical seam; two adapters mean a real one.** Reuse existing seams instead of introducing abstractions for things that do not actually vary.
- Prefer regression tests through the deepened interface. Replace tests of deleted shallow modules rather than adding another test layer that preserves the old structure.

## Process

### 1. Explore

**Scope before you scan: YAGNI.** Deepening a module pays off by making future changes to it easier, so put extra weight on parts of the codebase that have recently changed. Decide where to look before you look:

- If the user named a direction (a module, a subsystem, a pain point), take it and skip the inference below.
- Otherwise, walk back a good stretch of commit history (`git log --oneline`) to find hot spots: files and areas that keep coming up. Let those paths pull your attention first. If changes are scattered with no clear hot spot, widen the net.
- If history is unavailable, inspect entry points, callers and tests to find concrete friction. Say that history did not inform the scope.

Use a sub-agent to walk the selected area if the environment supports one; otherwise explore directly. Do not follow rigid heuristics. Note where you experience friction:

- Where does understanding one concept require bouncing between many small modules?
- Where are modules shallow, with an interface nearly as complex as the implementation?
- Where have pure functions been extracted just for testability, but the real bugs hide in how they are called, with no locality?
- Where do tightly coupled modules leak across their seams?
- Which parts of the codebase are untested, or hard to test through their current interface?

Apply the deletion test to suspected pass-throughs. Distinguish removing an unnecessary module from deepening a useful cluster: do not simply move complexity into a different file.

Read implementations, callers and existing tests before recommending a change. Separate observed friction from speculation. Use names already present in the code and explain architecture in plain English. Do not invent abstractions just to satisfy this scan.

Keep the survey read-only. Do not modify repository files, install dependencies or write to external systems during exploration.

### 2. Present candidates as an HTML report

Write a self-contained HTML file outside the repository. Resolve the OS temp directory from `$TMPDIR`, falling back to `/tmp` on Unix or `%TEMP%` on Windows. Use `architecture-review-<timestamp>.html` so each run gets a fresh file.

Use inline CSS and SVG so the report works offline. Each candidate gets a before/after visualization. Be visual. See [HTML-REPORT.md](HTML-REPORT.md) for the report structure and diagram patterns.

For each candidate, render a card with:

- **Files**: which files/modules are involved, with locations where useful.
- **Problem**: why the current architecture is causing friction, supported by concrete evidence.
- **Solution**: plain English description of what would change.
- **Benefits**: locality and leverage for callers, and how tests would improve.
- **Before / After diagram**: side-by-side, illustrating the shallowness and the deepening.
- **Recommendation strength**: `Strong`, `Worth exploring` or `Speculative`, rendered as a badge.

End with a **Top recommendation**: which candidate to tackle first and why. Prefer a bounded, behavior-preserving refactor with a clear regression test over a broad rewrite. If no candidate has enough evidence, say so instead of manufacturing a recommendation.

Deliver the HTML using the environment's attachment or artifact mechanism. If only a local desktop is available, open it with the platform's file opener and give the user the absolute path. Do not rely on a local path when the user is remote.

Do not propose detailed interfaces yet. Ask: "Which of these would you like to explore?" If the user has already explicitly asked for implementation and delegated candidate selection, choose the strongest candidate within that scope and state the choice before continuing.

### 3. Work through the selected candidate

Walk the decision tree with the user, asking one meaningful question at a time. Inspect the code to answer questions yourself wherever possible. Work through:

- Constraints and behavior that must not change: permissions, errors, ordering, state transitions and side effects.
- Dependencies: in-process, locally substitutable, remotely owned or truly external. Identify which existing seams can be exercised with a real adapter or a fake.
- The shape of the deepened module: what callers must know, what complexity it hides and what stays with each caller.
- Tests that survive, tests replaced with interface-level regression coverage, and any untestable gaps.

For a meaningful interface decision, sketch two genuinely different designs and compare their depth, locality and seam placement. Use parallel sub-agents when available and useful; otherwise compare them directly. Avoid adding a new abstraction layer when existing interfaces suffice.

Only implement when the user has requested or approved implementation. Keep the change focused, preserve existing behavior, and follow the repository's conventions and checks. Do not mix unrelated candidates into the same change. Report verified results and remaining gaps without claiming unperformed tests.

## Source

Adapted from Matt Pocock's [improve-codebase-architecture](https://github.com/mattpocock/skills/blob/5beb35b040e3de97e54fa9e386d7e42d15c295c2/skills/engineering/improve-codebase-architecture/SKILL.md) and [codebase-design](https://github.com/mattpocock/skills/blob/5beb35b040e3de97e54fa9e386d7e42d15c295c2/skills/engineering/codebase-design/SKILL.md) skills. Distributed under the [MIT license](LICENSE).
