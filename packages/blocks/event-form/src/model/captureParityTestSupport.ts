/*
 * The scenarios the Capture parity tests run: the RMNCH first antenatal care visit, small
 * synthetic programs, and the large generated program from the program-rules fixtures.
 */
import { expect } from 'vitest'
import { buildRuleContext } from '@/registry/program-rules/lib/buildContext'
import { loadRuleEngine } from '@/registry/program-rules/hooks/loadRuleEngine'
import type {
    ProgramRuleActionMetadata,
    ProgramRuleMetadata,
} from '@/registry/program-rules/lib/types'
import {
    RuleEnrollmentResponseSchema,
    toRuleEnrollmentData,
} from '../../../program-rules/src/hooks/enrollment'
import {
    ProgramRulesResponseSchema,
    toProgramRulesMetadata,
} from '../../../program-rules/src/hooks/metadata'
import large from '../../../program-rules/test/fixtures/large/bundle.json'
import {
    currentEventVariable,
    eventInput,
    programMetadata,
} from '../../../program-rules/test/metadata'
import {
    RMNCH,
    rmnchInput,
    rmnchMetadata,
} from '../../../program-rules/test/rmnch'
import stageFixture from '../api/__fixtures__/rmnch-stage.json'
import {
    ProgramResponseSchema,
    toStageMetadata,
    type DataElementMeta,
    type Section,
} from '../api/schemas'
import { dataElement, stageMetadata } from './__fixtures__/builders'
import {
    captureSettled,
    oursView,
    type ParityScenario,
} from './__fixtures__/capture'
import type { Values } from './overlay'

const engine = await loadRuleEngine()

export const expectParity = (scenario: ParityScenario, stored: Values) =>
    expect(oursView(scenario, stored)).toEqual(captureSettled(scenario, stored))

// ---- RMNCH: the first antenatal care visit -------------------------------------

export const rmnch: ParityScenario = {
    engine,
    context: buildRuleContext(engine, rmnchMetadata()),
    metadata: toStageMetadata(
        ProgramResponseSchema.parse(stageFixture),
        RMNCH.stageId
    ).unwrap(),
    input: rmnchInput(),
}

/** The stored visit's values with some changed (`null` removes one). */
export const visit = (changes: Record<string, string | null> = {}): Values =>
    rmnchInput(changes).event.dataValues

/** RMNCH fields the parity cases name, beyond the ones in `RMNCH`. */
export const RMNCH_FIELDS = {
    autoimmune: 'zzGNbeMnTd6',
    aspirin: 'OSuxnldV4Ug',
    otherChronicSpecified: 'Mh7nK8UKoZP',
    smoking: 'sWoqcoByYmD',
    smokingCessation: 'Ok9OQpitjQr',
    clinicalDueDate: 'YKXci7Sm0Zq',
} as const

// ---- Synthetic programs: one stage, text fields A, B, C, D and X ---------------

export const synthetic = (
    rules: ProgramRuleMetadata[],
    elements: DataElementMeta[] = ['A', 'B', 'C', 'D', 'X'].map((id) =>
        dataElement(id)
    ),
    sections?: Section[]
): ParityScenario => ({
    engine,
    context: buildRuleContext(
        engine,
        programMetadata({
            variables: ['a', 'b', 'c', 'd', 'x'].map((name) =>
                currentEventVariable(name, name.toUpperCase())
            ),
            rules,
        })
    ),
    metadata: stageMetadata(elements, sections && { sections }),
    input: eventInput(),
})

export const hide = (field: string): ProgramRuleActionMetadata => ({
    id: `hide-${field}`,
    type: 'HIDEFIELD',
    dataElementId: field,
})

export const assign = (
    field: string,
    data: string
): ProgramRuleActionMetadata => ({
    id: `assign-${field}`,
    type: 'ASSIGN',
    dataElementId: field,
    data,
})

export const YES_NO = [
    { id: 'o-yes', code: 'yes', label: 'Yes' },
    { id: 'o-no', code: 'no', label: 'No' },
    { id: 'o-maybe', code: 'maybe', label: 'Maybe' },
]

// ---- The large generated program (300 rules, 11 events) ------------------------

const largeEnrollment = toRuleEnrollmentData(
    RuleEnrollmentResponseSchema.parse({
        ...large.enrollment,
        events: large.events,
    })
)
const findLargeEvent = () => {
    const found = largeEnrollment.events.find(
        (event) => event.id === large.currentEventId
    )
    if (found === undefined) {
        throw new Error('the large fixture lost its current event')
    }
    return found
}
export const largeEvent = findLargeEvent()
const largeValueTypes = new Map(Object.entries(large.fx.valueTypes))
const largeElements = [...largeValueTypes].map(([id, valueType]) =>
    dataElement(id, { valueType })
)
const largeStage = stageMetadata(largeElements)
const largeContext = buildRuleContext(
    engine,
    toProgramRulesMetadata(
        ProgramRulesResponseSchema.parse({
            rules: { programRules: large.fx.programRules },
            variables: { programRuleVariables: large.fx.programRuleVariables },
            constants: { constants: large.fx.constants },
            program: {
                id: RMNCH.programId,
                name: large.fx.programName,
                programStages: Object.entries(large.fx.stageNames).map(
                    ([id, name]) => ({ id, name })
                ),
            },
            me: large.fx.me,
        })
    )
)

export const largeScenario = (
    occurredAt = largeEvent.occurredAt
): ParityScenario => ({
    engine,
    context: largeContext,
    metadata: {
        ...largeStage,
        stage: { ...largeStage.stage, id: largeEvent.programStageId },
    },
    input: {
        event: { ...largeEvent, occurredAt },
        enrollment: largeEnrollment.enrollment,
        otherEvents: largeEnrollment.events,
    },
})

/** A deterministic variation of the large event: some values dropped, numbers redrawn. */
export const largeVariation = (seed: number): Values => {
    let state = seed
    const random = () => {
        state = (state * 1103515245 + 12345) % 2 ** 31
        return state / 2 ** 31
    }
    const values = new Map<string, string>()
    for (const [id, value] of Object.entries(largeEvent.dataValues)) {
        if (random() < 0.15) {
            continue
        }
        values.set(
            id,
            largeValueTypes.get(id) === 'NUMBER'
                ? String(Math.floor(random() * 100))
                : value
        )
    }
    return Object.fromEntries(values)
}
