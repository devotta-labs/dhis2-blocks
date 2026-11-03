---
name: block-playground
description: Add a block to the docs playground (/playground/<block>), or extend its lab, where the block runs against a fake DHIS2 with controllable delays, failures and data, and every request shows on a waterfall. Use when asked to make a playground, lab or test bench for a block (data entry, tracked-entity finder, working list, …), or to try a block's states without a real server.
---

# Block playground

Read `apps/docs/src/playground/README.md` first. It lists the steps, the shared
parts and how to write the fake server. Then follow it:

- Start from `apps/docs/src/playground/observation-cards/`, the smaller lab.
  Copy it, then grow the server and controls the block needs.
- Register the block in `blocks.ts` and `PlaygroundPage.tsx`; nothing else
  routes to it.
- Use the shared parts (`LabLayout`, `LabServerScope`, `CanvasBoundary`,
  `NetworkControls`, `LogPanel`, `usePresetParam`) as they are. If a lab needs
  one to do more, change it in `apps/docs/src/playground/` for every lab, not
  in a copy.
- List every resource the block requests in `RESOURCES`. An unlisted resource
  has no fake answer and the block fails on it.
- Answer with the JSON DHIS2 sends for that resource and API version. Read the
  block's response schemas to get the shape right.
- Generate the data from settings in code; do not record fixtures.
- Keep the fake server a plain function in its own file, with a Vitest test
  next to it.
- Look at `apps/docs/src/playground/working-list-calendar/` for a full lab:
  generated data, many presets, a live DHIS2 mode, callbacks and a readout of
  the block's state.

Before finishing, run `pnpm dev:docs`, open `/playground/<block>` and check
that the block renders, a failing endpoint shows its error, a hanging one shows
loading, each request appears once on the waterfall, and the page works at
phone width and in the dark theme.
