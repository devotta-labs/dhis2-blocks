import type { WireParams } from '../wire'
import {
    ATTRIBUTES,
    DATA_ELEMENTS,
    LAB_ORG_UNIT,
    LAB_PROGRAM,
    LAB_STAGE,
    VILLAGES,
    VISIT_TYPES,
    type LabConfig,
    type LabPerson,
    type World,
} from './labData'
import { inWindow, matches, parseFilters, sorted, valueOf } from './query'
import { createSavedViews, type RequestType } from './savedViews'

type Params = WireParams

/** What the server's answers depend on. */
type ServerConfig = Pick<LabConfig, 'data' | 'server'>

/** One request as the block sends it through app-runtime. */
export interface LabRequest {
    resource: string
    id?: string
    params?: Params
    data?: unknown
}

const text = (value: Params[string]) =>
    value === undefined || value === null ? undefined : String(value)

const access = { read: true, write: true, data: { read: true, write: true } }

const options = (
    id: string,
    pairs: ReadonlyArray<readonly [string, string]>
) => ({
    id,
    options: pairs.map(([code, displayName]) => ({
        id: `${id.slice(0, 7)}${code.slice(0, 4)}`,
        code,
        displayName,
    })),
})

const ATTRIBUTE_METADATA: ReadonlyArray<
    readonly [string, string, string, boolean, object?]
> = [
    [ATTRIBUTES.firstName, 'First name', 'TEXT', true],
    [ATTRIBUTES.lastName, 'Last name', 'TEXT', true],
    [ATTRIBUTES.nationalId, 'National ID', 'TEXT', true],
    [
        ATTRIBUTES.sex,
        'Sex',
        'TEXT',
        true,
        options('labSexOpSet', [
            ['F', 'Female'],
            ['M', 'Male'],
        ]),
    ],
    [ATTRIBUTES.birthDate, 'Date of birth', 'DATE', true],
    [ATTRIBUTES.phone, 'Phone number', 'PHONE_NUMBER', false],
    [
        ATTRIBUTES.village,
        'Village',
        'TEXT',
        false,
        options('labVillOpSt', VILLAGES),
    ],
    [ATTRIBUTES.consent, 'Consent given', 'BOOLEAN', false],
]

const programJson = () => ({
    id: LAB_PROGRAM,
    displayName: 'Lab clinic',
    programType: 'WITH_REGISTRATION',
    displayEnrollmentDateLabel: 'Enrollment date',
    displayIncidentDate: true,
    displayIncidentDateLabel: 'Incident date',
    trackedEntityType: { id: 'labPersonTy', displayName: 'Person' },
    access,
    programTrackedEntityAttributes: ATTRIBUTE_METADATA.map(
        ([id, displayName, valueType, displayInList, optionSet]) => ({
            displayInList,
            searchable: true,
            trackedEntityAttribute: {
                id,
                displayName,
                valueType,
                unique: id === ATTRIBUTES.nationalId,
                optionSet: optionSet ?? null,
            },
        })
    ),
    programStages: [
        {
            id: LAB_STAGE,
            displayName: 'Follow-up visit',
            displayExecutionDateLabel: 'Visit date',
            displayDueDateLabel: 'Due date',
            hideDueDate: false,
            enableUserAssignment: false,
            access: { read: true },
            programStageDataElements: [
                [DATA_ELEMENTS.weight, 'Weight (kg)', 'NUMBER', true],
                [
                    DATA_ELEMENTS.visitType,
                    'Visit type',
                    'TEXT',
                    true,
                    options('labVisitOpS', VISIT_TYPES),
                ],
                [DATA_ELEMENTS.referred, 'Referred', 'TRUE_ONLY', false],
            ].map(
                ([
                    id,
                    displayName,
                    valueType,
                    displayInReports,
                    optionSet,
                ]) => ({
                    displayInReports,
                    dataElement: {
                        id,
                        displayName,
                        valueType,
                        optionSet: optionSet ?? null,
                    },
                })
            ),
        },
    ],
})

const page = <T>(items: T[], params: Params, apiVersion: number) => {
    const pageNumber = Number(params.page ?? 1)
    const pageSize = Number(params.pageSize ?? 50)
    const first = (pageNumber - 1) * pageSize
    const slice = items.slice(first, first + pageSize)
    const more = first + pageSize < items.length
    return {
        items: slice,
        pager:
            apiVersion >= 42 && more
                ? { page: pageNumber, pageSize, nextPage: 'next' }
                : { page: pageNumber, pageSize },
    }
}

const statuses = (value: Params[string]) =>
    text(value)?.split(/[;,]/).filter(Boolean)

const trackedEntityJson = (person: LabPerson) => ({
    trackedEntity: person.id,
    trackedEntityType: 'labPersonTy',
    createdAt: person.createdAt,
    updatedAt: person.createdAt,
    inactive: false,
    attributes: Object.entries(person.attributes).flatMap(
        ([attribute, value]) =>
            value === undefined ? [] : [{ attribute, value }]
    ),
    programOwners: [{ orgUnit: LAB_ORG_UNIT, program: LAB_PROGRAM }],
    enrollments: [
        {
            enrollment: `${person.id}En`,
            program: LAB_PROGRAM,
            status: person.enrollmentStatus,
            enrolledAt: person.enrolledAt,
            occurredAt: person.occurredAt,
            followUp: person.followUp,
        },
    ],
})

const eventJson = (person: LabPerson) => ({
    event: person.visit.id,
    status: person.visit.status,
    program: LAB_PROGRAM,
    programStage: LAB_STAGE,
    enrollment: `${person.id}En`,
    trackedEntity: person.id,
    occurredAt: person.visit.occurredAt,
    scheduledAt: person.visit.scheduledAt,
    createdAt: person.createdAt,
    orgUnit: LAB_ORG_UNIT,
    dataValues: Object.entries(person.visit.dataValues).flatMap(
        ([dataElement, value]) =>
            value === undefined ? [] : [{ dataElement, value }]
    ),
})

const trackedEntities = (
    { server }: ServerConfig,
    world: World,
    params: Params
) => {
    const joined = text(params.trackedEntities)?.split(',')
    if (joined) {
        const wanted = new Set(joined)
        return {
            trackedEntities: world.people
                .filter((person) => wanted.has(person.id))
                .map(trackedEntityJson),
        }
    }
    let people = world.people
    if (server.query === 'honoured') {
        const conditions = parseFilters(params.filter)
        const wanted = statuses(params.enrollmentStatus ?? params.programStatus)
        const followUp = text(params.followUp)
        people = sorted(
            people.filter(
                (person) =>
                    conditions.every((condition) =>
                        matches(valueOf(person, condition.field), condition)
                    ) &&
                    (!wanted || wanted.includes(person.enrollmentStatus)) &&
                    (!followUp || String(person.followUp) === followUp) &&
                    inWindow(
                        person.enrolledAt,
                        params,
                        'enrollmentEnrolledAfter',
                        'enrollmentEnrolledBefore'
                    ) &&
                    inWindow(
                        person.occurredAt,
                        params,
                        'enrollmentOccurredAfter',
                        'enrollmentOccurredBefore'
                    )
            ),
            text(params.order)
        )
    }
    const { items, pager } = page(people, params, server.apiVersion)
    return { trackedEntities: items.map(trackedEntityJson), pager }
}

const events = ({ server }: ServerConfig, world: World, params: Params) => {
    let people = world.people
    if (server.query === 'honoured') {
        const conditions = [
            ...parseFilters(params.filter),
            ...parseFilters(params.filterAttributes),
        ]
        const status = text(params.status)
        people = sorted(
            people.filter(
                (person) =>
                    conditions.every((condition) =>
                        matches(valueOf(person, condition.field), condition)
                    ) &&
                    (!status || person.visit.status === status) &&
                    inWindow(
                        person.visit.occurredAt,
                        params,
                        'occurredAfter',
                        'occurredBefore'
                    ) &&
                    inWindow(
                        person.visit.scheduledAt,
                        params,
                        'scheduledAfter',
                        'scheduledBefore'
                    )
            ),
            text(params.order)
        )
    }
    const { items, pager } = page(people, params, server.apiVersion)
    return { events: items.map(eventJson), pager }
}

/**
 * A fake DHIS2 for one run of the lab: answers the block's reads from `world`,
 * and keeps the saved views it creates, replaces and deletes until the next run.
 */
export const createLabServer = (config: ServerConfig, world: World) => {
    const savedViews = createSavedViews(config)

    return async (
        request: LabRequest,
        type: RequestType = 'read'
    ): Promise<object> => {
        const params = request.params ?? {}
        switch (request.resource) {
            case 'system/info':
                return {
                    calendar: 'gregorian',
                    dateFormat: 'YYYY-MM-DD',
                    serverTimeZoneId: 'Africa/Freetown',
                }
            case 'programs':
                return request.id ? programJson() : { programs: [] }
            case 'trackedEntityInstanceFilters':
            case 'programStageWorkingLists':
                return savedViews[request.resource](request, type)
            case 'organisationUnits':
            case 'me':
                return {
                    organisationUnits: [
                        {
                            id: LAB_ORG_UNIT,
                            displayName: 'Lab clinic',
                            path: `/${LAB_ORG_UNIT}`,
                        },
                    ],
                }
            case 'users':
                return {
                    users: [
                        {
                            id: 'labUser0001',
                            displayName: 'Lab Nurse',
                            username: 'nurse',
                        },
                    ],
                }
            case 'fileResources':
                return { fileResources: [] }
            case 'tracker/events':
                return events(config, world, params)
            default:
                return trackedEntities(config, world, params)
        }
    }
}

export const RESOURCES = [
    'system/info',
    'programs',
    'trackedEntityInstanceFilters',
    'programStageWorkingLists',
    'organisationUnits',
    'me',
    'users',
    'fileResources',
    'tracker/trackedEntities',
    'tracker/events',
]
