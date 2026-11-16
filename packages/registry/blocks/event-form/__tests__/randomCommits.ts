import * as engine from '@dhis2/rule-engine'
import { isDeepStrictEqual } from 'node:util'
import { Result } from 'better-result'
import {
    buildRuleContext,
    evaluateEventRules,
    metadataForStage,
    runRules,
    settleRules,
} from '@/components/program-rules'
import type {
    EventRuleInput,
    RuleEffects,
    RuleEventInput,
    RuleOutcome,
    RuleSettled,
} from '@/components/program-rules'
import {
    ProgramRulesResponseSchema,
    toProgramRulesMetadata,
} from '@/components/program-rules/hooks/metadata'
import {
    RMNCH,
    rmnchInput,
    rmnchResponses,
} from '@/components/program-rules/__tests__/rmnch'
import rmnchEnrollment from '@/components/program-rules/__tests__/fixtures/rmnch/enrollment.json'
import rmnchStages from '@/components/tracker-data-entry/sources/__tests__/fixtures/rmnch-program.json'
import {
    CHILD_VISIT,
    CHILD_VISIT_RULES,
    CHILD_VISIT_VARIABLES,
    childVisitProgram,
    SAVED_VISIT,
} from './childVisit'
import { LONG_FORM, longFormProgram } from './longForm'
import { MAX_RUNS } from '../hooks/useFormRules'
import { formReducer, initialFormState, isDirty } from '../lib/formState'
import type { FormState } from '../lib/formState'
import {
    heldEventSchema,
    programSchema,
    sameValues,
    stageFormOf,
} from '../lib/metadata'
import type { HeldEvent, StageForm, Values } from '../lib/metadata'
import { eventPayload } from '../lib/payload'
import { EVENT_DATE } from '../lib/validate'

/**
 * Random commits on real stages, checking after every step that keeping what was entered apart from what the rules
 * make of it holds: the form's settle (skipping and starting warm) matches one from the entered values, saves what it
 * shows, gives a shown field its answer back, and opens what it saved as it was. Reproduce a failure with the seed it
 * prints: `EVENT_FORM_SEED=<seed> EVENT_FORM_SEQUENCES=1` runs that one sequence first. The share of
 * `EVENT_FORM_SEQUENCES` (2,000 by default) each stage gets is in `SETUPS`; each stage has a test file, so they run in
 * parallel.
 */

const TODAY = '2026-11-16'
const SEED = Number(process.env.EVENT_FORM_SEED ?? 20261116)
const SEQUENCES = Number(process.env.EVENT_FORM_SEQUENCES ?? 2000)
const LONGEST = 30

/** mulberry32: small, seeded, the same numbers on every machine. */
const random = (seed: number) => {
    let a = seed >>> 0
    return () => {
        a = (a + 0x6d2b79f5) >>> 0
        let t = a
        t = Math.imul(t ^ (t >>> 15), t | 1)
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296
    }
}
type Random = ReturnType<typeof random>
const pick = <T>(next: Random, items: readonly T[]): T =>
    items[Math.floor(next() * items.length)]

interface Setup {
    name: string
    form: StageForm
    context: ReturnType<typeof buildRuleContext>
    held?: HeldEvent
    orgUnitId: string
    supplement: Omit<EventRuleInput, 'event'>
    /** Fields some rule reads or changes, picked more often. */
    ruled: readonly string[]
}

const setupOf = (
    name: string,
    response: Parameters<typeof ProgramRulesResponseSchema.parse>[0],
    form: StageForm | undefined,
    stageId: string,
    orgUnitId: string,
    held?: HeldEvent,
    supplement: Omit<EventRuleInput, 'event'> = { otherEvents: [] }
): Setup => {
    if (form === undefined) {
        throw new Error(`${name} has no stage ${stageId}`)
    }
    const metadata = metadataForStage(
        toProgramRulesMetadata(ProgramRulesResponseSchema.parse(response)),
        stageId
    )
    const context = buildRuleContext(engine, metadata)
    const ruled = [...form.fields.keys()].filter(
        (id) =>
            context.graph.fieldReaders.has(id) ||
            context.graph.fieldWriters.has(id)
    )
    return { name, form, context, held, orgUnitId, supplement, ruled }
}

const NO_USER = { userRoles: [], userGroups: [] }

/** The lab's chain of three assignments and two hidden fields, on the 60-field long form. */
const LONG_RULES = [
    ['d2:hasValue(#{f001})', 'ASSIGN', 'f003', '#{f001} * 2'],
    ['d2:hasValue(#{f003})', 'ASSIGN', 'f005', '#{f003} + 10'],
    ['d2:hasValue(#{f005})', 'ASSIGN', 'f041', '#{f005}'],
    ['#{f001} > 100', 'HIDEFIELD', 'f007'],
    ["#{f002} == 'skip'", 'HIDEFIELD', 'f004'],
].map(([condition, type, field, data], at) => ({
    id: `testLongRl${at}`,
    name: `Long rule ${at}`,
    condition,
    priority: at,
    programRuleActions: [
        {
            id: `testLongAc${at}`,
            programRuleActionType: type,
            dataElement: { id: field },
            data,
        },
    ],
}))
const longProgram = longFormProgram()
const longFields = longProgram.programStages[0].programStageDataElements

const rmnchProgram = () => {
    const stage = rmnchStages.programStages.find(
        ({ id }) => id === RMNCH.stageId
    )
    return {
        programStages: [
            { ...stage, displayName: 'First antenatal care visit' },
        ],
    }
}

const SETUPS = {
    'Child visit': {
        sequences: 0.35,
        seeds: 0,
        setup: () =>
            setupOf(
                'Child visit',
                {
                    rules: CHILD_VISIT_RULES,
                    variables: CHILD_VISIT_VARIABLES,
                    constants: { constants: [] },
                    program: childVisitProgram(),
                    me: NO_USER,
                },
                stageFormOf(
                    programSchema.parse(childVisitProgram()),
                    CHILD_VISIT.stageId
                ),
                CHILD_VISIT.stageId,
                CHILD_VISIT.orgUnitId,
                heldEventSchema.parse(SAVED_VISIT)
            ),
    },
    'Long form': {
        sequences: 0.4,
        seeds: 1_000_000,
        setup: () =>
            setupOf(
                'Long form',
                {
                    rules: { programRules: LONG_RULES },
                    variables: {
                        programRuleVariables: longFields.map(
                            ({ dataElement: { id, valueType } }) => ({
                                id: `testLongV${id}`,
                                name: id,
                                programRuleVariableSourceType:
                                    'DATAELEMENT_CURRENT_EVENT',
                                dataElement: { id, valueType },
                            })
                        ),
                    },
                    constants: { constants: [] },
                    program: longProgram,
                    me: NO_USER,
                },
                stageFormOf(
                    programSchema.parse(longProgram),
                    LONG_FORM.stageId
                ),
                LONG_FORM.stageId,
                LONG_FORM.orgUnitId
            ),
    },
    'RMNCH First ANC': {
        sequences: 0.25,
        seeds: 2_000_000,
        setup: () => {
            const input = rmnchInput()
            const event = rmnchEnrollment.events.find(
                ({ event }) => event === RMNCH.eventId
            )
            return setupOf(
                'RMNCH First ANC',
                rmnchResponses,
                stageFormOf(programSchema.parse(rmnchProgram()), RMNCH.stageId),
                RMNCH.stageId,
                input.event.orgUnitId,
                heldEventSchema.parse({ ...event, program: RMNCH.programId }),
                { enrollment: input.enrollment, otherEvents: input.otherEvents }
            )
        },
    },
}

const NUMBERS = '0 1 5 12 35.5 37 38.5 39 40 101 150'.split(' ')
const DATES = '2025-12-31 2026-01-05 2026-03-12 2026-06-30 2026-11-16'.split(
    ' '
)
const TEXTS = ['a', 'skip', 'Yes', 'No', 'note']

/** A value the field takes: one of its options, or a value of its type. */
const valueFor = (next: Random, form: StageForm, fieldId: string): string => {
    const { valueType, options } = form.fields.get(fieldId)?.field ?? {
        valueType: 'TEXT',
    }
    if (options !== undefined && options.length > 0) {
        if (valueType !== 'MULTI_TEXT') {
            return pick(next, options).code
        }
        const chosen = options.filter(() => next() < 0.5)
        return (chosen.length > 0 ? chosen : [options[0]])
            .map(({ code }) => code)
            .join(',')
    }
    switch (valueType) {
        case 'BOOLEAN':
            return pick(next, ['true', 'false'])
        case 'TRUE_ONLY':
            return 'true'
        case 'DATE':
            return pick(next, DATES)
        case 'NUMBER':
        case 'PERCENTAGE':
            return pick(next, NUMBERS)
        case 'INTEGER':
        case 'INTEGER_POSITIVE':
        case 'INTEGER_ZERO_OR_POSITIVE':
            return pick(next, ['0', '1', '5', '12', '40', '101'])
        default:
            return pick(next, TEXTS)
    }
}

type Step =
    | { kind: 'set'; fieldId: string; value: string | null }
    | { kind: 'date'; value: string | null }
    | { kind: 'save'; complete: boolean }

const stepsOf = (next: Random, setup: Setup): Step[] => {
    const fields = [...setup.form.fields.keys()]
    return Array.from({ length: 1 + Math.floor(next() * LONGEST) }, () => {
        const roll = next()
        if (roll < 0.08) {
            return {
                kind: 'date',
                value: next() < 0.1 ? null : pick(next, DATES),
            }
        }
        if (roll < 0.14) {
            return { kind: 'save', complete: next() < 0.3 }
        }
        const fieldId = pick(
            next,
            next() < 0.6 && setup.ruled.length > 0 ? setup.ruled : fields
        )
        return {
            kind: 'set',
            fieldId,
            value: next() < 0.2 ? null : valueFor(next, setup.form, fieldId),
        }
    })
}

const run = (setup: Setup, steps: readonly Step[]): string | undefined => {
    const { form, context } = setup
    const optionGroups = context.optionGroupOptions
    // The engine is pure, so equal inputs share one result.
    const known = new Map<string, Result<RuleEffects, Error>>()
    const evaluate = (event: RuleEventInput) => {
        const key = JSON.stringify([
            event.occurredAt,
            event.status,
            Object.entries(event.dataValues).sort(([a], [b]) =>
                a.localeCompare(b)
            ),
        ])
        let evaluation = known.get(key)
        if (evaluation === undefined) {
            evaluation = Result.try(() =>
                evaluateEventRules(engine, context, {
                    event,
                    ...setup.supplement,
                })
            )
            known.set(key, evaluation)
        }
        return evaluation
    }
    const eventOf = (state: FormState) => ({
        id: state.eventId,
        occurredAt: state.eventDate,
        orgUnitId: setup.held?.orgUnit ?? setup.orgUnitId,
        status: state.status,
        programStageId: form.id,
    })
    const settle = (last: RuleSettled | undefined, state: FormState) => {
        const settled = settleRules(last, state.entered, eventOf(state), {
            context,
            evaluate,
            form,
            optionGroups,
            maxRuns: MAX_RUNS,
        })
        if (settled.isErr()) throw settled.error
        return settled.value
    }
    const cold = (state: FormState) => {
        const event = eventOf(state)
        const settled = runRules(
            state.entered,
            (values) => evaluate({ ...event, dataValues: { ...values } }),
            form,
            optionGroups,
            MAX_RUNS
        )
        if (settled.isErr()) throw settled.error
        return settled.value
    }
    const payloadOf = (
        state: FormState,
        outcome: RuleOutcome,
        status: FormState['status']
    ) =>
        eventPayload({
            eventId: state.eventId,
            programId: 'program',
            programStageId: form.id,
            orgUnitId: setup.orgUnitId,
            held: setup.held,
            eventDate: state.eventDate ?? '',
            status,
            effective: outcome.effective,
            opened: state.opened.stored,
        })
    /** What `useEventForm` reports as answers the rules alone changed since DHIS2 last saved. */
    const ruleChanged = (state: FormState, outcome: RuleOutcome) =>
        isDirty(state)
            ? 0
            : [...form.fields.keys()].filter(
                  (id) =>
                      (outcome.assigned.has(id) || outcome.hidden.has(id)) &&
                      outcome.effective[id] !== state.opened.stored[id]
              ).length

    let state = initialFormState(setup.held, TODAY, form.categories)
    let committed: Values = state.entered
    let settled = settle(undefined, state)
    // Hidden fields, with whether they were committed to since they were hidden.
    const hiddenSince = new Map<string, boolean>()
    const check = (at: number): string | undefined => {
        const fail = (what: string) => `step ${at}: ${what}`
        const reference = cold(state)
        if (
            settled.capped !== reference.capped ||
            !isDeepStrictEqual(settled.outcome, reference.outcome) ||
            !isDeepStrictEqual(settled.effects, reference.effects)
        ) {
            return fail(
                `settled ${JSON.stringify(settled.outcome.effective)}, from the entered values ${JSON.stringify(reference.outcome.effective)}`
            )
        }
        const { outcome } = settled
        if (!sameValues(state.entered, committed)) {
            return fail(
                `entered ${JSON.stringify(state.entered)}, committed ${JSON.stringify(committed)}`
            )
        }
        for (const [fieldId, touched] of hiddenSince) {
            if (outcome.hidden.has(fieldId)) {
                continue
            }
            hiddenSince.delete(fieldId)
            if (
                !touched &&
                !outcome.assigned.has(fieldId) &&
                outcome.effective[fieldId] !== state.entered[fieldId]
            ) {
                return fail(
                    `${fieldId} shown again as ${outcome.effective[fieldId]}, entered ${state.entered[fieldId]}`
                )
            }
        }
        for (const fieldId of outcome.hidden.keys()) {
            if (!hiddenSince.has(fieldId)) hiddenSince.set(fieldId, false)
        }
        if (state.eventDate === undefined) {
            return undefined
        }
        const [sent] = payloadOf(state, outcome, state.status).events
        const values = Object.fromEntries(
            sent.dataValues.flatMap(({ dataElement, value }) =>
                value === null ? [] : [[dataElement, value]]
            )
        )
        const deleted = sent.dataValues.filter(({ value }) => value === null)
        if (
            !sameValues(values, outcome.effective) ||
            deleted.some(
                ({ dataElement }) =>
                    state.opened.stored[dataElement] === undefined ||
                    outcome.effective[dataElement] !== undefined
            )
        ) {
            return fail(
                `saves ${JSON.stringify(sent.dataValues)}, shows ${JSON.stringify(outcome.effective)}`
            )
        }
        // Saved and opened again: the same answers, and nothing to save.
        const reopened = initialFormState(
            heldEventSchema.parse({
                ...sent,
                dataValues: Object.entries(values).map(
                    ([dataElement, value]) => ({ dataElement, value })
                ),
            }),
            TODAY,
            form.categories
        )
        const again = settle(undefined, reopened)
        if (
            !sameValues(again.outcome.effective, outcome.effective) ||
            isDirty(reopened)
        ) {
            return fail(
                `opened again as ${JSON.stringify(again.outcome.effective)}, saved ${JSON.stringify(outcome.effective)}`
            )
        }
        const after = formReducer(state, {
            type: 'saved',
            status: state.status,
            effective: outcome.effective,
            storedAt: `${TODAY}T10:00:00`,
        })
        const changed = ruleChanged(after, settle(settled, after).outcome)
        if (changed !== 0) {
            return fail(
                `right after a save the rules changed ${changed} stored answers`
            )
        }
        return undefined
    }

    const first = check(0)
    if (first !== undefined) return first
    for (const [index, step] of steps.entries()) {
        if (step.kind === 'save') {
            if (state.eventDate === undefined) continue
            const status = step.complete ? 'COMPLETED' : state.status
            const [sent] = payloadOf(state, settled.outcome, status).events
            state = formReducer(state, {
                type: 'saved',
                status: sent.status,
                effective: settled.outcome.effective,
                storedAt: `${TODAY}T10:00:00`,
            })
        } else {
            const fieldId = step.kind === 'date' ? EVENT_DATE : step.fieldId
            state = formReducer(state, {
                type: 'committed',
                fieldId,
                value: step.value,
            })
            if (step.kind === 'set') {
                const { [fieldId]: _was, ...rest } = committed
                committed =
                    step.value === null
                        ? rest
                        : { ...rest, [fieldId]: step.value }
                if (hiddenSince.has(fieldId)) hiddenSince.set(fieldId, true)
            }
        }
        settled = settle(settled, state)
        if (step.kind === 'save') {
            const changed = ruleChanged(state, settled.outcome)
            if (changed !== 0) {
                return `step ${index + 1}: right after saving, the rules changed ${changed} stored answers`
            }
        }
        const failure = check(index + 1)
        if (failure !== undefined) return failure
    }
    return undefined
}

/** The steps without any one that the failure does not need, as far as removing one at a time goes. */
const shrink = (setup: Setup, steps: Step[]): Step[] => {
    let smallest = steps
    for (let at = smallest.length - 1; at >= 0; at--) {
        const fewer = smallest.filter((_, index) => index !== at)
        if (run(setup, fewer) !== undefined) {
            smallest = fewer
        }
    }
    return smallest
}

/** One stage's share of the random sequences, as a test that names its first seed. */
export const randomCommits = (name: keyof typeof SETUPS) =>
    describe(`${name}: the form’s rules over random commits`, () => {
        // The engine logs every rule it cannot run, such as one reading a cleared event date.
        beforeEach(() => {
            vi.spyOn(console, 'error').mockImplementation(() => undefined)
            vi.spyOn(console, 'log').mockImplementation(() => undefined)
            vi.spyOn(console, 'warn').mockImplementation(() => undefined)
        })
        afterEach(() => {
            vi.restoreAllMocks()
        })

        const { setup: setupFor, sequences, seeds } = SETUPS[name]
        const count = Math.max(1, Math.round(sequences * SEQUENCES))
        const from = SEED + seeds
        it(`holds after every step of ${count} sequences from seed ${from}`, () => {
            const setup = setupFor()
            for (let sequence = 0; sequence < count; sequence++) {
                const seed = from + sequence
                const steps = stepsOf(random(seed), setup)
                const failure = run(setup, steps)
                if (failure !== undefined) {
                    const smallest = shrink(setup, steps)
                    throw new Error(
                        `${name}, seed ${seed}: ${run(setup, smallest) ?? failure}\nsteps: ${JSON.stringify(smallest)}`
                    )
                }
            }
        }, 120_000)
    })
