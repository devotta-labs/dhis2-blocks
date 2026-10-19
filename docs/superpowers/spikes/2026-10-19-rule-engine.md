# Spike: `@dhis2/rule-engine` in the browser

Date: 2026-10-19 · Plan: `docs/superpowers/plans/2026-10-19-rule-engine-spike.md` · Spec: `docs/superpowers/specs/2026-10-19-event-form-design.md` §9, §16 items 1–2

**Verdict: the budget is met.** The engine loads as its own lazy chunk. One full evaluation of RMNCH *First antenatal care visit* takes 1.2 ms (median) unthrottled and 5.3 ms (median; p95 7.5 ms) with 4× CPU throttling. The 16 ms budget holds with room to spare. We can plan `program-rules` on full evaluation, with no pruning.

Setup:

- `@dhis2/rule-engine@3.8.6`. Capture pins `^3.8.2`.
- DHIS2 2.42 Sierra Leone database from the repo's e2e stack (`pnpm e2e:up 42`).
- Enrollment `PE6abx7Zhn0`, current event `Evahwp3zrQ4` (stage `WZbXY0S00lP`) and its 7 other events.
- Production `vite build`, run in headless Chromium 151 via Playwright on an Apple M1 Pro. "Mid-range laptop" is stood in for by CDP `Emulation.setCPUThrottlingRate` at 4×.
- Each figure below is the median of 3 fresh browser contexts. Each context ran 5 warm-up evaluations, then 100 timed ones.

Code: `spikes/rule-engine/`, a standalone npm package that is not in the pnpm workspace. To re-run:

```
npm install
./scripts/fetch-fixtures.sh
npx tsx scripts/gen-large.ts
npx vite build
node scripts/measure.mjs
```

## 1. Measurements against the budget

| Measure | Unthrottled | 4× throttle | Budget | Result |
|---|---|---|---|---|
| Engine chunk, raw | 807.7 KB | | | |
| Engine chunk, gzip / brotli | 214.0 KB / 162.3 KB | | | |
| Engine in the initial chunk? | No. The entry chunk is 3.0 KB, and no request for the engine is made before the button click. | | lazy chunk | **pass** |
| `import('@dhis2/rule-engine')`, first visit (localhost, no network cost) | 26 ms | 39 ms | | |
| Same, HTTP-cached reload | 16 ms | 25 ms | | |
| `new RuleEngineJs()` | <0.1 ms | <0.1 ms | | |
| Build `RuleEngineContextJs` (RMNCH / large) | ≤0.1 / 0.5 ms | 0.3 / 1.9 ms | | |
| **RMNCH full evaluation, median** | **1.2 ms** | **5.3 ms** | < 16 ms | **pass** |
| RMNCH full evaluation, p95 | 1.7 ms | 7.5 ms | | pass |
| RMNCH first (JIT-cold) evaluation | 2.5 ms | 10.6 ms | | pass |
| RMNCH input mapping + evaluation, median | 1.2 ms | 5.1 ms | | |
| RMNCH rebuilding engine, context and input every time (what Capture does) | 1.1 ms | 5.1 ms | | |
| RMNCH with its 3 broken `!==` rules fixed (see §3) | 0.7 ms | 3.0 ms (p95 3.8) | | |
| Large: 300 rules, 200 data elements, 10 other events, median | 23.3 ms | 98.0 ms | (informational) | over 16 ms |
| Large, p95 | 25.6 ms | 105.7 ms | | |
| Large, subset of 10 / 30 / 100 rules | 0.7 / 1.3 / 3.7 ms | 2.8 / 5.6 / 15.9 ms | | |

Notes:

- The load times are for localhost, so they cover parse and compile only. Over a real link, 214 KB gzip adds transfer time: about 1 s at 1.6 Mbit/s.
- The "broken rules" cost is probably overstated. Every evaluation logs 3 `console.error` lines, and Playwright's console listener serialises each one over CDP. Without devtools attached the gap should be smaller. Either way, broken rules should not reach the engine (see §5).
- The large fixture is built by `scripts/gen-large.ts` from RMNCH shapes:
  - 100 HIDEFIELD rules, each with 2 actions.
  - 99 ASSIGN rules forming 33 chains of depth 3, run through `#{var}` and priorities.
  - 101 SHOWERROR rules, half of them stage-scoped and some using `d2:validatePattern`.
  - One evaluation emits 16 HIDEFIELD, 99 ASSIGN and 42 SHOWERROR effects. I checked chain values by hand: newest values 69 + 37 → 106 → 212 → round(212/3) + 70 = 141.

Cost scales linearly with rule count. In Node a rule costs about 0.06 ms (HIDEFIELD) to 0.15 ms (ASSIGN or SHOWERROR with a data expression). On top of that there is a fixed ~0.6 ms for building the value map from 200 variables over 11 events.

A CPU profile of the large case shows the split:

- **~49 %** goes to `toRuleEngineContextJava`/`toRuleJava`. The JS facade converts every `RuleJs` and `RuleActionJs` into Kotlin objects and **re-parses every condition and action expression on every `evaluate*` call**.
- **~40 %** is actual evaluation.

The re-parsing is an upstream inefficiency. It means keeping an engine or context instance around saves nothing today. If the facade cached its converted rules, evaluation would cost about half as much.

## 2. Correctness on RMNCH

I checked these against the rule definitions and Capture's own mapping semantics. I didn't drive the Capture UI. All pass in Node and in Chromium:

| Scenario | Result |
|---|---|
| Chronic conditions (`de0FEHSIoxh`) = No → HIDEFIELD on the 6 follow-ups (`xPTngRLQTnu`, `sdchiIXIcCf`, `VFffa31SKjH`, `Q1x1HIhuwFN`, `zzGNbeMnTd6`, `UQ2Zo8CruPB`). = Yes → none hidden. | pass |
| LMP `2026-01-01`, visit `2026-03-12` → ASSIGN gestational age (`roKuXYfw1BW`) = `10` | pass |
| LMP `2026-04-01`, after the visit → SHOWERROR on LMP: "LMP date entered is after the date of the antenatal care visit." | pass |
| No LMP → no assignment and no LMP error | pass |
| Every effect carries a rule id and an action id (the action id is tunnelled; see §3) | pass |

The baseline event also emits HIDEPROGRAMSTAGE from "Hide postpartum followup". That rule reads a `DATAELEMENT_NEWEST_EVENT_PROGRAM_STAGE` variable from the postpartum stage's event. So the other-events input works.

## 3. API findings

**Do effects carry the rule id and action id?**

- `RuleEffectJs.ruleId` is native.
- There is **no action id**. `RuleActionJs` has `data`, `type`, `values: Map<string,string>` and `priority`. But `values` passes through to the effect unchanged, so we can put `id` (and anything else) in it. Capture does the same thing: it spreads every raw action field into `values` and dedupes by `values.get('id')`.
- Rule priority is not echoed on the effect. Look it up by `ruleId`.
- `effect.data` is the evaluated `data` expression:
  - `''` for non-ASSIGN actions with no data;
  - `null` for an ASSIGN whose result is empty.

**Can we evaluate a subset of rules?**

- Yes: build a `RuleEngineContextJs` from a filtered `RuleJs[]`. Context construction costs ~0.1–0.5 ms.
- Cost is linear in rule count, plus a fixed value-map cost (~0.6 ms in Node for 200 variables).
- Two catches:
  - A subset has to include every upstream ASSIGN in a chain, because evaluation is a single pass (below).
  - Out of the box, `evaluateEvent` already drops rules whose `programStage` differs from the event's stage.

**Is the engine instance reusable across evaluations?**

- Yes. `RuleEngineJs` and `RuleEngineContextJs` are stateless and immutable. I evaluated the same context with different inputs and nothing leaked between calls.
- Reuse brings **no speed gain**, because the facade re-converts and re-parses the whole context on every call. Rebuilding everything per call, as Capture does, costs the same.
- `analyzeContextRequirements(rules, variables)` reports what the rules need. RMNCH needs all events, the enrollment, data values and attributes, but no org unit groups. That lets the hook skip fetching the enrollment's other events when a program doesn't need them.

**How are ASSIGN chains and priority handled within one call?**

- **Order.** Rules are sorted by `priority` ascending, with null priorities last. They are evaluated in **one pass**, with no fixpoint iteration: if a consumer has a lower priority number than its producer, it reads the stale value (verified).
- **`field` ASSIGN does not feed variables.** An ASSIGN with `values.field` writes `valueMap[<field uid>]`. Expressions read `valueMap[<variable name>]`, so `#{var}` never sees it, even when `var` is backed by that data element (verified: a field-based chain yields `C = 1`, not `3`).
- **Chains only work through `content: '#{var}'` (or `A{var}`).** That form writes the variable. If the variable is backed by a data element or attribute, the engine also emits an effect whose `values` gain `field` and `attributeType`.
- **`field` beats `content`.** If an action sets both, `content` is ignored (`RuleAction.c20`), and the chain breaks. The adapter therefore emits the content form, and adds the field form only when the field differs from the variable's backing field.
- **Calculated values emit nothing.** An ASSIGN to a `CALCULATED_VALUE` variable updates the variable but emits no effect. The dependency graph still has to record the write.

**Does it throw or return errors on bad expressions?** Neither. `evaluate*` never throws for metadata problems:

- A failing condition drops the rule.
- A failing action expression drops that action.
- Unknown variables, bad syntax, unknown `d2:` functions, unsupported operators and value-coercion failures are all logged with `console.error`, and evaluation continues. Example message: `Rule <name> with id <uid> … raised an unexpected exception: expected name`.
- Errors are never returned. We would have to scrape the console to get them.
- `engine.validate(expression, Map<name, DataItemJs>)` returns a `RuleValidationResult` (valid, errorMessage) without evaluating. Pre-validating each rule once at context-build time catches all three broken RMNCH rules. Given a typed store, it also reports type errors and warnings.

**Expression analysis for the dependency graph:**

- `ExpressionJs` has `collectProgramRuleVariableNames()`, `collectProgramVariablesNames()`, `collectUIDs()` and `collectInOrgUnitGroups()`. On RMNCH they return the right names, including string references like `d2:hasValue('lmp')` → `lmp` and `V{event_date}` → `event_date`.
- The catch: **`ExpressionJs` is declared in `rule-engine.d.mts` but not exported from the package entry.** It lives in the internal `expression-parser.mjs`, and the package's `exports` map only exposes `.`.
- So browser code can't import it without a bundler alias to an internal file. Tests can import it by file path.

**Other behaviour:**

- `evaluateEvent` runs the actions whose `values.attributeType` is `DATA_ELEMENT`, `UNKNOWN` or missing. It skips `TRACKED_ENTITY_ATTRIBUTE`. So `attributeType` must be set on every field-targeted action, or registration-form actions will leak into the event form.
- All errors and warnings go through `console.error`/`console.warn`. There is no logger hook.

## 4. Input-mapping pitfalls hit

I mapped raw tracker and metadata API JSON directly (`src/adapter.ts`). These pitfalls bit, or nearly bit:

1. **Dates.**
   - The tracker API returns `occurredAt` and similar timestamps as `2026-03-12T12:05:00.000`, with no offset.
   - `RuleLocalDate.parse` rejects anything but `yyyy-MM-dd`, so dates have to be cut to their first 10 characters.
   - `RuleInstant.parse` rejects strings with no offset, so `createdAt` needs a `Z` appended. That assumes server-local time is UTC. Only `V{creation_date}`-style variables are affected.
   - A DATETIME or AGE **data value** read through a DATE variable fails to coerce, and the rule is silently skipped. Values have to be cut to `yyyy-MM-dd` by value type.
2. **Empty values.** `d2:hasValue` is true for `''`. Leave empty or cleared values out of `dataValues` and `attributeValues` rather than passing `''`.
3. **RMNCH contains conditions this engine can't parse.** 3 of the 18 rules use `!==` (`#{allergies} !== 'Yes'` and two more), which fails with `expected name`. Those rules never fire in this engine, so the allergy fields are never hidden. I found no preprocessing in Capture's rules code, so Capture presumably behaves the same. This is a metadata bug, and we should surface it, not rewrite it.
4. **Variable names.** Use the variable's `name`, not `displayName`. Expressions reference the untranslated name. Capture passes `displayName`, which would break under a translated UI.
5. **Option sets.** The metadata API has `useCodeForOptionSet` directly. Capture's internal model inverts it as `useNameForOptionSet`, which is easy to get wrong when porting. Options are `new Option(name, code)`.
6. **Constants** are keyed by **UID** (`C{Gfd3ppDfq8E}`). A non-UID key is a parse error (`expected uid`). Values have to be strings: the API returns numbers (`5.0` → `"5"`).
7. **ASSIGN actions.** Split them into a content (`#{var}`) form and a field form, as described in §3. Don't set both on one `RuleActionJs`.
8. **`attributeType`** must be set on every action that has a field (`DATA_ELEMENT` or `TRACKED_ENTITY_ATTRIBUTE`). Use `UNKNOWN` for the others.
9. **Value types.** Map the NUMBER family (INTEGER*, PERCENTAGE, UNIT_INTERVAL) → `NUMERIC`, BOOLEAN/TRUE_ONLY → `BOOLEAN`, DATE/DATETIME/AGE → `DATE`, and everything else → `TEXT`. A non-numeric string in a NUMERIC variable is a silent coercion error.
10. **Org unit groups.** Fill `RuleSupplementaryDataJs.orgUnitGroups` keyed by **both** group id and group code, each mapping to `[orgUnitId]`. `d2:inOrgUnitGroup` accepts either.
11. **NEWEST_EVENT semantics.**
    - `DATAELEMENT_NEWEST_EVENT_PROGRAM` takes the value from the newest event by date, and the current event doesn't always win. Editing an older event doesn't change the variable if a newer event has a value. This is DHIS2 behaviour, but it surprised my own large-fixture check.
    - The other events must exclude the current event. Otherwise its stored values compete with the edited ones.

## 5. Recommendation for the `program-rules` plan

**Loading.**

- `use-program-rules` should `import('@dhis2/rule-engine')` the first time it's used.
- `program-rules` should take the engine module as an argument and use `import type` only, like `src/adapter.ts`, so the 214 KB-gzip chunk never enters the initial bundle.
- Start the import as soon as the form mounts, in parallel with the metadata fetch. The engine is then usually ready before the metadata, and the spec's `status: 'loading'` is rarely visible.
- Hold the module in a module-level promise so it is fetched once per app.

**Pruning is not needed for speed.**

- Real programs are far inside the budget: RMNCH takes 5 ms at 4× throttle including the broken rules, and 3 ms without them.
- Keep the spec's position: full evaluation, memoised per input, and pruned re-evaluation optional and **not built in v1**.
- A 300-rule program at 4× (~100 ms) would cause jank if it ran on every keystroke. That is a reason to run evaluation when a value is committed (blur, or change for selects and dates), not to build pruning. Pruning would also have to respect single-pass priority order, which makes the differential test harder.
- Measure the largest real Sierra Leone program before deciding on anything more.
- If large programs matter later, the cheapest fix is upstream: cache the converted rules in the JS facade, which halves the cost. Next would be a worker. Pruning comes last.

**Building attribution.**

- *Per effect.* Put `id` (the action uid) and `ruleId` in every `RuleActionJs.values` map. The engine returns `values` untouched (plus `field`/`attributeType` for content ASSIGNs), so each normalised effect can carry `{ ruleId, actionId }`. Rule name, condition and priority come from a `Map` built at context time.
- *Dependency graph.*
  - Use our own small scanner over conditions and action `data` for `#{…}`, `A{…}`, `V{…}`, `C{…}` and the quoted-name `d2:` functions (`d2:hasValue('x')`, `d2:count('x')` and so on). The engine's `ExpressionJs` collectors aren't publicly exported.
  - Add a dev-only differential test that deep-imports `@dhis2/rule-engine/expression-parser.mjs` by file path and checks that our scanner agrees with `collectProgramRuleVariableNames()`/`collectProgramVariablesNames()` on RMNCH and generated fixtures.
  - Writes come from action targets: `field`, ASSIGN `content` variables, sections and options.
  - Chain edges are ordered by priority, because evaluation is a single pass.
- *Rule errors.*
  - When the context is built, run `engine.validate()` once over every condition and action expression.
  - Leave failing rules out of the context, which also removes the per-evaluation `console.error` cost.
  - Expose them in the inspector data as `{ ruleId, expression, message }`.
  - Rules that fail at runtime (coercion errors) still only show up in the console. Note that limit in the inspector.

**Input mapping.** Port the pitfalls in §4 as the adapter's unit tests. `spikes/rule-engine/src/adapter.ts` is a usable starting point for `program-rules/build-context.ts` and `build-input.ts`. It doesn't depend on Capture.
