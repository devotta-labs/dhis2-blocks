import i18n from '@dhis2/d2-i18n'
import type { z } from 'zod'
import { checkStored } from '@/components/dhis2-value-types'
import type { Field } from '@/components/dhis2-value-types'
import { cellKey } from '../model/types'
import type { CellKey, GridColumn, GridRow } from '../model/types'
import {
    EVENT_DATE_COLUMN,
    EVENT_FIELDS,
    PROGRAM_FIELDS,
    eventFormSchema,
    fileNamesSchema,
    orgUnitNamesSchema,
} from './eventSchemas'
import type { ProgramStage, TrackerEvent } from './eventSchemas'
import { eventSaver } from './eventSave'
import { completionExpired, expiryStart, localToday } from './expiry'
import type {
    DataEngine,
    DataEntrySource,
    LoadedForm,
    RulesTarget,
} from './types'

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

// Translated when used, so the reasons follow the user's language.
const READ_ONLY = {
    categories: () =>
        i18n.t(
            'Programs with attribute categories are not supported in this grid'
        ),
    noWrite: () => i18n.t('You do not have access to enter data in this stage'),
    skipped: () => i18n.t('Skipped events cannot be edited'),
    blocked: () => i18n.t('Completed events in this stage cannot be edited'),
    expiredPeriod: () => i18n.t('This event is in an expired period'),
    expiredCompletion: () =>
        i18n.t('This event was completed too long ago to edit'),
}

// An org unit value is its id, and so is a file's: both are DHIS2 ids.
const ORG_UNIT: Field = { valueType: 'ORGANISATION_UNIT' }
const ORG_UNIT_TYPES: ReadonlySet<string> = new Set([ORG_UNIT.valueType])
const FILE_TYPES: ReadonlySet<string> = new Set(['FILE_RESOURCE', 'IMAGE'])
// The most ids one names request lists: DHIS2 refuses a URL much longer.
const IDS_PER_REQUEST = 200

type DataElement =
    ProgramStage['programStageDataElements'][number]['dataElement']

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
): Omit<LoadedForm, 'orgUnitNames' | 'fileNames' | 'hasMore'> => {
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
    // Every stage's fields, not only the columns shown: a page may bring another stage's.
    const allFields = [
        ...new Set([...fieldsOf.values()].flatMap((ids) => [...ids])),
    ]

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
            label: i18n.t('Event date'),
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
            stage: shown.length > 1 ? stageName : undefined,
            scheduledAt:
                event.occurredAt === undefined
                    ? dateOf(event.scheduledAt)
                    : undefined,
            programStageId: event.programStage,
            enrollmentId: tracker ? event.enrollment : undefined,
            orgUnitId: event.orgUnit,
            status: event.status,
        }
    })

    const values = new Map<CellKey, string>()
    const closed = new Map<CellKey, string>()
    const notInStage = i18n.t('Not in this stage')
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
                closed.set(cellKey(event.event, id), notInStage)
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
            return READ_ONLY.expiredPeriod()
        }
        return completionExpired(
            event.completedAt,
            program.completeEventsExpiryDays,
            today
        )
            ? READ_ONLY.expiredCompletion()
            : undefined
    }
    const readOnlyReason = (event: TrackerEvent) => {
        const stage = stageById.get(event.programStage)
        if (!program.categoryCombo.isDefault) {
            return READ_ONLY.categories()
        }
        if (!writable(stage)) {
            return READ_ONLY.noWrite()
        }
        if (event.status === 'SKIPPED') {
            return READ_ONLY.skipped()
        }
        if (event.status === 'COMPLETED' && stage?.blockEntryForm) {
            return READ_ONLY.blocked()
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
        sections: new Map(
            stages.map((stage) => [
                stage.id,
                new Map(
                    stage.programStageSections.map(({ id, dataElements }) => [
                        id,
                        dataElements.map((dataElement) => dataElement.id),
                    ])
                ),
            ])
        ),
        readOnlyRows,
        canReopen,
        readOnlyWhenCompleted: new Map(
            stages
                .filter(({ blockEntryForm }) => blockEntryForm)
                .map(({ id }) => [id, READ_ONLY.blocked()])
        ),
        mayUncomplete: has('F_UNCOMPLETE_EVENT'),
        rules,
        newRows:
            newRowStage !== undefined && writable(newRowStage)
                ? {
                      tableId: program.id,
                      programStageId: newRowStage.id,
                      orgUnitId,
                      enrollmentId: tracker ? enrollmentId : undefined,
                      stage:
                          shown.length > 1
                              ? newRowStage.displayName
                              : undefined,
                  }
                : undefined,
        closedByStage: new Map(
            stages.map(({ id: stage }) => [
                stage,
                new Set(
                    allFields.filter((id) => !fieldsOf.get(stage)?.has(id))
                ),
            ])
        ),
    }
}

/**
 * The names of the ids the columns of these value types hold, 200 ids a request, sent together; none is made when they
 * hold none, and a value that is no id is not asked for. Names only help: a request that fails leaves its ids without
 * names, which the cells then show, and only an abort of the load stops it.
 */
const loadNames = async (
    { tables, values }: Pick<LoadedForm, 'tables' | 'values'>,
    valueTypes: ReadonlySet<string>,
    nameSome: (
        some: ReadonlyArray<string>
    ) => Promise<ReadonlyArray<[string, string]>>,
    signal?: AbortSignal
): Promise<ReadonlyMap<string, string>> => {
    const ids = new Set<string>()
    for (const { rows, columns } of tables) {
        for (const { id: column, field } of columns) {
            if (!valueTypes.has(field.valueType)) {
                continue
            }
            for (const { id: row } of rows) {
                const value = values.get(cellKey(row, column))
                if (
                    value !== undefined &&
                    checkStored(ORG_UNIT, value) === undefined
                ) {
                    ids.add(value)
                }
            }
        }
    }
    const list = [...ids]
    const answers = await Promise.all(
        Array.from(
            { length: Math.ceil(list.length / IDS_PER_REQUEST) },
            (_, at) =>
                nameSome(
                    list.slice(at * IDS_PER_REQUEST, (at + 1) * IDS_PER_REQUEST)
                ).catch((error: Error) => {
                    if (signal?.aborted) {
                        throw error
                    }
                    return []
                })
        )
    )
    return new Map(answers.flat())
}

/** The names of the org units and the files the form's values hold, asked for together. */
const loadNamesOf = (
    engine: DataEngine,
    form: Pick<LoadedForm, 'tables' | 'values'>,
    signal?: AbortSignal
) =>
    Promise.all([
        loadNames(
            form,
            ORG_UNIT_TYPES,
            async (some) =>
                orgUnitNamesSchema
                    .parse(
                        await engine.query(
                            {
                                orgUnits: {
                                    resource: 'organisationUnits',
                                    params: {
                                        filter: `id:in:[${some.join(',')}]`,
                                        fields: 'id,displayName',
                                        paging: false,
                                    },
                                },
                            },
                            { signal }
                        )
                    )
                    .orgUnits.organisationUnits.map(
                        ({ id, displayName }): [string, string] => [
                            id,
                            displayName,
                        ]
                    ),
            signal
        ),
        loadNames(
            form,
            FILE_TYPES,
            async (some) =>
                fileNamesSchema
                    .parse(
                        await engine.query(
                            {
                                files: {
                                    resource: 'fileResources',
                                    params: {
                                        filter: `id:in:[${some.join(',')}]`,
                                        fields: 'id,name',
                                        paging: false,
                                    },
                                },
                            },
                            { signal }
                        )
                    )
                    .files.fileResources.map(
                        ({ id, name }): [string, string] => [id, name]
                    ),
            signal
        ),
    ])

/** Events of a program as grid rows: the event date, then the data elements of the rows' stages. */
export const eventSource = (options: EventSourceOptions): DataEntrySource => {
    const { programId, programStageId, orgUnitId, enrollmentId } = options
    const orgUnitMode = options.orgUnitMode ?? 'SELECTED'
    // One person's events are read wherever they happened, not only at one org unit.
    const atOrgUnit = enrollmentId === undefined
    // Unsent changes belong to the program, so any of its grids sends them, wherever they were made.
    const key = `events:${programId}`
    const pageSize = options.pageSize ?? 50
    const order = options.order ?? 'occurredAt:desc'
    const saver = eventSaver(key, programId)
    /** One page of the events, page 1 unless named, with the names of what its values hold. */
    const loadEvents = async (
        engine: DataEngine,
        page: number | undefined,
        signal?: AbortSignal
    ): Promise<LoadedForm> => {
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
                            orgUnitMode: atOrgUnit ? orgUnitMode : undefined,
                            enrollments: enrollmentId,
                            pageSize,
                            page,
                            order,
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
        const form = toForm(loaded, options, options.today ?? localToday())
        // Asked once the values are known: cells show org units and files by name.
        const [orgUnitNames, fileNames] = await loadNamesOf(
            engine,
            form,
            signal
        )
        // No total is asked for: counting costs DHIS2 a query on large databases.
        const hasMore = loaded.events.events.length === pageSize
        return { ...form, orgUnitNames, fileNames, hasMore }
    }
    return {
        key,
        // Everything that changes the load; the outbox keeps the program's one key, so no change is stranded.
        cacheKey: [
            key,
            programStageId ?? '-',
            orgUnitId,
            orgUnitMode,
            enrollmentId ?? '-',
            pageSize,
            order,
            options.newRowStageId ?? '-',
            options.today ?? '-',
        ].join(':'),
        load: (engine, signal) => loadEvents(engine, undefined, signal),
        loadPage: loadEvents,
        save: saver.save,
        setStatus: saver.setStatus,
        restoreRows: saver.restoreRows,
    }
}
