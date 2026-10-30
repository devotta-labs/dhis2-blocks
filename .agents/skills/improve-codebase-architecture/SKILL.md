---
name: improve-codebase-architecture
description: Identify deepening opportunities by investigating architectural friction, shallow modules and test seams.
disable-model-invocation: true
---

# Improve Codebase Architecture

Surface architectural friction and identify **deepening opportunities**: refactors that turn shallow modules into deep ones. The aim is testability and AI-navigability.

## Design principles

A **module** has an **interface** and an **implementation**. Its interface includes everything a caller needs to know: inputs, outputs, invariants, ordering, error modes, configuration and performance constraints.

**Depth** is leverage at that interface: how much behavior a caller can exercise per unit of interface they must learn. A **deep** module hides substantial behavior behind a small interface; a **shallow** module has an interface nearly as complex as its implementation. Depth is not a line-count ratio.

A **seam** is a place where behavior can vary without editing the caller. An **adapter** is a concrete implementation at that seam. **Leverage** is the capability callers gain; **locality** means changes, bugs and verification concentrate in one place instead of spreading across callers.

- **The deletion test.** Imagine deleting a module. If complexity vanishes, it was a pass-through. If complexity reappears across callers, it was earning its keep.
- **The interface is the test surface.** Callers and tests cross the same seam. If meaningful tests must reach past it, reconsider the module's shape.
- **One adapter means a hypothetical seam; two adapters mean a real one.** Reuse existing seams instead of introducing abstractions for things that do not actually vary.
- Look for opportunities where regression tests through a deepened interface could replace tests coupled to shallow implementation details.

## Investigation

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

For each suspected opportunity, trace:

- **Behavior**: permissions, errors, ordering, state transitions and side effects that the current callers coordinate.
- **Dependencies**: which existing seams can be exercised with a real adapter or a fake, and which dependencies actually vary.
- **Depth**: what complexity a smaller interface could hide, what callers would still need to know and what responsibilities should remain separate.
- **Tests**: which behavior could be covered through the deepened interface and which gaps would remain.

Favor opportunities that concentrate a repeated protocol or tightly coupled behavior, improve locality and preserve meaningful differences between callers. Prefer a bounded change with a clear regression test over a broad rewrite. Similar-looking code alone is not evidence that it belongs behind one interface.
