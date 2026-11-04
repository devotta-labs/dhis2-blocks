import { z } from 'zod'
import type * as Engine from '@dhis2/rule-engine'
import type {
    EventRuleInput,
    ProgramRulesMetadata,
    RuleEnrollmentInput,
    RuleEventInput,
} from './types'

export type CustomRuleScalar = string | number | boolean | null
export const RuleContextDataSchema = z.record(z.string(), z.json())
export type RuleContextData = z.infer<typeof RuleContextDataSchema>
const ScalarSchema = z.union([
    z.string(),
    z.number().finite(),
    z.boolean(),
    z.null(),
])
const ReturnTypeSchema = z.enum(['number', 'string', 'boolean'])
const ReturnSchemas = {
    number: z.number().finite().nullable(),
    string: z.string().nullable(),
    boolean: z.boolean().nullable(),
}
export type CustomRuleReturnType = 'number' | 'string' | 'boolean'
type ReturnValue<T extends CustomRuleReturnType> =
    | { number: number; string: string; boolean: boolean }[T]
    | null

export interface TrackedEntityRuleContext {
    trackedEntity?: Readonly<{
        id: string
        attributes: Readonly<Record<string, string>>
        data: Readonly<RuleContextData>
    }>
    enrollments: ReadonlyArray<RuleEnrollmentInput>
    events: ReadonlyArray<RuleEventInput>
    currentEvent: RuleEventInput
    program: ProgramRulesMetadata
    metadata: Readonly<RuleContextData>
    orgUnits?: ReadonlyArray<Readonly<RuleContextData>>
}

export interface CustomRuleFunction {
    returns: CustomRuleReturnType
    invoke(
        props: Readonly<Record<string, CustomRuleScalar>>,
        context: TrackedEntityRuleContext
    ): CustomRuleScalar
}

export type CustomRuleFunctions = Readonly<Record<string, CustomRuleFunction>>

/** App-shipped synchronous TypeScript; object schemas always reject unknown props. */
export const defineCustomRuleFunction = <
    // oxlint-disable-next-line anti-slop/no-shape-in-symbol-names -- Upstream Zod type name.
    Props extends z.ZodRawShape,
    T extends CustomRuleReturnType,
>({
    props,
    returns,
    evaluate,
}: {
    props: z.ZodObject<Props>
    returns: T
    evaluate: (
        props: z.output<z.ZodObject<Props>>,
        context: TrackedEntityRuleContext
    ) => ReturnValue<T>
}): CustomRuleFunction => ({
    returns,
    invoke: (input, context) => evaluate(props.strict().parse(input), context),
})

export interface CustomRuleEvaluation {
    functions: CustomRuleFunctions
    context: TrackedEntityRuleContext
}

export const overlayCustomRuleEvent = (
    snapshot: RuleEventInput,
    live: RuleEventInput
): RuleEventInput => {
    const dataValues = { ...snapshot.dataValues, ...live.dataValues }
    for (const id of live.liveDataElementIds ?? []) {
        if (live.dataValues[id] === undefined) delete dataValues[id]
    }
    return {
        ...snapshot,
        ...live,
        dataValues,
    }
}

export const customRuleCallback = (
    custom: CustomRuleEvaluation,
    input: EventRuleInput
) => {
    const liveEvents = new Map(
        [...input.otherEvents, input.event].map((event) => [event.id, event])
    )
    const knownIds = new Set(custom.context.events.map((event) => event.id))
    const events = [
        ...custom.context.events.map((event) => {
            const live = liveEvents.get(event.id)
            return live === undefined
                ? event
                : overlayCustomRuleEvent(event, live)
        }),
        ...[...liveEvents.values()].filter((event) => !knownIds.has(event.id)),
    ]
    const context: TrackedEntityRuleContext = {
        ...custom.context,
        currentEvent:
            events.find((event) => event.id === input.event.id) ?? input.event,
        events,
    }
    return (
        type: string,
        name: string,
        entries: Parameters<
            NonNullable<Engine.RuleEngineContextJs['customFunction']>
        >[2]
    ): CustomRuleScalar => {
        if (!Object.hasOwn(custom.functions, name)) {
            throw new Error(`Custom function not registered: ${name}`)
        }
        const fn = custom.functions[name]
        const returnType = ReturnTypeSchema.parse(type)
        if (fn.returns !== type) {
            throw new Error(`${name} returns ${fn.returns}, not ${type}`)
        }
        const props = z
            .record(z.string(), ScalarSchema)
            .parse(Object.fromEntries(entries))
        const result = fn.invoke(Object.freeze(props), context)
        return ReturnSchemas[returnType].parse(result)
    }
}
