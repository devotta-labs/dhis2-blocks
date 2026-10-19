# Rule Engine Spike Plan

> **For agentic workers:** this is a **throwaway spike**, not product code. No TDD, no review gates. The deliverable is the report in Task 3; the spike code may be deleted afterwards. Use superpowers:executing-plans.

**Goal:** Find out whether `@dhis2/rule-engine` (the Kotlin engine shared with Android and the backend) meets the event form's budget in the browser, and what its API gives us for attribution and pruning. That decides how `program-rules` and `use-program-rules` are planned.

**Architecture:** A private, unshipped Vite page under `spikes/rule-engine/` that dynamically imports the engine, builds its input from raw tracker API JSON (no Capture converters), and times loading and evaluation in Chromium via Playwright.

**Tech Stack:** Vite, React-free TypeScript, `@dhis2/rule-engine@3.8.6`, Playwright, the repo's e2e DHIS2 (`pnpm e2e:up 43`, Sierra Leone database).

**Spec:** `docs/superpowers/specs/2026-10-19-event-form-design.md` (§9, §16 items 1–2)

## Global Constraints

- **Budget (spec §16):** the engine is a lazily loaded chunk, not in the initial app bundle; one full evaluation on RMNCH *First antenatal care visit* (`WZbXY0S00lP`) takes **under 16 ms** on a mid-range laptop. If it misses, stop and report the numbers; don't work around it.
- Nothing under `packages/` or `apps/` changes. Spike files live in `spikes/rule-engine/` and are excluded from knip, lint and turbo (add `spikes/**` to their ignores).
- Never commit without the user's explicit OK.
- Capture's `src/core_modules/capture-core/rules/RuleEngine/helpers/InputBuilder.ts` (branch `master`, `~/Documents/github/capture-app`) is a reference for the engine's input shapes only. Don't copy its converters.

---

### Task 1: Fixtures from a real instance

- [ ] Start DHIS2: `pnpm e2e:up 43`.
- [ ] Save to `spikes/rule-engine/fixtures/`:
  - `programRules.json`: `GET /api/programRules?filter=program.id:eq:<RMNCH program>&fields=id,name,condition,priority,programStage[id],programRuleActions[id,programRuleActionType,content,data,dataElement[id],trackedEntityAttribute[id],programStageSection[id],option[id],optionGroup[id]]&paging=false`
  - `programRuleVariables.json`, `constants.json`, the stage's data elements with value types and option sets, `orgUnitGroups` for the org unit, the user's roles.
  - one real enrollment with attributes and all its events (`/api/tracker/enrollments/<uid>?fields=*,events[*]`).
- [ ] Generate `large/` fixtures: 300 rules over 200 data elements, mixing HIDEFIELD, ASSIGN chains of depth 3, and SHOWERROR, built by a small script from the RMNCH shapes.

### Task 2: Measure

- [ ] `spikes/rule-engine/src/adapter.ts`: `buildContext(fixtures)` and `buildInput(event, enrollment, otherEvents)`, mapping raw API JSON to the engine's `RuleEngineContext`, `RuleEnrollment`, `RuleEvent`.
- [ ] `spikes/rule-engine/src/main.ts`: on a button click, `await import('@dhis2/rule-engine')`, then time:
  - module load and init (cold, network cached);
  - full evaluation for RMNCH: 5 warm-up runs, then median and p95 of 100 runs;
  - the same for the `large` fixture.
- [ ] Correctness on RMNCH, compared with what Capture shows for the same inputs:
  - "Chronic conditions = Yes" un-hides the 6 follow-ups;
  - an LMP date leads to gestational age being assigned;
  - an LMP after the visit date gives the rule's error message.
- [ ] `vite build` the spike and record the engine chunk's raw and gzipped size, and confirm it's a separate chunk.
- [ ] Run the timings in headless Chromium through a Playwright script, on this laptop and with 4× CPU throttling (CDP `Emulation.setCPUThrottlingRate`) as a stand-in for a mid-range machine.
- [ ] Note what the API gives us:
  - Do effects carry the rule id and action id?
  - Can we evaluate a subset of rules (for pruning)?
  - Is the engine instance reusable across evaluations, or rebuilt each time?
  - How are ASSIGN chains and rule priority handled within one call?
  - Does it throw or return errors on bad expressions?

### Task 3: Report

- [ ] Write `docs/superpowers/spikes/2026-10-19-rule-engine.md`:
  - a table of measured numbers against the budget, with a pass or fail verdict;
  - API findings;
  - the input-mapping pitfalls hit;
  - a recommendation for the `program-rules` plan: loading strategy, whether pruning is needed for speed, and how attribution can be built.
- [ ] Ask the user whether to keep or delete `spikes/rule-engine/` before any commit.
