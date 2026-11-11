import type { DataEngineQueryParameters } from '@/components/working-list/api/request'
import {
    addDays,
    ATTRIBUTES,
    LAB_ORG_UNIT,
    LAB_PROGRAM,
    LAB_STAGE,
    WEIGHT,
    type LabConfig,
    type LabPerson,
    type World,
} from './labData'

type Params = DataEngineQueryParameters

/** One request as the block sends it through app-runtime. */
export interface LabRequest {
    resource: string
    id?: string
    params?: Params
}

export const TE_SAVED_VIEW = 'labTeFilter'
export const EVENT_SAVED_VIEW = 'labVisits1'

const text = (value: Params[string]) =>
    value === undefined || value === null ? undefined : String(value)

const access = { read: true, write: true, data: { read: true, write: true } }

const programJson = ({ data }: LabConfig) => ({
    id: LAB_PROGRAM,
    displayName: 'Lab clinic',
    programType: 'WITH_REGISTRATION',
    displayEnrollmentDateLabel: 'Enrollment date',
    displayIncidentDate: true,
    displayIncidentDateLabel: 'Incident date',
    trackedEntityType: { id: 'labPersonTy', displayName: 'Person' },
    access,
    programTrackedEntityAttributes: (
        [
            [ATTRIBUTES.firstName, 'First name', data.names !== 'unnamed'],
            [ATTRIBUTES.lastName, 'Last name', data.names !== 'unnamed'],
            [ATTRIBUTES.nationalId, 'National ID', true],
            [ATTRIBUTES.sex, 'Sex', true],
            [ATTRIBUTES.location, 'Location', false],
        ] as const
    ).map(([id, displayName, displayInList]) => ({
        displayInList,
        searchable: true,
        trackedEntityAttribute: {
            id,
            displayName,
            valueType: 'TEXT',
            unique: id === ATTRIBUTES.nationalId,
            optionSet:
                id === ATTRIBUTES.sex
                    ? {
                          id: 'labSexOpSet',
                          options: [
                              { code: 'F', displayName: 'Female' },
                              { code: 'M', displayName: 'Male' },
                          ],
                      }
                    : null,
        },
    })),
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
                {
                    displayInReports: true,
                    dataElement: {
                        id: WEIGHT,
                        displayName: 'Weight (kg)',
                        valueType: 'NUMBER',
                    },
                },
            ],
        },
    ],
})

const dateFilter = ({ server }: LabConfig, today: string) => {
    switch (server.savedFilter) {
        case 'thisMonth':
            return { type: 'RELATIVE', period: 'THIS_MONTH' }
        case 'last30':
            return { type: 'RELATIVE', startBuffer: -30, endBuffer: 0 }
        case 'next90':
            return { type: 'RELATIVE', startBuffer: 0, endBuffer: 90 }
        case 'fixedPast':
            return {
                type: 'ABSOLUTE',
                startDate: addDays(today, -120),
                endDate: addDays(today, -60),
            }
        default:
            return undefined
    }
}

const COLUMN_ORDERS = {
    program: undefined,
    optionFirst: [ATTRIBUTES.sex, ATTRIBUTES.firstName, ATTRIBUTES.lastName],
    locationFirst: [
        ATTRIBUTES.location,
        ATTRIBUTES.firstName,
        ATTRIBUTES.lastName,
    ],
    idFirst: [ATTRIBUTES.nationalId, ATTRIBUTES.firstName],
}

/** Whether the lab's tracked-entity saved view exists for this config. */
export const hasTrackedEntityView = ({ server }: LabConfig) =>
    server.savedFilter !== 'none' || server.columns !== 'program'

const savedViews = (config: LabConfig, today: string) => {
    const filter = dateFilter(config, today)
    const displayColumnOrder = COLUMN_ORDERS[config.server.columns]
    const eventField =
        config.view.dateField === 'eventOccurredAt'
            ? 'eventOccurredAt'
            : 'eventScheduledAt'
    return {
        trackedEntityInstanceFilters: hasTrackedEntityView(config)
            ? [
                  {
                      id: TE_SAVED_VIEW,
                      displayName: filter
                          ? 'Enrolled in range'
                          : 'Reordered columns',
                      sortOrder: 0,
                      program: { id: LAB_PROGRAM },
                      access: { read: true, update: true, delete: true },
                      entityQueryCriteria: {
                          enrollmentCreatedDate: filter,
                          displayColumnOrder,
                      },
                  },
              ]
            : [],
        programStageWorkingLists: [
            {
                id: EVENT_SAVED_VIEW,
                displayName: 'Follow-up visits',
                sortOrder: 1,
                program: { id: LAB_PROGRAM },
                programStage: { id: LAB_STAGE },
                access: { read: true, update: true, delete: true },
                programStageQueryCriteria: {
                    ...(filter && { [eventField]: filter }),
                    displayColumnOrder,
                },
            },
        ],
    }
}

const dateOf = (stamp?: string) => stamp?.slice(0, 10)

/** Whether `stamp` passes the request's after/before pair, as the server reads it. */
const inWindow = (
    stamp: string | undefined,
    params: Params,
    after: string,
    before: string
) => {
    const start = text(params[after])
    const end = text(params[before])
    if (!start && !end) return true
    // A malformed date is not a date the server could compare, so the lab
    // lets it through to show what the block does with it.
    if (stamp && !/^\d{4}-\d{2}-\d{2}/.test(stamp)) return true
    const date = dateOf(stamp)
    if (!date) return false
    return (!start || date >= start) && (!end || date <= end)
}

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

const attributeValues = (person: LabPerson) =>
    [
        [ATTRIBUTES.firstName, person.firstName],
        [ATTRIBUTES.lastName, person.lastName],
        [ATTRIBUTES.nationalId, person.nationalId],
        [ATTRIBUTES.location, person.location],
        [ATTRIBUTES.sex, person.sex],
    ].flatMap(([attribute, value]) =>
        value === undefined ? [] : [{ attribute, value }]
    )

const trackedEntityJson = (person: LabPerson) => ({
    trackedEntity: person.id,
    trackedEntityType: 'labPersonTy',
    createdAt: '2026-01-01T09:00:00.000',
    updatedAt: '2026-01-01T09:00:00.000',
    inactive: false,
    attributes: attributeValues(person),
    programOwners: [{ orgUnit: LAB_ORG_UNIT, program: LAB_PROGRAM }],
    enrollments: [
        {
            enrollment: `${person.id}En`,
            program: LAB_PROGRAM,
            status: person.enrollmentStatus,
            enrolledAt: person.enrolledAt,
            occurredAt: person.occurredAt,
        },
    ],
})

const eventJson = (person: LabPerson, index: number) => ({
    event: person.visit.id,
    status: person.visit.status,
    program: LAB_PROGRAM,
    programStage: LAB_STAGE,
    enrollment: `${person.id}En`,
    trackedEntity: person.id,
    occurredAt: person.visit.occurredAt,
    scheduledAt: person.visit.scheduledAt,
    createdAt: '2026-01-01T09:00:00.000',
    orgUnit: LAB_ORG_UNIT,
    dataValues: person.visit.occurredAt
        ? [{ dataElement: WEIGHT, value: String(50 + (index % 40)) }]
        : [],
})

const trackedEntities = (
    { server }: LabConfig,
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
    const people =
        server.records === 'ignoresWindow'
            ? world.people
            : world.people.filter(
                  (person) =>
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
              )
    const { items, pager } = page(people, params, server.apiVersion)
    return { trackedEntities: items.map(trackedEntityJson), pager }
}

const events = ({ server }: LabConfig, world: World, params: Params) => {
    const status = text(params.status)
    const people = world.people.filter(
        (person) =>
            (!status || person.visit.status === status) &&
            (server.records === 'ignoresWindow' ||
                (inWindow(
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
                    )))
    )
    const { items, pager } = page(people, params, server.apiVersion)
    return {
        events: items.map((person) =>
            eventJson(person, world.people.indexOf(person))
        ),
        pager,
    }
}

/** What the lab's DHIS2 answers; how slowly, or whether at all, is the lab network's call. */
export const answer = async (
    config: LabConfig,
    world: World,
    request: LabRequest
) => {
    const { server } = config
    const params = request.params ?? {}
    switch (request.resource) {
        case 'system/info':
            return {
                calendar: server.calendar,
                dateFormat: server.dateFormat,
                serverTimeZoneId: server.timeZone,
            }
        case 'programs':
            return request.id ? programJson(config) : { programs: [] }
        case 'trackedEntityInstanceFilters':
            return {
                trackedEntityInstanceFilters: savedViews(config, world.today)
                    .trackedEntityInstanceFilters,
            }
        case 'programStageWorkingLists':
            return {
                programStageWorkingLists: savedViews(config, world.today)
                    .programStageWorkingLists,
            }
        case 'organisationUnits':
            return {
                organisationUnits: [
                    {
                        id: LAB_ORG_UNIT,
                        displayName: 'Lab clinic',
                        path: `/${LAB_ORG_UNIT}`,
                    },
                ],
            }
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
        default:
            break
    }
    return request.resource === 'tracker/events'
        ? events(config, world, params)
        : trackedEntities(config, world, params)
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
