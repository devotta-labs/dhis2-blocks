# @dhis2-blocks/program-rules

DHIS2 program rules as a pure derivation: `effects = evaluate(context, input)`, using only the official
engine, [`@dhis2/rule-engine`](https://github.com/dhis2/dhis2-rule-engine). Two shadcn registry items:

| Item                | Type            | Entry                                           | What it does                                                                                                     |
| ------------------- | --------------- | ----------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| `program-rules`     | `registry:lib`  | `components/program-rules/index.ts`             | Metadata → engine context, evaluation of one event, attributed effects, dependency graph. No React, no fetching. |
| `use-program-rules` | `registry:hook` | `components/program-rules/use-program-rules.ts` | `useProgramRules(...)`: fetches metadata and context data with React Query, lazy-loads the engine, memoises.     |

Both install into `components/program-rules/` (lib internals in `lib/`, hook internals in `hooks/`), so the
hook reaches the lib with relative imports. The hook needs a React Query `QueryClientProvider` and the DHIS2
app-runtime provider above it, nothing else.

```sh
npx shadcn@latest add devotta-labs/dhis2-blocks/use-program-rules   # pulls program-rules too
```

## In this repo

The lib's entry is `src/index.ts` (internals in `src/lib/`); the hook's entry is `src/use-program-rules.ts`
(internals in `src/hooks/`). Files target `@components/program-rules/<path under src>`. The shadcn installer
rewrites a registry import (`@/registry/...`) to the installed file by file name, so another block must import
program rules with a specifier whose file name is unique among the installed items:

| Specifier                                    | Resolves to (repo)                                       | Use from another block                                                  |
| -------------------------------------------- | -------------------------------------------------------- | ----------------------------------------------------------------------- |
| `@/registry/program-rules/use-program-rules` | `packages/blocks/program-rules/src/use-program-rules.ts` | Yes. It also re-exports the lib types a hook consumer reads.            |
| `@/registry/program-rules/index`             | `packages/blocks/program-rules/src/index.ts`             | No. Every item has an `index.ts`, so the installer picks the wrong one. |

A consuming package maps `@/registry/program-rules/*` to `packages/blocks/program-rules/src/*` with a
TypeScript `paths` entry and a Vite/Vitest `resolve.alias`. Inside this package imports are relative.

## Lib API

```ts
buildRuleContext(engine: RuleEngineModule, metadata: ProgramRulesMetadata): RuleContext
evaluateEventRules(engine: RuleEngineModule, context: RuleContext, input: EventRuleInput): RuleEffects
explainField(effects: RuleEffects, fieldId: string): Attribution[]
```

`engine` is the `@dhis2/rule-engine` module itself. The lib only imports its types, so the ~214 KB (gzip)
engine never enters an initial bundle. Build the context once per program and stage; evaluation is pure and
synchronous.

The exact types are in [`src/lib/types.ts`](src/lib/types.ts) (exported from `src/index.ts`). The ones a form reads:

```ts
interface EventRuleInput {
    event: RuleEventInput
    enrollment?: RuleEnrollmentInput
    otherEvents: ReadonlyArray<RuleEventInput> // the current event is ignored if present
}
interface RuleEventInput {
    id: string
    programStageId: string
    occurredAt?: string
    scheduledAt?: string
    createdAt?: string
    completedAt?: string
    orgUnitId: string
    orgUnitCode?: string
    status:
        'ACTIVE' | 'COMPLETED' | 'SCHEDULE' | 'SKIPPED' | 'VISITED' | 'OVERDUE'
    dataValues: Record<string, string> // dataElementId → tracker API value, empty values omitted
}
interface RuleEnrollmentInput {
    id: string
    enrolledAt: string
    occurredAt?: string
    orgUnitId: string
    orgUnitCode?: string
    status?: 'ACTIVE' | 'COMPLETED' | 'CANCELLED'
    attributes: Record<string, string> // attributeId → value
}

interface Attribution {
    ruleId: string
    ruleName: string
    actionId: string
    condition: string
    readsFields: string[] // fields the condition and action read, through variables and earlier ASSIGNs
}
interface RuleMessage {
    kind: 'error' | 'warning' | 'errorOnComplete' | 'warningOnComplete'
    text: string
    by: Attribution
}
interface RuleDisplayItem {
    location: 'feedback' | 'indicators'
    label: string // the action's content (the key of a key-value pair)
    value: string // the evaluated data expression, '' when there is none
    by: Attribution
}
interface RuleEffects {
    hiddenFields: Map<string, Attribution[]>
    hiddenSections: Map<string, Attribution[]>
    mandatoryFields: Map<string, Attribution[]>
    assignedValues: Map<string, { value: string | null; by: Attribution }>
    messages: Map<string, RuleMessage[]> // fieldId, or 'form' for messages without a field
    hiddenOptions: Map<string, Set<string>> // fieldId → option codes
    optionGroups: Map<string, { hidden: Set<string>; shown: Set<string> }> // fieldId → option group ids
    displayTexts: RuleDisplayItem[]
    keyValuePairs: RuleDisplayItem[]
    hiddenProgramStages: Set<string>
    optionAttributions: Map<string, Attribution[]> // fieldId → the actions behind hiddenOptions/optionGroups
    programStageAttributions: Map<string, Attribution[]> // stageId → the actions that hid it
}
```

`RuleContext` also carries `invalidRules: InvalidRule[]` (`{ ruleId, ruleName, actionId?, expression, message }`),
the dependency `graph`, the data `requirements` (`{ enrollment, otherEvents, orgUnitGroups }`) and
`optionGroupOptions` (`Map<optionGroupId, Set<optionCode>>`).

## Hook API

```ts
useProgramRules({
    programId: string,
    programStageId: string,
    enrollmentId?: string,
    input: { event: RuleEventInput; enrollment?: RuleEnrollmentInput; otherEvents?: ReadonlyArray<RuleEventInput> },
    enabled?: boolean,
}): {
    status: 'loading' | 'ready' | 'error'
    effects?: RuleEffects
    invalidRules: InvalidRule[]
    explain(fieldId: string): Attribution[]
    error?: Error
    graph?: RuleDependencyGraph
    optionGroupOptions: Map<string, Set<string>>
}
useProgramRuleContext({ programId: string, programStageId: string, enabled?: boolean }): {
    status: 'loading' | 'ready' | 'error'
    metadata?: ProgramRulesMetadata // rules limited to the stage
    context?: RuleContext // graph, invalidRules, requirements; no event needed
    error?: Error
}
loadRuleEngine(): Promise<RuleEngineModule> // preload the engine earlier if you like
programRulesQueryKeys // React Query keys for invalidation
```

How the hook behaves:

- On mount it starts `import('@dhis2/rule-engine')` (once per app) and, in parallel, one app-runtime query for
  rules, variables (with their option sets), constants, program stages and the user's roles and groups.
- Rules for other program stages are dropped before the context is built.
- `useProgramRuleContext` is the same fetching and context build without an event, for tools that inspect a
  stage's rules (its dependency graph, invalid rules, data requirements). It shares its queries with
  `useProgramRules`.
- It fetches the org unit groups named by `d2:inOrgUnitGroup(...)`, and `tracker/enrollments/{id}` (with events
  only when the rules read other events) only when the rules need them and `input` doesn't carry them.
- Evaluation runs again only when the **content** of `input` changes. Pass committed values (on blur, or on
  change for selects and dates), not every keystroke.
- **After saving an event, invalidate `programRulesQueryKeys.enrollment(enrollmentId)`** (the prefix of both
  cached forms). Otherwise the next event opened within a minute is evaluated against the old `otherEvents`.
- A failed background refetch keeps the last good data and `status: 'ready'`; `error` is reported only when a
  needed request has nothing to show. The engine module is held outside React Query's cache, so a persisted
  query cache can't restore it as an empty object.
- `status` is `loading` until effects exist (also while `enabled` is `false`, when nothing is fetched), and
  `error` when a request, the context build or evaluation fails.

## Behaviour worth knowing

- **Invalid rules.** Each condition and action expression is checked once with the engine's own parser when the
  context is built. Expressions it cannot parse are left out of evaluation and listed in `invalidRules`: a bad
  condition removes its rule, a bad action expression only that action, which is what the engine does at
  runtime. `engine.validate()` also type-checks, but that check rejects expressions the engine evaluates fine
  (`!#{bool}`, `d2:weeksBetween(#{date}, V{event_date})`), so type-check findings are ignored. On the RMNCH
  demo program this lists the 3 rules that use `!==`.
- **Errors at evaluation time** (a value that fails to coerce, an unknown variable) still only show up in the
  console: the engine logs them and skips the rule. They are not in `invalidRules`.
- **Input mapping.** Dates and timestamps are cut to `yyyy-MM-dd`, timestamps without an offset are read as
  UTC, half-typed dates count as missing, empty values are left out, and the current event is dropped from
  `otherEvents`. `DATAELEMENT_NEWEST_EVENT_PROGRAM` takes the newest event by date, so editing an older event
  doesn't change it when a newer event has a value. That is DHIS2 behaviour.
- **Attribution.** `readsFields` follows variables and ASSIGN chains in evaluation order (priority ascending,
  rules without priority last): an ASSIGN feeds only rules evaluated after it, as in the engine.
- **Not covered.** No pruned re-evaluation (full evaluation of RMNCH takes about 5 ms at 4× CPU throttle).
  `d2:inOrgUnitGroup(#{var})` with a group computed at runtime is not prefetched. Server-side actions (send or
  schedule message, create event) produce no effect.

## Differences from Capture

[`captureParity.test.ts`](../event-form/src/model/captureParity.test.ts) runs RMNCH visits, small synthetic programs
and the large generated program through this lib with Event Form's overlay and two passes, and through a
re-implementation of how DHIS2 Capture (capture-app `c40f022`) turns the same engine's effects into form state. Rule
conversion and engine input are shared, so only what happens after the engine is compared. The two agree on every RMNCH
case (including the stored visit's two-step hide chain), `DATAELEMENT_NEWEST_EVENT_PROGRAM`, ASSIGN chains across
priorities, hidden sections and option filtering. They also agree on ASSIGN: an ASSIGN into a hidden field is saved and
the field stays hidden, an ASSIGN of a code outside the field's option set (for `MULTI_TEXT`, any part outside it)
clears the field, and an ASSIGN to a data element outside the stage is dropped.

Capture runs the rules once per field change. It writes every ASSIGN into the form values and blanks each HIDEFIELD
target with a `null` ASSIGN. It never re-runs on its own writes, so it settles only over later changes, and a value it
cleared stays cleared even when the field shows again. Event Form runs exactly two passes and never writes stored
values. Each difference is an `it.fails` case in
[`captureParity.differences.test.ts`](../event-form/src/model/captureParity.differences.test.ts):

| Case                                                         | Capture                                                              | Event Form                                                    | Who is right                                                                         |
| ------------------------------------------------------------ | -------------------------------------------------------------------- | ------------------------------------------------------------- | ------------------------------------------------------------------------------------ |
| Hide chain three fields deep                                 | Hides and clears the third field, one run per change                 | Stops after two passes; the third field stays, with its value | Capture                                                                              |
| Mutual hide (A hides B, B hides A, both answered)            | Shows both, empty                                                    | Shows both with their answers, which would hide each other    | Capture is consistent; Event Form shows values its effects were not computed from    |
| HIDEFIELD on a compulsory field, or with SETMANDATORYFIELD   | Keeps it visible and required (and blanks it on every run)           | Hides it, and it is no longer required                        | Capture keeps the field reachable; its blanking is not worth copying                 |
| SHOWERROR or ERRORONCOMPLETE on a hidden field               | Blocks validation; the completion dialog lists the error on complete | Dropped with the field                                        | A trade-off: Event Form is easier to use, Capture closer to what the server enforces |
| ASSIGN of a number the engine writes as `03` or `5.0`        | Normalised by value type (`3`, `5`)                                  | Saved as written                                              | Capture, though both are valid numbers                                               |
| HIDEOPTION of the chosen option                              | Removed from the list; the value stays                               | Kept in the list                                              | Event Form, on purpose: the field never looks blank while it holds a value           |
| Right after a change (a chain that needs the cleared values) | Shows effects computed before its own clears until the next change   | Shows both passes' result at once                             | Event Form                                                                           |
