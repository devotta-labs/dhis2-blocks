# @dhis2-blocks/program-rules

DHIS2 program rules as a pure derivation: `effects = evaluate(context, input)`, using only the official
engine, [`@dhis2/rule-engine`](https://github.com/dhis2/dhis2-rule-engine). Two shadcn registry items:

| Item                | Type            | Installs to                | What it does                                                                                                     |
| ------------------- | --------------- | -------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| `program-rules`     | `registry:lib`  | `lib/program-rules/`       | Metadata → engine context, evaluation of one event, attributed effects, dependency graph. No React, no fetching. |
| `use-program-rules` | `registry:hook` | `hooks/use-program-rules/` | `useProgramRules(...)`: fetches metadata and context data with React Query, lazy-loads the engine, memoises.     |

```sh
npx shadcn@latest add devotta-labs/dhis2-blocks/use-program-rules   # pulls program-rules too
```

## In this repo

Source lives in `src/lib` (the lib) and `src/hooks` (the hook). Other blocks import them with the specifiers
the shadcn installer rewrites to the installed location:

| Specifier                                  | Resolves to (repo)   | Installed as                |
| ------------------------------------------ | -------------------- | --------------------------- |
| `@/registry/dhis2/lib/program-rules`       | `src/lib/index.ts`   | `@/lib/program-rules`       |
| `@/registry/dhis2/hooks/use-program-rules` | `src/hooks/index.ts` | `@/hooks/use-program-rules` |

A consuming package maps them with TypeScript `paths` and a Vite/Vitest `resolve.alias`, as
`tsconfig.json` and `vitest.config.ts` here do for the lib.

## Lib API

```ts
buildRuleContext(engine: RuleEngineModule, metadata: ProgramRulesMetadata): RuleContext
evaluateEventRules(engine: RuleEngineModule, context: RuleContext, input: EventRuleInput): RuleEffects
explainField(effects: RuleEffects, fieldId: string): Attribution[]
```

`engine` is the `@dhis2/rule-engine` module itself. The lib only imports its types, so the ~214 KB (gzip)
engine never enters an initial bundle. Build the context once per program and stage; evaluation is pure and
synchronous.

The exact types are in [`src/lib/types.ts`](src/lib/types.ts). The ones a form reads:

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
```
