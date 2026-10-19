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
(internals in `src/hooks/`). Files target `@components/program-rules/<path under src>`. Other blocks import
them with specifiers the shadcn installer rewrites to the installed files:

| Specifier                                    | Resolves to (repo)                                       |
| -------------------------------------------- | -------------------------------------------------------- |
| `@/registry/program-rules/index`             | `packages/blocks/program-rules/src/index.ts`             |
| `@/registry/program-rules/use-program-rules` | `packages/blocks/program-rules/src/use-program-rules.ts` |

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
loadRuleEngine(): Promise<RuleEngineModule> // preload the engine earlier if you like
programRulesQueryKeys // React Query keys, e.g. invalidate programRulesQueryKeys.enrollment(id, true) after a save
```

How the hook behaves:

- On mount it starts `import('@dhis2/rule-engine')` (once per app) and, in parallel, one app-runtime query for
  rules, variables (with their option sets), constants, program stages and the user's roles and groups.
- Rules for other program stages are dropped before the context is built.
- It fetches the org unit groups named by `d2:inOrgUnitGroup(...)`, and `tracker/enrollments/{id}` (with events
  only when the rules read other events) only when the rules need them and `input` doesn't carry them.
- Evaluation runs again only when the **content** of `input` changes. Pass committed values (on blur, or on
  change for selects and dates), not every keystroke.
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
