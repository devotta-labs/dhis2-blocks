import i18n from '@dhis2/d2-i18n'
import { z } from 'zod'
import type { Field } from '@/components/dhis2-value-types'
import { cellKey } from '../model/types'
import type {
    CellKey,
    DataRecord,
    EnrollmentRecord,
    GridRow,
    PersonRecord,
} from '../model/types'
import { blockedReason, eventEditRules } from '../sources/eventEdit'
import { EVENT_DATE_COLUMN, eventSchema } from '../sources/eventSchemas'
import type { DataEngine, LoadedForm, RulesTarget } from '../sources/types'
import type { CompiledLayout } from './compileLayout'
import type { RegisterLayout } from './layout'
import { REGISTER_PROGRAM_FIELDS } from './metadata'
import type { RegisterMetadata } from './metadata'
import { nameOf, personRow } from './newPerson'
import { fillSlots } from './slots'

/** What a register shows of an enrolment: its dates and status, its person's attributes, its events. */
export const ENROLLMENT_FIELDS =
    'enrollment,trackedEntity,orgUnit,enrolledAt,occurredAt,status,attributes[attribute,value],events[event,enrollment,programStage,orgUnit,occurredAt,scheduledAt,completedAt,status,dataValues[dataElement,value]]'

/** The enrolment date's field: its cells are `<enrolment>.enrolledAt`. */
export const ENROLLED_AT = 'enrolledAt'

// Translated when used, so the reasons follow the user's language.
export const READ_ONLY = {
    program: () =>
        i18n.t('You do not have access to enter data in this program'),
    people: () =>
        i18n.t('You do not have access to change people of this type'),
    cancelled: () => i18n.t('This enrolment is cancelled'),
}

const dataWrite = z.object({ data: z.object({ write: z.boolean() }) })

/** What the edit rules read of the program, from the same answer as its metadata. */
export const programEditSchema = z.object({
    access: dataWrite,
    categoryCombo: z.object({ isDefault: z.boolean() }),
    expiryPeriodType: z.string().optional(),
    expiryDays: z.number().optional(),
    completeEventsExpiryDays: z.number().optional(),
    trackedEntityType: z.object({ access: dataWrite }),
    programStages: z.array(
        z.object({
            id: z.string(),
            blockEntryForm: z.boolean(),
            access: dataWrite,
            programStageSections: z
                .array(
                    z.object({
                        id: z.string(),
                        dataElements: z.array(z.object({ id: z.string() })),
                    })
                )
                .default([]),
        })
    ),
})

const enrollmentSchema = z.object({
    enrollment: z.string(),
    trackedEntity: z.string(),
    orgUnit: z.string(),
    enrolledAt: z.string(),
    occurredAt: z.string().optional(),
    status: z.enum(['ACTIVE', 'COMPLETED', 'CANCELLED']),
    attributes: z
        .array(z.object({ attribute: z.string(), value: z.string() }))
        .default([]),
    events: z.array(eventSchema).default([]),
})

/** One page of enrolments, the user's authorities and the server's calendar, as the register's query returns them. */
export const registerAnswerSchema = z.object({
    enrollments: z.object({ enrollments: z.array(enrollmentSchema) }),
    me: z.object({ authorities: z.array(z.string()) }),
    systemInfo: z.object({ calendar: z.string().optional() }),
})

/**
 * The register's query: the program, a page of its enrolments at the org unit in the period, oldest first, and the
 * user's authorities; the server's calendar when `withCalendar`.
 */
export const registerQuery = (
    options: {
        programId: string
        orgUnitId: string
        enrolledFrom: string
        enrolledTo: string
    },
    pageSize: number,
    page: number | undefined,
    withCalendar: boolean
): Parameters<DataEngine['query']>[0] => ({
    program: {
        resource: 'programs',
        id: options.programId,
        params: { fields: REGISTER_PROGRAM_FIELDS },
    },
    enrollments: {
        resource: 'tracker/enrollments',
        params: {
            program: options.programId,
            orgUnits: options.orgUnitId,
            orgUnitMode: 'SELECTED',
            enrolledAfter: options.enrolledFrom,
            enrolledBefore: options.enrolledTo,
            order: 'enrolledAt:asc',
            pageSize,
            page,
            fields: ENROLLMENT_FIELDS,
        },
    },
    me: { resource: 'me', params: { fields: 'id,authorities' } },
    ...(withCalendar && {
        systemInfo: { resource: 'system/info', params: { fields: 'calendar' } },
    }),
})

const dateOf = (dateTime: string | undefined) => dateTime?.slice(0, 10)

/** Every field of every form a register's records use, by id, with its name: dates, attributes, data elements. */
const fieldsOf = (metadata: RegisterMetadata) => {
    const fields = new Map<string, { field: Field; name: string }>([
        [
            EVENT_DATE_COLUMN,
            { field: { valueType: 'DATE' }, name: i18n.t('Event date') },
        ],
        [
            ENROLLED_AT,
            { field: { valueType: 'DATE' }, name: metadata.enrolmentDateName },
        ],
    ])
    // The incident date is the enrolment's `occurredAt`, which shares the event date's id.
    if (metadata.incidentDate !== undefined) {
        fields.set(EVENT_DATE_COLUMN, {
            field: { valueType: 'DATE' },
            name: metadata.incidentDate.name,
        })
    }
    for (const [id, { field, name }] of metadata.attributes) {
        fields.set(id, { field, name })
    }
    for (const stage of metadata.stages.values()) {
        for (const [id, { field, name }] of stage.dataElements) {
            fields.set(id, { field, name })
        }
    }
    return fields
}

/**
 * One page of a register as the grid's form: a row per enrolment, its slots filled from its events, an empty slot's
 * event made new, and why each record is read-only. Names and paging are the source's.
 */
export const toForm = (
    {
        enrollments: { enrollments },
        me,
        systemInfo,
    }: z.infer<typeof registerAnswerSchema>,
    program: z.infer<typeof programEditSchema>,
    metadata: RegisterMetadata,
    compiled: CompiledLayout,
    {
        layout,
        today,
        hasRules,
    }: {
        layout: RegisterLayout
        today: string
        hasRules: boolean
    }
): Omit<LoadedForm, 'orgUnitNames' | 'fileNames' | 'hasMore' | 'newRows'> => {
    const { programId, trackedEntityTypeId } = metadata
    const stageEdit = new Map(
        program.programStages.map((stage) => [stage.id, stage])
    )
    const { has, readOnlyReason, mayReopen } = eventEditRules({
        program,
        stages: stageEdit,
        authorities: me.authorities,
        calendar: systemInfo.calendar,
        today,
    })
    const programReason = program.access.data.write
        ? undefined
        : READ_ONLY.program()
    const personReason = program.trackedEntityType.access.data.write
        ? undefined
        : READ_ONLY.people()
    const incident = metadata.incidentDate !== undefined

    const rows: GridRow[] = []
    const values = new Map<CellKey, string>()
    const records = new Map<string, DataRecord>()
    const readOnlyRecords = new Map<string, string>()
    const canReopen = new Set<string>()
    const rowNotes = new Map<string, string[]>()
    for (const enrolled of enrollments) {
        const person: PersonRecord = {
            kind: 'trackedEntity',
            id: enrolled.trackedEntity,
            trackedEntityTypeId,
            orgUnitId: enrolled.orgUnit,
        }
        const enrollment: EnrollmentRecord = {
            kind: 'enrollment',
            id: enrolled.enrollment,
            programId,
            trackedEntityId: person.id,
            orgUnitId: enrolled.orgUnit,
            status: enrolled.status,
        }
        for (const { attribute, value } of enrolled.attributes) {
            values.set(cellKey(person.id, attribute), value)
        }
        const enrolledAt = enrolled.enrolledAt.slice(0, 10)
        values.set(cellKey(enrollment.id, ENROLLED_AT), enrolledAt)
        const incidentDate = dateOf(enrolled.occurredAt)
        if (incident && incidentDate !== undefined) {
            values.set(cellKey(enrollment.id, EVENT_DATE_COLUMN), incidentDate)
        }

        const byId = new Map(
            enrolled.events.map((event) => [event.event, event])
        )
        const { bySlot, notes } = fillSlots(
            enrolled.events.map((event) => ({
                id: event.event,
                programStage: event.programStage,
                occurredAt: event.occurredAt,
                scheduledAt: event.scheduledAt,
                values: Object.fromEntries(
                    event.dataValues.map(({ dataElement, value }) => [
                        dataElement,
                        value,
                    ])
                ),
            })),
            compiled.slots
        )
        if (notes.length > 0) {
            rowNotes.set(enrollment.id, notes)
        }
        const rowReason =
            programReason ??
            (enrolled.status === 'CANCELLED'
                ? READ_ONLY.cancelled()
                : undefined)
        const { row, records: rowRecords } = personRow(
            compiled,
            person,
            enrollment,
            (slot) => {
                const event = byId.get(bySlot.get(slot.name) ?? '')
                if (event === undefined) {
                    return undefined
                }
                const date = dateOf(event.occurredAt)
                if (date !== undefined) {
                    values.set(cellKey(event.event, EVENT_DATE_COLUMN), date)
                }
                for (const { dataElement, value } of event.dataValues) {
                    values.set(cellKey(event.event, dataElement), value)
                }
                if (mayReopen(event)) {
                    canReopen.add(event.event)
                }
                return {
                    kind: 'event',
                    id: event.event,
                    programStageId: event.programStage,
                    orgUnitId: event.orgUnit,
                    enrollmentId: enrollment.id,
                    status: event.status,
                    ...(date === undefined && {
                        scheduledAt: dateOf(event.scheduledAt),
                    }),
                    slot: slot.name,
                }
            },
            ''
        )
        // Named by its label cells, else by its enrolment date.
        rows.push({
            ...row,
            label: nameOf(row, (key) => values.get(key)) || enrolledAt,
        })
        for (const record of rowRecords) {
            records.set(record.id, record)
            const reason =
                rowReason ??
                (record.kind === 'trackedEntity' ? personReason : undefined) ??
                (record.kind === 'event'
                    ? readOnlyReason(
                          byId.get(record.id) ?? {
                              programStage: record.programStageId,
                              status: record.status,
                          }
                      )
                    : undefined)
            if (reason !== undefined) {
                readOnlyRecords.set(record.id, reason)
            }
        }
    }

    const fields = fieldsOf(metadata)
    const stages = [...metadata.stages]
    const attributes = [...metadata.attributes]
    const eventStages = [
        ...new Set(compiled.slots.flatMap(({ stageId }) => stageId ?? [])),
    ]
    const rules: RulesTarget = {
        programId,
        programStageIds: eventStages,
        tracker: true,
        enrollmentIds: enrollments.map(({ enrollment }) => enrollment),
        hasRules,
    }
    return {
        tables: [
            {
                id: programId,
                title: layout.title ?? metadata.programName,
                rows,
                columns: compiled.columns,
                headerRows: compiled.headerRows,
                closed: new Map(),
            },
        ],
        values,
        records,
        fields: new Map([...fields].map(([id, { field }]) => [id, field])),
        fieldNames: new Map([...fields].map(([id, { name }]) => [id, name])),
        fieldsByForm: new Map<string, ReadonlySet<string>>([
            [trackedEntityTypeId, new Set(attributes.map(([id]) => id))],
            [
                programId,
                new Set([
                    ENROLLED_AT,
                    ...(incident ? [EVENT_DATE_COLUMN] : []),
                ]),
            ],
            ...stages.map(([id, stage]): [string, ReadonlySet<string>] => [
                id,
                new Set(stage.dataElements.keys()),
            ]),
        ]),
        required: new Map<string, ReadonlySet<string>>([
            [
                trackedEntityTypeId,
                new Set(
                    attributes
                        .filter(([, { mandatory }]) => mandatory)
                        .map(([id]) => id)
                ),
            ],
            [programId, new Set([ENROLLED_AT])],
            ...stages.map(([id, stage]): [string, ReadonlySet<string>] => [
                id,
                new Set(
                    [...stage.dataElements]
                        .filter(([, { compulsory }]) => compulsory)
                        .map(([dataElement]) => dataElement)
                ),
            ]),
        ]),
        strategy: new Map(
            stages.map(([id, stage]) => [id, stage.validationStrategy])
        ),
        sections: new Map(
            program.programStages.map(({ id, programStageSections }) => [
                id,
                new Map(
                    programStageSections.map((section) => [
                        section.id,
                        section.dataElements.map(
                            (dataElement) => dataElement.id
                        ),
                    ])
                ),
            ])
        ),
        readOnlyRecords,
        canReopen,
        readOnlyWhenCompleted: new Map(
            program.programStages
                .filter(({ blockEntryForm }) => blockEntryForm)
                .map(({ id }) => [id, blockedReason()])
        ),
        mayUncomplete: has('F_UNCOMPLETE_EVENT'),
        rules,
        rowKind: 'person',
        rowNotes,
    }
}
