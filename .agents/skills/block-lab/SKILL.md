---
name: block-lab
description: Build or extend a docs lab, a dev-server page where a block runs against a fake DHIS2 with controllable delays, failures and data, and every request shows on a waterfall. Use when asked to make a lab, playground or test bench for a block (data entry, tracked-entity finder, working list, …), or to try a block's states without a real server.
---

# Block lab

Read `apps/docs/src/lab/README.md` first. It lists the steps, the shared parts
and how to write the fake server. Then follow it:

- Start from `apps/docs/src/lab/example/`, the smallest working lab, not from
  a bigger lab. Copy it, then grow the server and controls the block needs.
- Use the shared parts (`LabLayout`, `LabServerScope`, `CanvasBoundary`,
  `NetworkControls`, `RequestWaterfall`) as they are. If a lab needs one to do
  more, change it in `apps/docs/src/lab/` for every lab, not in a copy.
- List every resource the block requests in `RESOURCES`. An unlisted resource
  has no fake answer and the block fails on it.
- Answer with the JSON DHIS2 sends for that resource and API version. Read the
  block's response schemas to get the shape right.
- Keep the fake server a plain function in its own file, with a Vitest test
  next to it.
- Look at `apps/docs/src/lab/working-list-calendar/` for a full lab: generated
  data, presets, a live DHIS2 mode, and a readout of the block's state.

Before finishing, open the lab with its `pnpm lab:<block>` script and check
that the block renders, a failing endpoint shows its error, a hanging one shows
loading, and each request appears once on the waterfall.
