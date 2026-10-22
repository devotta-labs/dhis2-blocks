---
name: component-usage-patterns
description: Show concise, realistic usage variations for an already-installed React component, hook, or component family from an external developer's perspective.
---

# Component usage patterns

Explain how an external developer would import and use the requested components in their own React app. Treat installation (including shadcn CLI installation when applicable), import aliases, authentication, and required providers/context as already configured. Do not mention these assumptions, include setup preambles or installation commands, or modify the codebase.

## Inspect

- Read the requested PR/revision or current source: public exports, props/types, hooks, registry targets, and examples. Verify behavior in implementation; do not invent APIs.
- Use consumer-facing imports. For source-installed components, use their installed local paths, not monorepo workspace imports.

## Answer

Start with one sentence explaining the usage model. Then show 2–4 genuinely different supported patterns, most common first, such as:

1. A fixed feature section using the main components and their data hook.
2. A configuration-driven variation rendering multiple components.
3. A headless hook or exported primitives with custom UI.
4. Presentational components fed by the app's existing data layer.

Choose only patterns the actual API supports; these are not a mandatory checklist.

For each: a short title, at most one explanatory sentence, and a realistic TSX example. Keep code fully written and readable: imports, props/types, meaningful names, and relevant state handling. Never shorten code with ellipses or omitted essential logic; shorten the surrounding prose instead. Later snippets may reuse earlier definitions only when explicitly stated.

Mark placeholder IDs/data clearly.

End with at most three important, verified boundaries that affect integration (for example, read-only behavior, data scope, or display limits). Link the inspected PR/source once. Skip exhaustive prop tables, implementation walkthroughs, speculative variations, and unsolicited redesign advice.
