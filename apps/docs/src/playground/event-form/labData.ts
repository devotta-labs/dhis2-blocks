import {
    CHILD_VISIT,
    CHILD_VISIT_PATH,
    CHILD_VISIT_RULES,
    CHILD_VISIT_VARIABLES,
    childVisitProgram,
    RULES_CHANGED_VISIT,
    SAVED_FUNDED_VISIT,
    SAVED_VISIT,
} from '@/components/event-form/test/childVisit'
import rmnchConstants from '@/components/program-rules/__tests__/fixtures/rmnch/constants.json'
import rmnchEnrollment from '@/components/program-rules/__tests__/fixtures/rmnch/enrollment.json'
import rmnchMe from '@/components/program-rules/__tests__/fixtures/rmnch/me.json'
import rmnchOptionSets from '@/components/program-rules/__tests__/fixtures/rmnch/optionSets.json'
import rmnchProgram from '@/components/program-rules/__tests__/fixtures/rmnch/program.json'
import rmnchRules from '@/components/program-rules/__tests__/fixtures/rmnch/programRules.json'
import rmnchVariables from '@/components/program-rules/__tests__/fixtures/rmnch/programRuleVariables.json'
import rmnchStages from '@/components/tracker-data-entry/sources/__tests__/fixtures/rmnch-program.json'
import { z } from 'zod'
import { FILLED, GROUPS } from '../dhis2-value-input/labData'
import type { LabNetwork } from '../network'

export type Example =
    | 'newVisit'
    | 'savedVisit'
    | 'rulesChangedVisit'
    | 'fundedVisit'
    | 'savedFundedVisit'
    | 'locked'
    | 'noWrite'
    | 'valueTypes'
    | 'rmnch'
    | 'longForm'
    | 'refused'
    | 'rulesFail'
    | 'noSections'
    | 'onComplete'
    | 'pointVisit'
    | 'savedPointVisit'
    | 'areaVisit'
    | 'areaStageVisit'

export interface LabSettings {
    example: Example
    blame: 'markers' | 'off'
    confirmSaved: 'status' | 'off'
    /** How far a location may be from a point org unit before the form warns; absent, it is not checked. */
    locationWarnKm?: number
    /** The lab's user holds `F_UNCOMPLETE_EVENT`, so may reopen a completed event. */
    mayUncomplete: boolean
    network: LabNetwork
}

const labEventSchema = z.looseObject({
    event: z.string(),
    dataValues: z
        .array(z.object({ dataElement: z.string(), value: z.string() }))
        .default([]),
    notes: z.array(z.looseObject({ note: z.string() })).optional(),
})

export type LabEvent = z.infer<typeof labEventSchema>

export interface LabExample {
    programId: string
    programStageId: string
    orgUnitId: string
    eventId?: string
    enrollmentId?: string
    trackedEntityId?: string
    /** What `programs/<id>` answers, for the form and the rules alike. */
    program: object
    rules: { programRules: readonly object[] }
    variables: { programRuleVariables: readonly object[] }
    constants: { constants: readonly object[] }
    me: { userRoles: readonly object[]; userGroups: readonly object[] }
    /** What `tracker/enrollments/<enrollmentId>` answers, for rules that read the enrolment. */
    enrollment?: object
    /** The events the server holds when a run starts. */
    events: readonly LabEvent[]
    /** `programRules` answers a server error. */
    rulesFail?: boolean
    /** `tracker` refuses every import. */
    refuse?: boolean
}

/** The org units the lab knows: the Child visit clinic, at a point, and a chiefdom, an area around it. */
export const ORG_UNITS = new Map([
    [
        CHILD_VISIT.orgUnitId,
        {
            path: CHILD_VISIT_PATH,
            displayName: 'Ngelehun CHC',
            geometry: { type: 'Point', coordinates: [-11.4001, 8.4512] },
        },
    ],
    [
        'labOrgUnit2',
        {
            path: '/labCountry1/labDistrct1/labOrgUnit2',
            displayName: 'Badjia',
            geometry: {
                type: 'Polygon',
                coordinates: [
                    [
                        [-11.6, 8.3],
                        [-11.2, 8.3],
                        [-11.2, 8.6],
                        [-11.6, 8.6],
                        [-11.6, 8.3],
                    ],
                ],
            },
        },
    ],
])

const NO_CONSTANTS = { constants: [] }
const NO_USER_ROLES = { userRoles: [], userGroups: [] }

const labExample = (example: LabExample) => example

const childVisit = (
    program = childVisitProgram(),
    events: readonly LabEvent[] = [SAVED_VISIT]
) =>
    labExample({
        programId: CHILD_VISIT.programId,
        programStageId: CHILD_VISIT.stageId,
        orgUnitId: CHILD_VISIT.orgUnitId,
        enrollmentId: CHILD_VISIT.enrollmentId,
        program,
        rules: CHILD_VISIT_RULES,
        variables: CHILD_VISIT_VARIABLES,
        constants: NO_CONSTANTS,
        me: NO_USER_ROLES,
        events,
    })

const editing = (example: LabExample) =>
    labExample({
        ...example,
        eventId: CHILD_VISIT.eventId,
    })

const valueTypes = () => {
    const stage = {
        id: 'labTypesStg',
        name: 'Every value type',
        displayName: 'Every value type',
        displayExecutionDateLabel: 'Visit date',
        access: { data: { write: true } },
        programStageDataElements: GROUPS.flatMap(({ fields }) =>
            fields.map(({ id, label, field }) => ({
                compulsory: false,
                allowFutureDate: field.valueType !== 'DATE',
                dataElement: {
                    id,
                    displayFormName: label,
                    valueType: field.valueType,
                    optionSet: field.options && {
                        id: `${id}Options`,
                        options: field.options.map(({ code, name }) => ({
                            code,
                            displayName: name,
                        })),
                    },
                },
            }))
        ),
        programStageSections: GROUPS.map(({ legend, fields }, at) => ({
            id: `labTypesSc${at}`,
            displayName: legend,
            dataElements: fields.map(({ id }) => ({ id })),
        })),
    }
    return labExample({
        programId: 'labTypesPrg',
        programStageId: stage.id,
        orgUnitId: CHILD_VISIT.orgUnitId,
        eventId: 'labTypes001',
        program: {
            id: 'labTypesPrg',
            name: 'Every value type',
            displayName: 'Every value type',
            programStages: [stage],
        },
        rules: { programRules: [] },
        variables: { programRuleVariables: [] },
        constants: NO_CONSTANTS,
        me: NO_USER_ROLES,
        events: [
            {
                event: 'labTypes001',
                program: 'labTypesPrg',
                programStage: stage.id,
                orgUnit: CHILD_VISIT.orgUnitId,
                occurredAt: '2026-11-02T09:30:00.000',
                status: 'ACTIVE',
                dataValues: Object.entries(FILLED).map(
                    ([dataElement, value]) => ({ dataElement, value })
                ),
            },
        ],
    })
}

const RMNCH_STAGE = 'WZbXY0S00lP'
const RMNCH_EVENT = 'Evahwp3zrQ4'

const RMNCH_SMOKING_RULE = {
    id: 'labRmnchRl1',
    name: 'Ask about smoking until the birth is recorded',
    displayName: 'Ask about smoking until the birth is recorded',
    condition:
        "d2:yearsBetween(A{born}, V{event_date}) >= 15 && !d2:hasValue('currentProgranancyOutcome')",
    programStage: { id: RMNCH_STAGE },
    programRuleActions: [
        {
            id: 'labRmnchAc1',
            programRuleActionType: 'SHOWWARNING',
            dataElement: { id: 'sWoqcoByYmD' },
            content: 'Ask again about smoking before the birth.',
            displayContent: 'Ask again about smoking before the birth.',
        },
        {
            id: 'labRmnchAc2',
            programRuleActionType: 'SETMANDATORYFIELD',
            dataElement: { id: 'sWoqcoByYmD' },
        },
    ],
}

const rmnch = () => {
    const formStages = new Map(
        rmnchStages.programStages.map((stage) => [stage.id, stage])
    )
    const programStages = rmnchProgram.programStages.map((stage) => {
        const form = formStages.get(stage.id)
        return {
            ...form,
            ...stage,
            programStageSections: form?.programStageSections.map(
                (section, at) => ({
                    ...section,
                    displayName: `Section ${at + 1}`,
                })
            ),
        }
    })
    const optionSets = new Map(
        rmnchOptionSets.optionSets.map((set) => [set.id, set])
    )
    const withOptions = <T extends { optionSet?: { id: string } }>(
        field?: T
    ) =>
        field?.optionSet === undefined
            ? field
            : { ...field, optionSet: optionSets.get(field.optionSet.id) }
    const variables: ReadonlyArray<{
        dataElement?: { id: string; optionSet?: { id: string } }
        trackedEntityAttribute?: { id: string; optionSet?: { id: string } }
    }> = rmnchVariables.programRuleVariables
    const names = new Map([
        ...rmnchStages.programStages.flatMap((stage) =>
            stage.programStageDataElements.map(
                ({ dataElement }) =>
                    [dataElement.id, dataElement.displayFormName] as const
            )
        ),
        ...rmnchEnrollment.attributes.map(
            ({ attribute, displayName }) => [attribute, displayName] as const
        ),
    ])
    const named = <T extends { id: string; optionSet?: { id: string } }>(
        field?: T
    ) =>
        field && {
            ...withOptions(field),
            displayName: names.get(field.id),
        }
    return labExample({
        programId: rmnchProgram.id,
        programStageId: RMNCH_STAGE,
        orgUnitId: 'm7fBMpmVpSM',
        eventId: RMNCH_EVENT,
        enrollmentId: rmnchEnrollment.enrollment,
        trackedEntityId: rmnchEnrollment.trackedEntity,
        program: { ...rmnchProgram, programStages },
        rules: {
            programRules: [...rmnchRules.programRules, RMNCH_SMOKING_RULE],
        },
        variables: {
            programRuleVariables: variables.map((variable) => ({
                ...variable,
                dataElement: named(variable.dataElement),
                trackedEntityAttribute: named(variable.trackedEntityAttribute),
            })),
        },
        constants: rmnchConstants,
        me: rmnchMe,
        enrollment: rmnchEnrollment,
        events: rmnchEnrollment.events.filter(
            ({ event }) => event === RMNCH_EVENT
        ),
    })
}

const LONG_FIELDS = Array.from({ length: 150 }, (_, at) => {
    const number = String(at + 1).padStart(3, '0')
    return at % 2 === 0
        ? { id: `f${number}`, label: `Reading ${number}`, valueType: 'NUMBER' }
        : { id: `f${number}`, label: `Note ${number}`, valueType: 'TEXT' }
})

const longRule = (
    number: number,
    name: string,
    condition: string,
    action: { type: string; field: string; data?: string }
) => ({
    id: `labLongRul${number}`,
    name,
    displayName: name,
    condition,
    priority: number,
    programRuleActions: [
        {
            id: `labLongAct${number}`,
            programRuleActionType: action.type,
            dataElement: { id: action.field },
            data: action.data,
        },
    ],
})

const longForm = () =>
    labExample({
        programId: 'labLongProg',
        programStageId: 'labLongStge',
        orgUnitId: CHILD_VISIT.orgUnitId,
        program: {
            id: 'labLongProg',
            name: 'Long form',
            displayName: 'Long form',
            programStages: [
                {
                    id: 'labLongStge',
                    name: 'Long form',
                    displayName: 'Long form',
                    access: { data: { write: true } },
                    programStageDataElements: LONG_FIELDS.map(
                        ({ id, label, valueType }) => ({
                            dataElement: {
                                id,
                                displayFormName: label,
                                valueType,
                            },
                        })
                    ),
                    programStageSections: Array.from(
                        { length: 10 },
                        (_, at) => ({
                            id: `labLongSct${at}`,
                            displayName: `Part ${at + 1}`,
                            dataElements: LONG_FIELDS.slice(
                                at * 15,
                                at * 15 + 15
                            ).map(({ id }) => ({ id })),
                        })
                    ),
                },
            ],
        },
        rules: {
            programRules: [
                longRule(
                    1,
                    'Double the first reading',
                    'd2:hasValue(#{f001})',
                    {
                        type: 'ASSIGN',
                        field: 'f003',
                        data: '#{f001} * 2',
                    }
                ),
                longRule(
                    2,
                    'Add ten to the doubled reading',
                    'd2:hasValue(#{f003})',
                    {
                        type: 'ASSIGN',
                        field: 'f005',
                        data: '#{f003} + 10',
                    }
                ),
                longRule(
                    3,
                    'Carry the result to part 10',
                    'd2:hasValue(#{f005})',
                    {
                        type: 'ASSIGN',
                        field: 'f141',
                        data: '#{f005}',
                    }
                ),
                longRule(4, 'Reading 7 only below 100', '#{f001} > 100', {
                    type: 'HIDEFIELD',
                    field: 'f007',
                }),
                longRule(5, 'Note 4 skipped', "#{f002} == 'skip'", {
                    type: 'HIDEFIELD',
                    field: 'f004',
                }),
            ],
        },
        variables: {
            programRuleVariables: LONG_FIELDS.map(({ id, valueType }) => ({
                id: `labLongVar${id}`,
                name: id,
                programRuleVariableSourceType: 'DATAELEMENT_CURRENT_EVENT',
                dataElement: { id, valueType },
            })),
        },
        constants: NO_CONSTANTS,
        me: NO_USER_ROLES,
        events: [],
    })

/** Every example the lab opens, by name. */
export const EXAMPLES = {
    newVisit: childVisit(),
    savedVisit: editing(childVisit()),
    rulesChangedVisit: editing(
        childVisit(childVisitProgram(), [RULES_CHANGED_VISIT])
    ),
    fundedVisit: childVisit(childVisitProgram({ categories: true }), [
        SAVED_FUNDED_VISIT,
    ]),
    savedFundedVisit: editing(
        childVisit(childVisitProgram({ categories: true }), [
            SAVED_FUNDED_VISIT,
        ])
    ),
    locked: editing(
        childVisit(childVisitProgram({ blockEntryForm: true }), [
            { ...SAVED_VISIT, status: 'COMPLETED' },
        ])
    ),
    noWrite: editing(childVisit(childVisitProgram({ write: false }))),
    valueTypes: valueTypes(),
    rmnch: rmnch(),
    longForm: longForm(),
    refused: { ...childVisit(), refuse: true },
    rulesFail: { ...childVisit(), rulesFail: true },
    noSections: childVisit(childVisitProgram({ sections: false })),
    onComplete: childVisit(
        childVisitProgram({ validationStrategy: 'ON_COMPLETE' })
    ),
    pointVisit: childVisit(childVisitProgram({ featureType: 'POINT' })),
    savedPointVisit: editing(
        childVisit(childVisitProgram({ featureType: 'POINT' }))
    ),
    areaVisit: {
        ...childVisit(childVisitProgram({ featureType: 'POINT' })),
        orgUnitId: 'labOrgUnit2',
    },
    // A stage that records the area a visit covered: drawn as one boundary, sent as a multi-polygon of one part.
    areaStageVisit: {
        ...childVisit(childVisitProgram({ featureType: 'MULTI_POLYGON' })),
        orgUnitId: 'labOrgUnit2',
    },
} satisfies Record<Example, LabExample>

/** The events an example's server holds, fresh for each run, so what one run saves is gone in the next. */
export const labEvents = (example: Example) =>
    new Map(EXAMPLES[example].events.map((event) => [event.event, event]))
