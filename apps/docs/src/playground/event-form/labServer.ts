import { storedDay } from '@/components/dhis2-value-display'
import { z } from 'zod'
import { NAMES } from '../dhis2-value-input/labData'
import { answer as valueInputAnswer } from '../dhis2-value-input/labServer'
import { EXAMPLES, ORG_UNITS, type LabEvent, type LabSettings } from './labData'
import { httpError } from '../network'

/** One request as the block sends it through app-runtime. */
export interface LabRequest {
    resource: string
    id?: string
    params?: { query?: string; fields?: string }
    data?: unknown
}

const STORED_NAMES = new Map(Object.entries(NAMES))

type RequestType = 'read' | 'create' | 'update' | 'replace' | 'delete'

/** Every resource the form asks for: its stage and event, the rules, stored names, searches, uploads and the import. */
export const RESOURCES = [
    'programs',
    'system/info',
    'tracker/events',
    'tracker',
    'tracker/enrollments',
    'programRules',
    'programRuleVariables',
    'constants',
    'me',
    'organisationUnits',
    'userLookup',
    'fileResources',
]

/** The import: with Fails or Hangs the form still loads, and its saves fail or never answer. */
export const RECORDS = ['tracker']

const payloadSchema = z.object({
    events: z
        .array(
            z.looseObject({
                event: z.string(),
                status: z.string().optional(),
                occurredAt: z.string().optional(),
                attributeCategoryOptions: z.string().optional(),
                dataValues: z
                    .array(
                        z.object({
                            dataElement: z.string(),
                            value: z.string().nullable(),
                        })
                    )
                    .default([]),
                notes: z
                    .array(z.object({ note: z.string(), value: z.string() }))
                    .default([]),
            })
        )
        .min(1),
})

const LAB_USER = { username: 'labUser0001', displayName: 'Lab user' }

const storedNow = () => {
    const now = new Date()
    return new Date(now.getTime() - now.getTimezoneOffset() * 60_000)
        .toISOString()
        .slice(0, 23)
}

const uploadSchema = z
    .object({ file: z.instanceof(File) })
    .optional()
    .catch(undefined)

const errorReport = (
    errorCode: string,
    message: string,
    eventId: string,
    args: string[]
) => ({ errorCode, message, trackerType: 'EVENT', uid: eventId, args })

const refused = (errorReports: ReadonlyArray<ReturnType<typeof errorReport>>) =>
    Object.assign(new Error('Conflict'), {
        details: {
            status: 'ERROR',
            validationReport: { errorReports, warningReports: [] },
            stats: { created: 0, updated: 0, deleted: 0, ignored: 1, total: 1 },
        },
    })

const programSchema = z.object({
    displayName: z.string(),
    programStages: z.array(
        z.object({
            id: z.string(),
            blockEntryForm: z.boolean().optional(),
            programStageDataElements: z.array(
                z.object({
                    dataElement: z.object({
                        id: z.string(),
                        optionSet: z.object({ id: z.string() }).optional(),
                    }),
                })
            ),
        })
    ),
    categoryCombo: z
        .object({
            id: z.string(),
            isDefault: z.boolean(),
            categories: z.array(
                z.object({
                    id: z.string(),
                    categoryOptions: z.array(
                        z.object({
                            id: z.string(),
                            displayName: z.string(),
                            access: z.object({
                                data: z.object({ write: z.boolean() }),
                            }),
                            startDate: z.string().optional(),
                            endDate: z.string().optional(),
                        })
                    ),
                })
            ),
        })
        .optional(),
})

type LabProgram = z.infer<typeof programSchema>
type PayloadEvent = z.infer<typeof payloadSchema>['events'][number]

const USER_ARG = 'org.hisp.dhis.user.UserDetailsImpl@1ab0000'
const objectArg = (type: string, uid: string, name: string) =>
    `{"class":"class org.hisp.dhis.${type}", "uid":"${uid}", "name":"${name}"}`

const refusal = (program: LabProgram, event: PayloadEvent) => {
    const optionSets = new Map(
        program.programStages.flatMap(({ programStageDataElements }) =>
            programStageDataElements.flatMap(({ dataElement }) =>
                dataElement.optionSet
                    ? [[dataElement.id, dataElement.optionSet.id]]
                    : []
            )
        )
    )
    const coded = event.dataValues.find(
        ({ dataElement, value }) => value && optionSets.has(dataElement)
    )
    return refused([
        ...(coded?.value
            ? [
                  errorReport(
                      'E1125',
                      `Value \`${coded.value}\` is not a valid option code in OptionSet \`${optionSets.get(coded.dataElement)}\`.`,
                      event.event,
                      [coded.value, optionSets.get(coded.dataElement) ?? '']
                  ),
              ]
            : []),
        errorReport(
            'E1000',
            'User: `labUser0001` has no write access to OrganisationUnit: `labOrgUnit1`.',
            event.event,
            [
                USER_ARG,
                objectArg(
                    'organisationunit.OrganisationUnit',
                    'labOrgUnit1',
                    'Ngelehun CHC'
                ),
            ]
        ),
    ])
}

const completedErrors = (
    program: LabProgram,
    events: Map<string, LabEvent>,
    event: PayloadEvent,
    mayUncomplete: boolean
) => {
    const held = events.get(event.event)
    if (held?.status !== 'COMPLETED') return []
    if (event.status !== 'COMPLETED') {
        return mayUncomplete
            ? []
            : [
                  errorReport(
                      'E1083',
                      'User: `labUser0001`, is not authorized to modify completed events.',
                      event.event,
                      [USER_ARG]
                  ),
              ]
    }
    return program.programStages.find(({ id }) => id === held.programStage)
        ?.blockEntryForm
        ? [
              errorReport(
                  'E1326',
                  `Event \`${event.event}\` is completed and its ProgramStage blocks the entry form after completion. Reopen the Event before updating.`,
                  event.event,
                  [event.event]
              ),
          ]
        : []
}

const categoryErrors = (program: LabProgram, event: PayloadEvent) => {
    const combo = program.categoryCombo
    if (combo === undefined || combo.isDefault) return []
    const given = event.attributeCategoryOptions
    if (!given) {
        return [
            errorReport(
                'E1055',
                'Default AttributeOptionCombo is not allowed as Program has non-default CategoryCombo.',
                event.event,
                []
            ),
        ]
    }
    const ids = given.split(',')
    const options = new Map(
        combo.categories.flatMap(({ id: categoryId, categoryOptions }) =>
            categoryOptions.map((option) => [
                option.id,
                { ...option, categoryId },
            ])
        )
    )
    const unknown = ids.filter((id) => !options.has(id))
    if (unknown.length > 0) {
        return unknown.map((id) =>
            errorReport(
                'E1116',
                `Could not find CategoryOption: \`${id}\`.`,
                event.event,
                [
                    `MetadataIdentifier(idScheme=UID, identifier=${id}, attributeValue=null)`,
                ]
            )
        )
    }
    const covered = new Set(ids.map((id) => options.get(id)?.categoryId))
    if (
        ids.length !== combo.categories.length ||
        combo.categories.some(({ id }) => !covered.has(id))
    ) {
        const listed = `[${ids.join(', ')}]`
        return [
            errorReport(
                'E1117',
                `CategoryOptionCombo not found for CategoryCombo \`${combo.id}\` and CategoryOptions \`${listed}\`.`,
                event.event,
                [objectArg('category.CategoryCombo', combo.id, ''), listed]
            ),
        ]
    }
    const day = storedDay(event.occurredAt ?? '') ?? ''
    return ids.flatMap((id) => {
        const option = options.get(id)
        if (option === undefined) return []
        const name = option.displayName
        if (!option.access.data.write) {
            return [
                errorReport(
                    'E1099',
                    `User: \`labUser0001\` has no write access to CategoryOption: \`${id}\`.`,
                    event.event,
                    [USER_ARG, objectArg('category.CategoryOption', id, name)]
                ),
            ]
        }
        const start = option.startDate && storedDay(option.startDate)
        if (start && day < start) {
            return [
                errorReport(
                    'E1056',
                    `Event date: \`${day}\` is before start date: \`${start}\` for AttributeOption: \`${name}\`.`,
                    event.event,
                    [day, start, name]
                ),
            ]
        }
        const end = option.endDate && storedDay(option.endDate)
        if (end && day > end) {
            return [
                errorReport(
                    'E1057',
                    `Event date: \`${day}\` is after end date: \`${end}\` for AttributeOption: \`${name}\` in Program: \`${program.displayName}\`.`,
                    event.event,
                    [day, end, name, program.displayName]
                ),
            ]
        }
        return []
    })
}

const save = (
    events: Map<string, LabEvent>,
    payload: z.infer<typeof payloadSchema>
) => {
    const stats = { created: 0, updated: 0 }
    for (const { dataValues, geometry, notes, ...rest } of payload.events) {
        const own = geometry ? { ...rest, geometry } : rest
        const held = events.get(own.event)
        if (held === undefined) stats.created++
        else stats.updated++
        const values = new Map(
            [...(held?.dataValues ?? []), ...dataValues].map((each) => [
                each.dataElement,
                each.value,
            ])
        )
        const stored = held?.notes ?? []
        events.set(own.event, {
            ...own,
            dataValues: [...values].flatMap(([dataElement, value]) =>
                value ? [{ dataElement, value }] : []
            ),
            notes: [
                ...stored,
                ...notes
                    .filter(({ note }) =>
                        stored.every((each) => each.note !== note)
                    )
                    .map((note) => ({
                        ...note,
                        storedAt: storedNow(),
                        storedBy: LAB_USER.username,
                        createdBy: { displayName: LAB_USER.displayName },
                    })),
            ],
        })
    }
    return {
        status: 'OK',
        validationReport: { errorReports: [], warningReports: [] },
        stats: {
            ...stats,
            deleted: 0,
            ignored: 0,
            total: stats.created + stats.updated,
        },
    }
}

/**
 * What the lab's DHIS2 answers for one example, from and into `events`, which hold what the form saves until the next
 * run. How slowly, or whether at all, is the lab network's call.
 */
export const answer = (
    settings: Pick<LabSettings, 'example' | 'mayUncomplete'>,
    events: Map<string, LabEvent>
) => {
    const example = EXAMPLES[settings.example]
    const uploads = new Map<string, string>()
    const valueInput = valueInputAnswer(uploads)
    return (request: LabRequest, type: RequestType = 'read') => {
        switch (request.resource) {
            case 'programs':
                if (request.id !== example.programId) {
                    throw httpError(404, `Program ${request.id} not found`)
                }
                return example.program
            case 'system/info':
                return { calendar: 'iso8601', dateFormat: 'yyyy-MM-dd' }
            case 'tracker/events': {
                const event = events.get(request.id ?? '')
                if (event === undefined) {
                    throw httpError(404, `Event ${request.id} not found`)
                }
                return event
            }
            case 'tracker': {
                if (type !== 'create') {
                    throw httpError(405, `The lab does not ${type} tracker`)
                }
                const payload = payloadSchema.parse(request.data)
                const program = programSchema.parse(example.program)
                if (example.refuse) {
                    throw refusal(
                        program,
                        payload.events[0] ?? {
                            event: '',
                            dataValues: [],
                            notes: [],
                        }
                    )
                }
                const errors = payload.events.flatMap((event) => [
                    ...completedErrors(
                        program,
                        events,
                        event,
                        settings.mayUncomplete
                    ),
                    ...categoryErrors(program, event),
                ])
                if (errors.length > 0) {
                    throw refused(errors)
                }
                return save(events, payload)
            }
            case 'tracker/enrollments':
                if (
                    example.enrollment === undefined ||
                    request.id !== example.enrollmentId
                ) {
                    throw httpError(404, `Enrollment ${request.id} not found`)
                }
                return example.enrollment
            case 'programRules':
                if (example.rulesFail) {
                    throw httpError(500, 'Internal server error')
                }
                return example.rules
            case 'programRuleVariables':
                return example.variables
            case 'constants':
                return example.constants
            case 'me':
                return {
                    ...example.me,
                    authorities: settings.mayUncomplete
                        ? ['F_UNCOMPLETE_EVENT']
                        : [],
                }
            case 'fileResources': {
                if (type !== 'read') {
                    return valueInput(
                        { ...request, data: uploadSchema.parse(request.data) },
                        type
                    )
                }
                const name =
                    uploads.get(request.id ?? '') ??
                    STORED_NAMES.get(request.id ?? '')
                if (name === undefined) {
                    throw httpError(404, `File ${request.id} not found`)
                }
                return { id: request.id, name }
            }
            case 'organisationUnits':
                if (request.id !== undefined) {
                    const unit = ORG_UNITS.get(request.id)
                    if (unit === undefined) {
                        throw httpError(404, `Org unit ${request.id} not found`)
                    }
                    const fields = new Set(
                        (request.params?.fields ?? 'path').split(',')
                    )
                    return Object.fromEntries(
                        Object.entries(unit).filter(([field]) =>
                            fields.has(field)
                        )
                    )
                }
                return valueInput({ ...request, data: undefined }, type)
            case 'userLookup':
                return valueInput({ ...request, data: undefined }, type)
            default:
                throw new Error(
                    `The event form lab does not serve ${request.resource}`
                )
        }
    }
}
