# Program Rules

DHIS2 program rules as a pure derivation: `effects = evaluate(context, input)`, using only the official
engine, [`@dhis2/rule-engine`](https://github.com/dhis2/dhis2-rule-engine). The block has a lib (metadata → engine
context, evaluation of one event, attributed effects, dependency graph; no React, no fetching) and the hooks on top of
it (fetching with React Query, lazy-loading the engine, memoising). Everything installs into
`components/program-rules/` (lib internals in `lib/`, hook internals in `hooks/`) and is imported from
`@/components/program-rules`. The hooks need a React Query `QueryClientProvider` and the DHIS2 app-runtime provider
above them, nothing else.

```sh
pnpm dlx shadcn@latest add devotta-labs/dhis2-blocks/program-rules
```

## Lib API

```ts
buildRuleContext(engine: RuleEngineModule, metadata: ProgramRulesMetadata): RuleContext
evaluateEventRules(engine: RuleEngineModule, context: RuleContext, input: EventRuleInput): RuleEffects
explainField(effects: RuleEffects, fieldId: string): Attribution[]
emptyEffects(): RuleEffects // effects with nothing in them
scanExpression(expression: string): ExpressionReferences // names read, deduplicated, by kind
expressionReferences(expression: string): ExpressionReference[] // every reference with its span, in order
assignedVariable(action: ProgramRuleActionMetadata): string | undefined // the variable an ASSIGN writes
```

`engine` is the `@dhis2/rule-engine` module itself. The lib only imports its types, so the ~214 KB (gzip)
engine never enters an initial bundle. Build the context once per program and stage; evaluation is pure and
synchronous.

`expressionReferences` is the one reading of expression syntax the lib has: the dependency graph is built from
it, and a test checks it against the engine's own parser on real and generated metadata. Anything that shows or
analyses expressions (a condition display, a graph view) should use it rather than a regex of its own.

The exact types are in [`lib/types.ts`](lib/types.ts) (exported from `@/components/program-rules`). The ones a form reads:

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
useProgramRuleEvaluator({
    programId: string,
    programStageId: string,
    enrollmentId?: string,
    enrollment?: RuleEnrollmentInput,
    otherEvents?: ReadonlyArray<RuleEventInput>,
    enabled?: boolean,
}): {
    status: 'loading' | 'ready' | 'error'
    evaluate?(event: RuleEventInput): Result<RuleEffects, Error> // memoised on the event's content
    invalidRules: InvalidRule[]
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
- `useProgramRules` is `useProgramRuleEvaluator` run on one event. Use the evaluator to evaluate several
  events, or one event several times (for example a two-pass form), against a single context: `evaluate` keeps
  its last few results by event content, so a repeated event returns the same result object.
- It fetches the org unit groups named by `d2:inOrgUnitGroup(...)`, and `tracker/enrollments/{id}` (with events
  only when the rules read other events) only when the rules need them and `input` doesn't carry them.
- Evaluation runs again only when the **content** of `input` changes. Pass committed values (on blur, or on
  change for selects and dates), not every keystroke.
- **After saving an event, invalidate `programRulesQueryKeys.enrollment(enrollmentId)`** (the prefix of both
  cached forms). Otherwise the next event opened within a minute is evaluated against stale `otherEvents`.
- A failed background refetch keeps the last good data and `status: 'ready'`; `error` is reported only when a
  needed request has nothing to show. The engine module is held outside React Query's cache, so a persisted
  query cache can't restore it as an empty object.
- `status` is `loading` until effects exist (also while `enabled` is `false`, when nothing is fetched), and
  `error` when a request, the context build or evaluation fails.

## Many events

`useEventsRules` is for a grid with one row per event: any number of rows across stages, evaluated on the grid's live
values. It loads the rule metadata and, for a program with rules, the engine, a rule context for each stage and, for a
tracker program whose rules read the enrollment or other events, every person in one batched request.

```ts
useEventsRules({
    programId: string,
    programStageIds: ReadonlyArray<string>, // the stages the rows belong to
    tracker: boolean, // WITH_REGISTRATION programs; false evaluates every row alone
    enrollmentIds: ReadonlyArray<string>, // the people the rows belong to
    enabled?: boolean,
}): {
    status: 'loading' | 'ready' | 'error'
    rules?: {
        evaluate(
            rows: ReadonlyArray<EventsRuleRow>,
            rowIds: ReadonlyArray<string>
        ): { effects: Map<string, RuleEffects>; failures: Map<string, Error> } // rowId → effects, rowId → why it failed
        rowsAffectedBy(rows: ReadonlyArray<EventsRuleRow>, rowId: string, fieldId: string): string[]
        invalidRules: InvalidRule[]
        optionGroupOptions: Map<string, Set<string>> // optionGroupId → option codes, across every stage
    }
    error?: Error
}
interface EventsRuleRow {
    event: RuleEventInput // the grid's live values, empty values left out
    enrollmentId?: string // tracker programs only
}
```

```tsx
const { rules } = useEventsRules({
    programId,
    programStageIds: [...new Set(rows.map((row) => row.event.programStageId))],
    tracker: true,
    enrollmentIds: rows.flatMap((row) => row.enrollmentId ?? []),
})

// Every row, once the rules have loaded. `effects`: rowId → effects; `failures`: rowId → Error.
const evaluation = rules?.evaluate(
    rows,
    rows.map((row) => row.event.id)
)

// After a value changed, only the rows it can change.
const stale = rules?.rowsAffectedBy(rows, rowId, fieldId) ?? [rowId]
const fresh = rules?.evaluate(rows, stale)
```

- `evaluate` runs each requested row on its own: a row the engine fails on is in `failures` with its `Error`, and every
  other row still gets its `effects`. A requested row in neither map was not evaluated: it is not in `rows`, its stage
  was not passed in `programStageIds`, or its person is still loading. That is different from an entry with no
  effects. A tracker row sees its person's other events: the server's, each replaced by its live row, plus the live
  rows the server lacks (unsaved ones). The row itself is never one of its own `otherEvents`.
- `rowsAffectedBy` returns the row itself and, when the field is one that other events' rules read (a newest-event or
  previous-event variable), the person's other rows. It covers data value edits. When a row's event date changes, or a
  row is added or removed, re-evaluate every row of that person: which event is newest or previous changes. A deleted
  event stays in the cached person data until that cache is invalidated (below).
- Event-program rows are always evaluated alone: their events share one hidden enrollment, so `rowsAffectedBy` returns
  only the row, and no person is fetched.
- Every person is read in one `tracker/enrollments` request (in batches of 100 for more people), with their events
  only when the rules read other events. Duplicate ids are fetched once. A person the server omits is evaluated
  without enrollment data.
- Saving a grid row needs no invalidation: live rows already replace the server's copies. After deleting an event, or
  when a person's events change outside the grid's rows, invalidate the batched person cache, which is keyed apart
  from `programRulesQueryKeys.enrollment`:
  `queryClient.invalidateQueries({ queryKey: [...programRulesQueryKeys.all, 'enrollments'] })`.
- `rules` changes only when the stages, `tracker`, the rule metadata, the org unit groups or the people's data
  actually change; an equal refetch keeps the same object, so it can be an effect dependency.
- When `enrollmentIds` gain a person, `rules` stays defined and `status` stays `ready` while that person loads (the
  people already loaded stay in use), and `evaluate` leaves out the rows of a person that has not loaded yet. `rules`
  changes when the person is added and again when they have loaded. A failed fetch reports its `error` as usual.
- `invalidRules` lists each rule the engine cannot parse once, however many stages carry it.
- `optionGroupOptions` maps the option group ids in each row's `optionGroups` effects to their option codes, merged
  across the stages, as `useProgramRules` exposes it for one stage.
- A program without rules never loads the engine or the people: once its metadata has loaded, `rules` is ready and
  `evaluate` gives each requested row in `rows` empty effects.
- It shares its queries, retry policy and status rules with `useProgramRules`: `status` is `loading` until the rules
  exist, a failed background refetch keeps the last good data, and `error` is reported only when a needed request has
  nothing to show.

The lib has the same pieces without React: `crossEventFields(metadata)`, `rowsAffectedBy(rows, crossFields, rowId,
fieldId)` and `evaluateEventsRules(engine, contexts, { rows, persons, tracker }, rowIds)`, which returns the same
`{ effects, failures }`, with `contexts` keyed by stage id and built from `metadataForStage(metadata, stageId)`.

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
