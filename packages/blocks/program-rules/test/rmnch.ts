import {
    RuleEnrollmentResponseSchema,
    toRuleEnrollmentData,
} from '../src/hooks/enrollment'
import {
    ProgramRulesResponseSchema,
    toProgramRulesMetadata,
} from '../src/hooks/metadata'
import type { EventRuleInput, ProgramRulesMetadata } from '../src/lib/types'
import constants from './fixtures/rmnch/constants.json'
import enrollment from './fixtures/rmnch/enrollment.json'
import me from './fixtures/rmnch/me.json'
import optionSets from './fixtures/rmnch/optionSets.json'
import program from './fixtures/rmnch/program.json'
import programRuleVariables from './fixtures/rmnch/programRuleVariables.json'
import programRules from './fixtures/rmnch/programRules.json'

export const RMNCH = {
    programId: 'WSGAb5XwJ3Y',
    stageId: 'WZbXY0S00lP',
    enrollmentId: 'PE6abx7Zhn0',
    eventId: 'Evahwp3zrQ4',
    chronic: 'de0FEHSIoxh',
    chronicFollowUps: [
        'xPTngRLQTnu',
        'sdchiIXIcCf',
        'VFffa31SKjH',
        'Q1x1HIhuwFN',
        'zzGNbeMnTd6',
        'UQ2Zo8CruPB',
    ],
    lmp: 'w4ky6EkVahL',
    gestationalAge: 'roKuXYfw1BW',
    postpartumStage: 'bbKtnxRZKEP',
} as const

interface RawField {
    id: string
    optionSet?: { id: string }
}
interface RawVariable {
    dataElement?: RawField
    trackedEntityAttribute?: RawField
}

/** The variables endpoint as the hook requests it: option sets nested, with options. */
export const rmnchVariablesResponse = () => {
    const byId = new Map(optionSets.optionSets.map((set) => [set.id, set]))
    const withOptions = (field: RawField | undefined) =>
        field?.optionSet === undefined
            ? field
            : { ...field, optionSet: byId.get(field.optionSet.id) }
    const variables: ReadonlyArray<RawVariable> =
        programRuleVariables.programRuleVariables
    return {
        programRuleVariables: variables.map((variable) => ({
            ...variable,
            dataElement: withOptions(variable.dataElement),
            trackedEntityAttribute: withOptions(
                variable.trackedEntityAttribute
            ),
        })),
    }
}

export const rmnchResponses = {
    rules: programRules,
    variables: rmnchVariablesResponse(),
    constants,
    program,
    me,
}

export const rmnchMetadata = (): ProgramRulesMetadata =>
    toProgramRulesMetadata(ProgramRulesResponseSchema.parse(rmnchResponses))

export const rmnchEnrollmentResponse = enrollment

export const rmnchInput = (
    values: Record<string, string | null> = {}
): EventRuleInput => {
    const data = toRuleEnrollmentData(
        RuleEnrollmentResponseSchema.parse(enrollment)
    )
    const current = data.events.find((event) => event.id === RMNCH.eventId)
    if (current === undefined) {
        throw new Error('the RMNCH fixture lost its current event')
    }
    const dataValues = { ...current.dataValues }
    for (const [fieldId, value] of Object.entries(values)) {
        if (value === null) {
            delete dataValues[fieldId]
        } else {
            dataValues[fieldId] = value
        }
    }
    return {
        event: { ...current, dataValues },
        enrollment: data.enrollment,
        otherEvents: data.events,
    }
}
