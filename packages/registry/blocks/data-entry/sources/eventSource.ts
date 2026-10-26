import type { z } from 'zod'
import { cellKey } from '../model/types'
import type { CellKey, GridColumn, GridRow } from '../model/types'
import {
    EVENT_DATE_COLUMN,
    EVENT_FIELDS,
    PROGRAM_FIELDS,
    eventFormSchema,
} from './eventSchemas'
import type { ProgramStage, TrackerEvent } from './eventSchemas'
import { eventSaver } from './eventSave'
import { completionExpired, expiryStart } from './expiry'
import type { DataEntrySource, LoadedForm, RulesTarget } from './types'

export interface EventSourceOptions {
    programId: string
    programStageId?: string
    orgUnitId: string
    orgUnitMode?: 'SELECTED' | 'DESCENDANTS'
    /** One person's events; with `newRowStageId`, new rows join this enrollment. */
    enrollmentId?: string
    newRowStageId?: string
    /** Default 50. */
    pageSize?: number
    /** Default `occurredAt:desc`. */
    order?: 'occurredAt:asc' | 'occurredAt:desc'
    /** The date (`YYYY-MM-DD`) the expiry rules are checked against; the device's date by default. */
    today?: string
}

const NOT_IN_STAGE = 'Not in this stage'

const READ_ONLY = {
    categories:
        'Programs with attribute categories are not supported in this grid',
    noWrite: 'You do not have access to enter data in this stage',
    skipped: 'Skipped events cannot be edited',
    blocked: 'Completed events in this stage cannot be edited',
    expiredPeriod: 'This event is in an expired period',
    expiredCompletion: 'This event was completed too long ago to edit',
}

type DataElement =
    ProgramStage['programStageDataElements'][number]['dataElement']

/** The device's date as `YYYY-MM-DD`. */
const localToday = () => {
    const now = new Date()
    return new Date(now.getTime() - now.getTimezoneOffset() * 60_000)
        .toISOString()
        .slice(0, 10)
}

const dateOf = (dateTime: string | undefined) => dateTime?.slice(0, 10)

/** The date an event happened or, before it has, the date it is scheduled for. */
const eventDate = ({ occurredAt, scheduledAt }: TrackerEvent) =>
    dateOf(occurredAt ?? scheduledAt)

const toColumn = ({
    id,
    displayFormName,
    valueType,
    fieldMask,
    optionSet,
}: DataElement): GridColumn => ({
    id,
    label: displayFormName,
    field: {
        valueType,
        fieldMask,
        options: optionSet?.options.map(({ code, displayName }) => ({
            code,
            name: displayName,
        })),
    },
})

const toForm = (
    { program, events: { events }, me }: z.infer<typeof eventFormSchema>,
    options: EventSourceOptions,
    today: string
): LoadedForm => {
    const { programStageId, orgUnitId, enrollmentId, newRowStageId } = options
    const orgUnitMode = options.orgUnitMode ?? 'SELECTED'
    const tracker = program.programType === 'WITH_REGISTRATION'
    const stages = program.programStages
    const stageById = new Map(stages.map((stage) => [stage.id, stage]))
    const fieldsOf = new Map(
        stages.map((stage) => [
            stage.id,
            new Set(
                stage.programStageDataElements.map(
                    ({ dataElement }) => dataElement.id
                )
            ),
        ])
    )
    const eventStages = new Set(events.map((event) => event.programStage))

    // The stages the rows belong to; with no rows yet, the stages asked for.
    const used = stages.filter(
        ({ id }) => id === newRowStageId || eventStages.has(id)
    )
    const shown =
        used.length > 0
            ? used
            : stages.filter(
                  ({ id }) =>
                      programStageId === undefined || id === programStageId
              )

    const dataElements = new Map(
        shown.flatMap(({ programStageDataElements }) =>
            programStageDataElements.map(
                ({ dataElement }): [string, DataElement] => [
                    dataElement.id,
                    dataElement,
                ]
            )
        )
    )
    const columns: GridColumn[] = [
        {
            id: EVENT_DATE_COLUMN,
            label: 'Event date',
            field: { valueType: 'DATE' },
        },
        ...Array.from(dataElements.values(), toColumn),
    ]

    const rows: GridRow[] = events.map((event) => {
        const date = eventDate(event)
        const stageName = stageById.get(event.programStage)?.displayName ?? ''
        return {
            id: event.event,
            label:
                date === undefined
                    ? stageName
                    : shown.length > 1
                      ? `${date} · ${stageName}`
                      : date,
            programStageId: event.programStage,
            enrollmentId: tracker ? event.enrollment : undefined,
            orgUnitId: event.orgUnit,
            status: event.status,
        }
    })

    const values = new Map<CellKey, string>()
    const closed = new Map<CellKey, string>()
    for (const event of events) {
        const date = dateOf(event.occurredAt)
        if (date !== undefined) {
            values.set(cellKey(event.event, EVENT_DATE_COLUMN), date)
        }
        for (const { dataElement, value } of event.dataValues) {
            values.set(cellKey(event.event, dataElement), value)
        }
        for (const id of dataElements.keys()) {
            if (!fieldsOf.get(event.programStage)?.has(id)) {
                closed.set(cellKey(event.event, id), NOT_IN_STAGE)
            }
        }
    }

    const has = (authority: string) =>
        me.authorities.includes('ALL') || me.authorities.includes(authority)
    const writable = (stage: ProgramStage | undefined) =>
        program.categoryCombo.isDefault && stage?.access.data.write === true
    const opensOn = expiryStart(
        program.expiryPeriodType,
        program.expiryDays,
        today
    )
    const expiredReason = (event: TrackerEvent) => {
        if (has('F_EDIT_EXPIRED')) {
            return undefined
        }
        const date = eventDate(event)
        if (opensOn !== undefined && date !== undefined && date < opensOn) {
            return READ_ONLY.expiredPeriod
        }
        return completionExpired(
            event.completedAt,
            program.completeEventsExpiryDays,
            today
        )
            ? READ_ONLY.expiredCompletion
            : undefined
    }
    const readOnlyReason = (event: TrackerEvent) => {
        const stage = stageById.get(event.programStage)
        if (!program.categoryCombo.isDefault) {
            return READ_ONLY.categories
        }
        if (!writable(stage)) {
            return READ_ONLY.noWrite
        }
        if (event.status === 'SKIPPED') {
            return READ_ONLY.skipped
        }
        if (event.status === 'COMPLETED' && stage?.blockEntryForm) {
            return READ_ONLY.blocked
        }
        return expiredReason(event)
    }

    const readOnlyRows = new Map<string, string>()
    const canReopen = new Set<string>()
    for (const event of events) {
        const reason = readOnlyReason(event)
        if (reason !== undefined) {
            readOnlyRows.set(event.event, reason)
        }
        if (
            event.status === 'COMPLETED' &&
            has('F_UNCOMPLETE_EVENT') &&
            writable(stageById.get(event.programStage)) &&
            expiredReason(event) === undefined
        ) {
            canReopen.add(event.event)
        }
    }

    /** An event program adds rows at one org unit; a tracker program only for one person, in the stage the host names. */
    const findNewRowStage = () => {
        if (!tracker) {
            return orgUnitMode === 'SELECTED' ? shown.at(0) : undefined
        }
        if (enrollmentId === undefined || newRowStageId === undefined) {
            return undefined
        }
        const stage = stageById.get(newRowStageId)
        // A stage that is not repeatable takes one event per person.
        return stage?.repeatable || !eventStages.has(newRowStageId)
            ? stage
            : undefined
    }
    const newRowStage = findNewRowStage()

    const rules: RulesTarget = {
        programId: program.id,
        programStageIds: shown.map(({ id }) => id),
        tracker,
        // One person's grid names them even before their first event, so a new row's rules see them.
        enrollmentIds: tracker
            ? [
                  ...new Set(
                      [
                          enrollmentId,
                          ...events.map(({ enrollment }) => enrollment),
                      ].filter((id) => id !== undefined)
                  ),
              ]
            : [],
    }

    return {
        tables: [
            {
                id: program.id,
                title:
                    shown.length === 1
                        ? shown[0].displayName
                        : program.displayName,
                rows,
                columns,
                headerRows: [
                    columns.map(({ id, label }) => ({ id, label, span: 1 })),
                ],
                closed,
            },
        ],
        values,
        required: new Map(
            stages.map((stage) => [
                stage.id,
                new Set(
                    stage.programStageDataElements
                        .filter(({ compulsory }) => compulsory)
                        .map(({ dataElement }) => dataElement.id)
                ),
            ])
        ),
        strategy: new Map(
            stages.map((stage) => [stage.id, stage.validationStrategy])
        ),
        readOnlyRows,
        canReopen,
        rules,
        newRows:
            newRowStage !== undefined && writable(newRowStage)
                ? {
                      tableId: program.id,
                      programStageId: newRowStage.id,
                      orgUnitId,
                      enrollmentId: tracker ? enrollmentId : undefined,
                      closedColumns: new Set(
                          Array.from(dataElements.keys()).filter(
                              (id) => !fieldsOf.get(newRowStage.id)?.has(id)
                          )
                      ),
                  }
                : undefined,
    }
}

/** Events of a program as grid rows: the event date, then the data elements of the rows' stages. */
export const eventSource = (options: EventSourceOptions): DataEntrySource => {
    const { programId, programStageId, orgUnitId, enrollmentId } = options
    const orgUnitMode = options.orgUnitMode ?? 'SELECTED'
    // One person's events are read wherever they happened, not only at one org unit.
    const atOrgUnit = enrollmentId === undefined
    const key = `events:${programId}:${programStageId ?? '-'}:${orgUnitId}:${orgUnitMode}:${enrollmentId ?? '-'}`
    const saver = eventSaver(key, programId)
    return {
        key,
        load: async (engine, signal) => {
            const loaded = eventFormSchema.parse(
                await engine.query(
                    {
                        program: {
                            resource: 'programs',
                            id: programId,
                            params: { fields: PROGRAM_FIELDS },
                        },
                        events: {
                            resource: 'tracker/events',
                            params: {
                                program: programId,
                                programStage: programStageId,
                                orgUnit: atOrgUnit ? orgUnitId : undefined,
                                orgUnitMode: atOrgUnit
                                    ? orgUnitMode
                                    : undefined,
                                enrollments: enrollmentId,
                                pageSize: options.pageSize ?? 50,
                                order: options.order ?? 'occurredAt:desc',
                                fields: EVENT_FIELDS,
                            },
                        },
                        me: {
                            resource: 'me',
                            params: { fields: 'id,authorities' },
                        },
                    },
                    { signal }
                )
            )
            saver.remember(loaded.events.events.map(({ event }) => event))
            return toForm(loaded, options, options.today ?? localToday())
        },
        save: saver.save,
        setStatus: saver.setStatus,
        restoreRows: saver.restoreRows,
    }
}
