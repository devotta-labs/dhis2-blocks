# Program rules lib and hook Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship two shadcn registry items, `program-rules` (`registry:lib`, pure, no React) and `use-program-rules` (`registry:hook`), from a new workspace package `packages/blocks/program-rules` (`@dhis2-blocks/program-rules`).

**Architecture:** The lib turns normalised rule metadata into a `RuleContext` (converted engine rules, rule/action info, dependency graph, invalid rules, data requirements) and evaluates `EventRuleInput` into a typed `RuleEffects` where every effect carries an `Attribution`. It receives the `@dhis2/rule-engine` module as an argument and only `import type`s it. The hook lazy-imports the engine once per app (module-level promise, started on mount in parallel with the metadata query), fetches metadata and, only when the context needs them and the host did not pass them, the enrollment and its other events, then memoises evaluation on input content.

**Tech Stack:** TypeScript, React 18, `@dhis2/rule-engine@3.8.6`, `@tanstack/react-query` 5 with `@dhis2/app-runtime`'s data engine, zod 4, better-result 3, vitest 4 (node + browser projects), shadcn 4.22.1 registry.

**Spec:** `docs/superpowers/specs/2026-10-19-event-form-design.md` (§5, §6, §8, §9, §14). Binding findings: spike report `docs/superpowers/spikes/2026-10-19-rule-engine.md` on branch `claude/rule-engine-spike-ebc4d9` (§3 API findings, §4 pitfalls, §5 recommendation).

> **Layout changed during execution.** At the event-form session's request the items now install into
> `@components/program-rules/<path under src>`, with the lib entry at `src/index.ts` (internals `src/lib/`), the
> hook entry at `src/use-program-rules.ts` (internals `src/hooks/`) and relative imports inside the package. Other
> blocks import `@/registry/program-rules/index` and `@/registry/program-rules/use-program-rules`. The
> `@lib/`/`@hooks/` layout and `src/lib/index.ts`/`src/hooks/index.ts` below are superseded; see the package README.

## Global Constraints

- One engine: `@dhis2/rule-engine` only, pinned `3.8.6`. The lib uses `import type` only; the hook is the only place that does `import('@dhis2/rule-engine')`.
- Full evaluation only. No pruning, no inspector UI, no rule editing.
- Rule effects never write values; the lib only reports them (§8 overlay is the form's job).
- Public names are fixed (the event-form plan is written against them): `buildRuleContext`, `evaluateEventRules`, `EventRuleInput`, `RuleEffects`, `RuleMessage`, `Attribution`, `useProgramRules`. Additions are allowed only as new optional fields or new exports.
- Values are tracker API strings. Empty values are omitted.
- Conventions as in `packages/blocks/working-list`: zod at the API boundary, better-result for fallible steps, React Query with `useDataEngine()`, vitest node project for `*.test.ts` and browser project for `*.test.tsx`, oxlint anti-slop rules (no `vi.mock`, no runtime `typeof`, safety comment on every type assertion).
- Don't edit `packages/blocks/ui`, `packages/blocks/working-list` or `apps/web`.
- DHIS2 for manual checks: e2e stack v42 only (`pnpm e2e:up 42`).
- Commits unsigned: `git -c commit.gpgsign=false commit`, message ending `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`. Never push.

## Decisions taken while planning

- **Pre-validation excludes only parse-stage failures.** `engine.validate()` runs a type check after parsing, and that check is stricter than runtime: on RMNCH it flags valid expressions such as `d2:weeksBetween(#{lmp},V{event_date})` and `!#{chronicconditions}` with `"N error(s), M warning(s)"`. Excluding those would change behaviour against every other DHIS2 client. So an expression is invalid only when `validate` fails with a message that is not that summary (`expected name`, `Unknown function or constant: …`). On RMNCH this is exactly the 3 `!==` rules. An invalid condition removes the rule; an invalid action `data` removes only that action, because that is what the engine does at runtime.
- **Org unit groups are context data, not input.** The context holds `Map<groupIdOrCode, orgUnitId[]>` for the groups the rules reference (`d2:inOrgUnitGroup('x')`), so evaluation stays a pure function of the input whatever org unit the user picks.
- **Option groups.** `HIDEOPTIONGROUP`/`SHOWOPTIONGROUP` effects carry group ids, as the API says. The context also exposes `optionGroupOptions: Map<groupId, Set<optionCode>>` (fetched with the rule actions), surfaced on the hook result, so the form can resolve groups without fetching.
- **Install layout.** Lib files install to `@lib/program-rules/<file>`, hook files to `@hooks/use-program-rules/<file>`. In-repo specifiers, which shadcn 4.22.1's import transform rewrites to the consumer's `lib`/`hooks` aliases: `@/registry/dhis2/lib/program-rules` (lib entry) and `@/registry/dhis2/hooks/use-program-rules` (hook entry). Task 1 proves this with the install check before anything else is built.

## Review Focus

1. **Half-typed dates** (`'2026-1'`) in `occurredAt` or a DATE value: the engine's date parser throws. Expected: treat as missing, still evaluate the other rules. Test in Task 3.
2. **Broken metadata beyond `!==`** (unknown variable, unknown `d2:` function): evaluation still returns every other rule's effects. Test in Task 4.
3. **Program with no rules**: hook reaches `ready` with empty effects and never fetches the enrollment. Test in Task 6.
4. **No `enrollmentId` while rules need enrollment data**: evaluate with no enrollment, `ready`, no request. Test in Task 6.
5. **Same content, new object identity** on every render: no re-evaluation, `effects` keeps its identity. Test in Task 6.

---

## File structure

```
packages/blocks/program-rules/
  package.json, tsconfig.json, tsconfig.test.json, vitest.config.ts, registry.json, README.md
  type-tests/public-surface.ts
  src/lib/                         → item `program-rules` (registry:lib)
    index.ts                       public exports
    types.ts                       every public type
    valueTypes.ts                  value-type mapping, value and date normalisation
    scanExpression.ts              dependency scanner
    dependencyGraph.ts             graph + per-action transitive readsFields
    buildContext.ts                buildRuleContext
    buildInput.ts                  EventRuleInput → engine objects
    evaluate.ts                    evaluateEventRules, effect normalisation, explainField
  src/hooks/                       → item `use-program-rules` (registry:hook)
    index.ts
    loadRuleEngine.ts              module-level promise
    client.ts                      zod-validated query client over useDataEngine
    metadata.ts                    fetch + schemas → ProgramRulesMetadata
    enrollment.ts                  fetch enrollment/events → RuleEnrollmentInput / RuleEventInput[]
    queryKeys.ts
    inputKey.ts                    content key for memoisation
    useProgramRules.ts
  test/fixtures/rmnch/*.json       raw API JSON copied from the spike
  test/fixtures/large/bundle.json  generated 300-rule fixture from the spike
  test/rmnch.ts                    fixture loaders
```

## Public API (exact; README and `type-tests/public-surface.ts` carry the same)

```ts
// lib
type RuleEngineModule = typeof import('@dhis2/rule-engine')   // via `import type * as Engine`

interface ProgramRulesMetadata {
    programId: string
    programName: string
    programStages: ReadonlyArray<{ id: string; name: string }>
    rules: ReadonlyArray<ProgramRuleMetadata>
    variables: ReadonlyArray<ProgramRuleVariableMetadata>
    constants: ReadonlyArray<{ id: string; value: number | string }>
    optionSets: ReadonlyArray<{ id: string; options: ReadonlyArray<{ code: string; name: string }> }>
    user: { roleIds: ReadonlyArray<string>; groupIds: ReadonlyArray<string> }
    orgUnitGroups?: ReadonlyArray<{ id: string; code?: string; orgUnitIds: ReadonlyArray<string> }>
}
interface ProgramRuleMetadata { id; name; displayName?; condition: string; priority?: number; programStageId?; actions: ReadonlyArray<ProgramRuleActionMetadata> }
interface ProgramRuleActionMetadata {
    id; type: string; content?; displayContent?; data?; location?
    dataElementId?; attributeId?; sectionId?; programStageId?
    option?: { id: string; code: string }
    optionGroup?: { id: string; optionCodes: ReadonlyArray<string> }
}
interface ProgramRuleVariableMetadata {
    id; name; sourceType: string; useCodeForOptionSet: boolean; valueType?: string
    dataElementId?; attributeId?; fieldValueType?: string; optionSetId?; programStageId?
}

type RuleEventStatus = 'ACTIVE' | 'COMPLETED' | 'SCHEDULE' | 'SKIPPED' | 'VISITED' | 'OVERDUE'
interface RuleEventInput { id; programStageId; occurredAt?; scheduledAt?; createdAt?; completedAt?; orgUnitId; orgUnitCode?; status: RuleEventStatus; dataValues: Record<string, string> }
interface RuleEnrollmentInput { id; enrolledAt; occurredAt?; orgUnitId; orgUnitCode?; status?: 'ACTIVE' | 'COMPLETED' | 'CANCELLED'; attributes: Record<string, string> }
interface EventRuleInput { event: RuleEventInput; enrollment?: RuleEnrollmentInput; otherEvents: ReadonlyArray<RuleEventInput> }

interface Attribution { ruleId; ruleName; actionId; condition; readsFields: string[] }
interface RuleMessage { kind: 'error' | 'warning' | 'errorOnComplete' | 'warningOnComplete'; text: string; by: Attribution }
interface RuleDisplayItem { location: 'feedback' | 'indicators'; label: string; value: string; by: Attribution }
interface RuleEffects {
    hiddenFields: Map<string, Attribution[]>; hiddenSections: Map<string, Attribution[]>; mandatoryFields: Map<string, Attribution[]>
    assignedValues: Map<string, { value: string | null; by: Attribution }>
    messages: Map<string /* fieldId | 'form' */, RuleMessage[]>
    hiddenOptions: Map<string, Set<string /* option code */>>
    optionGroups: Map<string, { hidden: Set<string>; shown: Set<string> }>
    displayTexts: RuleDisplayItem[]; keyValuePairs: RuleDisplayItem[]; hiddenProgramStages: Set<string>
}
interface InvalidRule { ruleId; ruleName; actionId?: string; expression; message }
interface RuleDependencies {
    readsVariables: string[]; readsProgramVariables: string[]; readsConstants: string[]; readsOrgUnitGroups: string[]
    readsFields: string[]          // transitive through variables and earlier ASSIGNs
    writesFields: string[]; writesVariables: string[]; writesSections: string[]; writesProgramStages: string[]
}
interface RuleDependencyGraph {
    rules: Map<string, RuleDependencies>          // insertion order = evaluation order (priority asc, nulls last, stable)
    fieldReaders: Map<string, string[]>           // fieldId → ruleIds
    fieldWriters: Map<string, string[]>
}
interface RuleContextRequirements { enrollment: boolean; otherEvents: boolean; orgUnitGroups: string[] }
interface RuleContext {
    programId: string
    rules: ReadonlyArray<RuleJs>                  // converted, invalid ones removed
    ruleInfo: Map<string, RuleInfo>               // RuleInfo = { id, name, condition, priority?, programStageId?, actions: Map<actionId, Attribution> }
    graph: RuleDependencyGraph
    invalidRules: InvalidRule[]
    requirements: RuleContextRequirements
    optionGroupOptions: Map<string, Set<string>>
    // plus opaque engine handles used by evaluateEventRules
}
buildRuleContext(engine: RuleEngineModule, metadata: ProgramRulesMetadata): RuleContext
evaluateEventRules(engine: RuleEngineModule, context: RuleContext, input: EventRuleInput): RuleEffects
explainField(effects: RuleEffects, fieldId: string): Attribution[]

// hook
interface ProgramRulesInput { event: RuleEventInput; enrollment?: RuleEnrollmentInput; otherEvents?: ReadonlyArray<RuleEventInput> }
interface UseProgramRulesOptions { programId; programStageId; enrollmentId?; input: ProgramRulesInput; enabled?: boolean }
interface UseProgramRulesResult {
    status: 'loading' | 'ready' | 'error'
    effects?: RuleEffects
    invalidRules: InvalidRule[]
    explain(fieldId: string): Attribution[]
    error?: Error
    graph?: RuleDependencyGraph
    optionGroupOptions: Map<string, Set<string>>
}
useProgramRules(options: UseProgramRulesOptions): UseProgramRulesResult
loadRuleEngine(): Promise<RuleEngineModule>         // preload hook for hosts
programRulesQueryKeys                                // for invalidation
```

---

### Task 1: Package scaffold, public surface, registry items, install-check extension

**Files:**

- Create: `packages/blocks/program-rules/{package.json,tsconfig.json,tsconfig.test.json,vitest.config.ts,registry.json,README.md}`, `type-tests/public-surface.ts`, `src/lib/{index.ts,types.ts}`, `src/hooks/index.ts` (stubs that typecheck), `test/fixtures/**` (copied), `test/rmnch.ts`
- Modify: `registry.json` (include), `tools/registry/installCheck.ts` (add both items to `shadcn add`), `tools/registry/consumer/src/main.tsx` (type-level use of both), `knip.json` only if knip needs it

**Interfaces:**

- Produces: every type in "Public API"; in-repo specifiers `@/registry/dhis2/lib/program-rules` and `@/registry/dhis2/hooks/use-program-rules` (tsconfig `paths` + vitest `resolve.alias`).

- [ ] **Step 1:** Write `package.json` copying working-list's scripts and versions. Dependencies: `@dhis2/rule-engine@3.8.6`, `@dhis2/app-runtime`, `@tanstack/react-query`, `better-result`, `zod`. Dev: as working-list minus Tailwind/ui-only packages. `exports`: `"."` → `src/lib/index.ts`, `"./hooks"` → `src/hooks/index.ts`. `pnpm install`.
- [ ] **Step 2:** Write `src/lib/types.ts` with the Public API types, stub `buildRuleContext`/`evaluateEventRules`/`explainField`/`useProgramRules`/`loadRuleEngine` that throw `new Error('not implemented')`, and `type-tests/public-surface.ts` that imports every export and pins the hook result and effect types (`satisfies`, plus `@ts-expect-error` on a write to `RuleEffects` value maps' attribution `readsFields` being non-array, and on a missing `programStageId`).
- [ ] **Step 3:** Write `registry.json`: item `program-rules` (`registry:lib`, files `src/lib/*.ts` → `@lib/program-rules/<file>`, dependencies `@dhis2/rule-engine@3.8.6`) and item `use-program-rules` (`registry:hook`, files `src/hooks/*.ts` → `@hooks/use-program-rules/<file>`, dependencies app-runtime, react-query, better-result, zod, rule-engine, react; `registryDependencies: ["devotta-labs/dhis2-blocks/program-rules"]`). Add to root `registry.json` `include`.
- [ ] **Step 4:** Extend `installCheck.ts` step 3 to add `program-rules.json` and `use-program-rules.json`; in `consumer/src/main.tsx` import `useProgramRules` from `@/hooks/use-program-rules` and `buildRuleContext` from `@/lib/program-rules` in a type-level function.
- [ ] **Step 5:** Run `pnpm registry:check`. Expected: assertions 1–5 and 7–8 pass for the new items (no `@/registry/` left, tsc clean); assertion 6 or 9 may fail on the theme until the primitives refactor lands. If the import rewrite does not land on the installed paths, change the specifiers/targets until tsc passes, and record the working pair in the README.
- [ ] **Step 6:** Copy the RMNCH fixtures (`programRules`, `programRuleVariables`, `constants`, `optionSets`, `orgUnit`, `me`, `program`, `enrollment`) and `large/bundle.json` into `test/fixtures/`.
- [ ] **Step 7:** `pnpm --filter @dhis2-blocks/program-rules typecheck && pnpm lint && pnpm dead-code:audit`, then commit `feat: scaffold the program-rules lib and hook registry items`.

### Task 2: Expression scanner

**Files:** Create `src/lib/scanExpression.ts`, Test `src/lib/scanExpression.test.ts`

**Interfaces:**

- Produces: `scanExpression(expression: string): ExpressionReferences` with `ExpressionReferences = { variables: string[]; programVariables: string[]; constants: string[]; orgUnitGroups: string[] }`, each deduplicated in first-seen order.

- [ ] **Step 1: Write the failing tests**
    - `#{lmp}`, `A{mobile}`, `d2:hasValue('lmp')`, `d2:countIfValue("x", 1)` → variables `['lmp','mobile','x']` (order of appearance);
    - `V{event_date}` → programVariables `['event_date']`; `C{Gfd3ppDfq8E}` → constants;
    - `d2:inOrgUnitGroup('MCHP')` → orgUnitGroups `['MCHP']`, not a variable;
    - quoted names in other functions (`d2:validatePattern(A{x}, 'abc')`) do not count;
    - differential: for every condition and action `data` in RMNCH and `large/bundle.json`, `variables` equals the set of `new ExpressionJs(x, mode).collectProgramRuleVariableNames()` and `programVariables` equals `collectProgramVariablesNames()`, skipping expressions the parser rejects. `ExpressionJs` is loaded from `expression-parser.mjs` next to the resolved `@dhis2/rule-engine` entry (`createRequire(import.meta.url).resolve`), test-only.
- [ ] **Step 2:** Run `pnpm --filter @dhis2-blocks/program-rules exec vitest run --project node src/lib/scanExpression.test.ts` → FAIL.
- [ ] **Step 3:** Implement with regexes: `#\{([^}]+)\}`, `A\{([^}]+)\}`, `V\{([^}]+)\}`, `C\{([^}]+)\}`, and `d2:(hasValue|count|countIfValue|countIfZeroPos|countIfCondition|maxValue|minValue|lastEventDate)\(\s*(['"])(.+?)\2` for quoted variable names, `d2:inOrgUnitGroup\(\s*(['"])(.+?)\1` for groups. Widen the function list only as the differential test demands.
- [ ] **Step 4:** Run → PASS. Commit `feat: scan rule expressions for the variables they read`.

### Task 3: Value normalisation and engine input

**Files:** Create `src/lib/valueTypes.ts`, `src/lib/buildInput.ts`, Test `src/lib/buildInput.test.ts`

**Interfaces:**

- Produces: `ruleValueType(engine, valueType?: string): RuleValueType`; `normaliseValue(value: string | undefined, valueType?: string): string | null`; `toLocalDate(engine, value?: string): RuleLocalDate | null` (never throws); `toInstant(engine, value?: string): RuleInstant | null`; `buildEngineInput(engine, context, input): { event: RuleEventJs; enrollment: RuleEnrollmentJs | null; otherEvents: RuleEventJs[] }`. `context` needs only `stageNames: Map<stageId, name>`, `valueTypes: Map<fieldId, valueType>` and `programName` (internal fields on `RuleContext`).

- [ ] **Step 1: Write the failing tests** (one per spike §4 pitfall that lives in input mapping; tests use the real engine module):
    - pitfall 1: `occurredAt: '2026-03-12T12:05:00.000'` → `eventDate.toString() === '2026-03-12'`; `createdAt` without offset parses (gets `Z`); a DATETIME value `'2026-03-12T10:00'` through a DATE-typed field becomes `'2026-03-12'`; AGE likewise;
    - Review Focus 1: `occurredAt: '2026-1'` and a DATE value `'2026-1'` → event date `null`, value dropped, no throw;
    - pitfall 2: `dataValues: { a: '', b: 'x' }` and attributes `{ c: '' }` → only `b` reaches the engine;
    - pitfall 9: `ruleValueType` maps NUMBER/INTEGER*/PERCENTAGE/UNIT_INTERVAL → NUMERIC, BOOLEAN/TRUE_ONLY → BOOLEAN, DATE/DATETIME/AGE → DATE, else TEXT;
    - pitfall 11: `otherEvents` containing the current event id is filtered out;
    - unknown status → ACTIVE; missing enrollment → `null`; `occurredAt` missing on enrollment falls back to `enrolledAt`.
- [ ] **Step 2:** Run → FAIL. **Step 3:** Implement, porting `adapter.ts`'s `buildEvent`/`buildEnrollment`/`normaliseValue`; wrap `RuleLocalDate.parse` in better-result `Result.try` and map failure to `null`; validate a date string with `/^\d{4}-\d{2}-\d{2}/` before cutting to 10 chars. **Step 4:** Run → PASS. Commit `feat: map event rule input to rule engine objects`.

### Task 4: Context build, validation and dependency graph

**Files:** Create `src/lib/buildContext.ts`, `src/lib/dependencyGraph.ts`, Test `src/lib/buildContext.test.ts`, `src/lib/dependencyGraph.test.ts`, test helper `test/rmnch.ts`

**Interfaces:**

- Consumes: `scanExpression` (Task 2), `ruleValueType`/`normaliseValue` (Task 3).
- Produces: `buildRuleContext(engine, metadata): RuleContext` as in Public API; `buildDependencyGraph(rules: OrderedRule[], variables): { graph: RuleDependencyGraph; actionReads: Map<actionId, string[]> }` where `OrderedRule` is the metadata rule with invalid parts removed, in evaluation order. `test/rmnch.ts` exports `rmnchMetadata(): ProgramRulesMetadata` (built with Task 5's `parseProgramRulesMetadata` once it exists; until then a local mapping) and `rmnchInput(values?: Record<string, string | null>): EventRuleInput` (current event `Evahwp3zrQ4`, its enrollment and 7 other events).

- [ ] **Step 1: Write the failing context tests** (spike §4 pitfalls that live in the context):
    - pitfall 3: RMNCH `invalidRules` has exactly the 3 `!==` rules (`ruleId`, `ruleName`, `expression` = condition, `message` starting `expected name`), and `context.rules` has 15 rules;
    - an action with `data: 'd2:unknownFn(1)'` yields an `InvalidRule` with `actionId`, and its rule stays with its other actions;
    - type-check-only failures (`!#{chronicconditions}`, `d2:weeksBetween(#{lmp},V{event_date})`) are **not** invalid;
    - pitfall 4: a variable whose `displayName` differs from `name` is registered under `name` (evaluate a rule on `#{name}`);
    - pitfall 5: `useCodeForOptionSet: false` makes `#{v}` the option name; `true` the code;
    - pitfall 6: constants `{ id: 'Gfd3ppDfq8E', value: 5.0 }` → `C{Gfd3ppDfq8E} == 5` true;
    - pitfall 7: an ASSIGN with `content: '#{a}'` and `dataElementId` equal to `a`'s backing field yields one content action; with a different field, a content and a field action, both carrying `id` and `ruleId` in `values`;
    - pitfall 8: every converted action has `attributeType` (`DATA_ELEMENT`, `TRACKED_ENTITY_ATTRIBUTE` or `UNKNOWN`);
    - pitfall 10: `orgUnitGroups: [{ id: 'g1', code: 'MCHP', orgUnitIds: ['ou1'] }]` → `d2:inOrgUnitGroup('MCHP')` and `('g1')` both true for an event at `ou1`;
    - requirements: RMNCH → `{ enrollment: true, otherEvents: true, orgUnitGroups: [] }`; a program with one `#{x} > 1` rule on a `DATAELEMENT_CURRENT_EVENT` variable → `{ enrollment: false, otherEvents: false, orgUnitGroups: [] }`; `d2:inOrgUnitGroup('MCHP')` → `orgUnitGroups: ['MCHP']`.
- [ ] **Step 2: Write the failing graph tests**:
    - RMNCH "Hide all fields for chronic conditions": `readsVariables ['chronicconditions']`, `readsFields ['de0FEHSIoxh']`, `writesFields` = the 6 follow-ups;
    - "Calculate gestational age": `readsFields ['w4ky6EkVahL']`, `readsProgramVariables ['event_date']`, `writesFields ['roKuXYfw1BW']`;
    - chain: rule A (priority 1) assigns `#{calc}` (CALCULATED_VALUE) from `#{lmp}`; rule B (priority 2) reads `#{calc}` → B's `readsFields` includes lmp's field; with B at priority 0 it does not;
    - `fieldReaders.get('de0FEHSIoxh')` contains the chronic rule; `fieldWriters.get('roKuXYfw1BW')` contains the gestational-age rule.
- [ ] **Step 3:** Run → FAIL. **Step 4:** Implement. Order rules by `priority ?? Infinity`, stable. Validate each condition with `validate` and each action `data` with `validateDataFieldExpression` against a store of every variable name (`DataItemJs(name, itemValueType)`); invalid iff `!valid && !/^\d+ error\(s\), \d+ warning\(s\)$/.test(errorMessage)`. Convert actions as in the spike's `buildActions`, adding `ruleId`/`id` to `values`. `requirements.enrollment = needsEnrollment || needsAttributes`, `otherEvents = needsAllEvents` from `analyzeContextRequirements`. Attribution objects are built once here and reused by every evaluation. **Step 5:** Run → PASS. Commit `feat: build the rule context with validation and a dependency graph`.

### Task 5: Evaluation and effect normalisation

**Files:** Create `src/lib/evaluate.ts`, Test `src/lib/evaluate.test.ts`; finish `src/lib/index.ts`

**Interfaces:**

- Consumes: `buildEngineInput` (Task 3), `RuleContext` (Task 4).
- Produces: `evaluateEventRules`, `explainField` per Public API.

- [ ] **Step 1: Write the failing tests** on RMNCH via `rmnchInput`:
    - chronic `'false'` → `hiddenFields` has the 6 follow-ups, each `[{ ruleId, ruleName, actionId, condition: '!#{chronicconditions}', readsFields: ['de0FEHSIoxh'] }]`; `'true'` → none of them;
    - LMP `'2026-01-01'` → `assignedValues.get('roKuXYfw1BW')` = `{ value: '10', by.ruleId: 'KRMEVVbex0q' }`;
    - LMP `'2026-04-01'` → `messages.get('w4ky6EkVahL')` contains `{ kind: 'error', text: 'LMP date entered is after the date of the antenatal care visit.' }` (text = `displayContent` and evaluated `data` joined by a space, trimmed);
    - no LMP → no assignment, no LMP error;
    - baseline → `hiddenProgramStages` has the postpartum stage `bbKtnxRZKEP`; DISPLAYTEXT and DISPLAYKEYVALUEPAIR land in `displayTexts`/`keyValuePairs` with `location` defaulting to `'feedback'`;
    - synthetic context: HIDESECTION, SETMANDATORYFIELD, HIDEOPTION (code from `option.code`), HIDEOPTIONGROUP/SHOWOPTIONGROUP, WARNINGONCOMPLETE/ERRORONCOMPLETE, a message without a field → key `'form'`, and SENDMESSAGE ignored;
    - Review Focus 2: a context with a rule on `#{nope}` and a valid HIDEFIELD rule still returns the HIDEFIELD;
    - attribution identity: two evaluations return the same `Attribution` object for the same action;
    - `explainField(effects, 'w4ky6EkVahL')` returns the error's attribution once, deduplicated by `actionId`.
- [ ] **Step 2:** Run → FAIL. **Step 3:** Implement. Create one `RuleEngineJs` per context (stored as an opaque handle). Map each `RuleEffectJs` by `values.get('id')` to the context's `Attribution`; skip effects with no known action. Later ASSIGNs to the same field overwrite earlier ones. **Step 4:** Run → PASS. Commit `feat: evaluate event rules into attributed effects`.

### Task 6: The `useProgramRules` hook

**Files:** Create `src/hooks/{loadRuleEngine.ts,client.ts,metadata.ts,enrollment.ts,queryKeys.ts,inputKey.ts,useProgramRules.ts}`, finish `src/hooks/index.ts`; Test `src/hooks/metadata.test.ts`, `src/hooks/inputKey.test.ts` (node), `src/hooks/useProgramRules.test.tsx` (browser)

**Interfaces:**

- Consumes: the lib through `@/registry/dhis2/lib/program-rules`.
- Produces: Public API hook section. Internals: `parseProgramRulesMetadata(raw: { rules, variables, constants, program, me }): ProgramRulesMetadata` (zod; also used by `test/rmnch.ts`), `fetchProgramRulesMetadata(client, programId, signal)`, `fetchOrgUnitGroups(client, idsOrCodes, signal)`, `fetchRuleEnrollment(client, enrollmentId, { events: boolean }, signal): { enrollment: RuleEnrollmentInput; events: RuleEventInput[] }`, `inputContentKey(input: ProgramRulesInput): string`.

Requests (one `engine.query` for the first five, run in parallel by app-runtime):

- `programRules?filter=program.id:eq:<id>&paging=false&fields=id,name,displayName,condition,priority,programStage[id],programRuleActions[id,programRuleActionType,content,displayContent,data,location,dataElement[id],trackedEntityAttribute[id],programStageSection[id],programStage[id],option[id,code],optionGroup[id,options[code]]]`
- `programRuleVariables?filter=program.id:eq:<id>&paging=false&fields=id,name,programRuleVariableSourceType,useCodeForOptionSet,valueType,programStage[id],dataElement[id,valueType,optionSet[id,options[code,name]]],trackedEntityAttribute[id,valueType,optionSet[id,options[code,name]]]`
- `constants?paging=false&fields=id,value`
- `programs/<id>?fields=id,name,programStages[id,name]`
- `me?fields=userRoles[id],userGroups[id]`
- only if `requirements.orgUnitGroups` is non-empty: `organisationUnitGroups?paging=false&rootJunction=OR&filter=id:in:[…]&filter=code:in:[…]&fields=id,code,organisationUnits[id]`
- only if needed and not passed: `tracker/enrollments/<enrollmentId>?fields=enrollment,status,enrolledAt,occurredAt,orgUnit,attributes[attribute,value]` plus `,events[event,programStage,status,occurredAt,scheduledAt,createdAt,completedAt,orgUnit,dataValues[dataElement,value]]` when `otherEvents` is needed.

- [ ] **Step 1: Write the failing node tests:** `parseProgramRulesMetadata` on the RMNCH fixture (with option sets inlined into the variables) gives 18 rules, 29-ish variables (assert the fixture's exact count), option sets deduplicated, `user.roleIds` length 13; a payload missing `programRuleActionType` throws a `ZodError`; `inputContentKey` is equal for inputs that differ only in key order and differs when one value changes.
- [ ] **Step 2: Write the failing browser tests** with `renderHook` from `vitest-browser-react`, a `QueryClientProvider` (retry off) and app-runtime's `CustomDataProvider` serving the RMNCH fixture per resource, counting requests per resource:
    - RMNCH with `enrollmentId` and no `input.enrollment` → `loading` then `ready`; chronic `'false'` hides the 6 follow-ups; one `tracker/enrollments` request; `explain('xPTngRLQTnu')` names the chronic rule; `invalidRules.length === 3`;
    - host passes `input.enrollment` and `otherEvents` → no `tracker/enrollments` request;
    - Review Focus 3: zero rules → `ready`, empty effects, no enrollment request;
    - Review Focus 4: rules need the enrollment but no `enrollmentId` → `ready`, no request;
    - Review Focus 5: rerender with a structurally equal new `input` object → same `effects` object;
    - `programRules` resource responds with an error → `status: 'error'`, `error` set;
    - `enabled: false` → `loading`, no requests.
- [ ] **Step 3:** Run → FAIL. **Step 4:** Implement. `loadRuleEngine` caches `import('@dhis2/rule-engine')` in a module-level promise and clears it on rejection. The engine is a `useQuery` (`staleTime/gcTime: Infinity`) started on mount, in parallel with the metadata query (`staleTime` 1 h, `retry` as working-list's `shouldRetry…`). Context = `useMemo(Result.try(() => buildRuleContext(engine, filteredMetadata)))`, where rules are filtered to `!programStageId || === programStageId`; rebuilt once org unit groups arrive. Evaluation = `useMemo` keyed on `[context, inputContentKey(input), fetched enrollment data]`, also via `Result.try`. `status` is `error` if any query or `Result` failed, `ready` when effects exist, else `loading`. **Step 5:** Run → PASS. Commit `feat: add the useProgramRules hook`.

### Task 7: Docs, full verification, install check

**Files:** Modify `packages/blocks/program-rules/README.md`, `type-tests/public-surface.ts`

- [ ] **Step 1:** README: what each item does, the exact Public API, install layout and in-repo specifiers, the validation decision, limits (runtime coercion errors only in the console; `d2:inOrgUnitGroup(#{var})` with a dynamic group is not prefetched; no pruning).
- [ ] **Step 2:** Run `pnpm typecheck && pnpm lint && pnpm dead-code:audit && pnpm test` → all green.
- [ ] **Step 3:** Run `pnpm registry:check` → record which assertions pass; the theme assertion may still fail until the primitives refactor lands.
- [ ] **Step 4:** Commit `docs: document the program-rules items`.
