import i18n from '@dhis2/d2-i18n'
import { cellKey } from '../model/types'
import inpatientEvents from './__tests__/fixtures/inpatient-events.json'
import inpatientProgram from './__tests__/fixtures/inpatient-program.json'
import meAdmin from './__tests__/fixtures/me-admin.json'
import rmnchEvents from './__tests__/fixtures/rmnch-person-events.json'
import rmnchProgram from './__tests__/fixtures/rmnch-program.json'
import { EVENT_DATE_COLUMN } from './eventSchemas'
import { eventSource } from './eventSource'
import type { EventSourceOptions } from './eventSource'
import type { DataEngine } from './types'

const TODAY = '2026-10-26'
const INPATIENT = 'eBAyeGv0exc'
const INPATIENT_STAGE = 'Zj7UnCAulEk'
const NGELEHUN = 'DiszpKrYNg8'
const RMNCH = 'WSGAb5XwJ3Y'
const PERSON = 'PE6abx7Zhn0'
const PERSON_ORG_UNIT = 'm7fBMpmVpSM'
const FIRST_VISIT = 'WZbXY0S00lP'
const SECOND_VISIT = 'edqlbukwRfQ'
const PREVIOUS_DELIVERIES = 'PUZaKR0Jh2k'
const INPATIENT_ROWS = [
    'NGxc7JpmqqD',
    'wAiGPfJGMxt',
    'yAjWsWh1bs0',
    'PpNGhvEYnXe',
    'Ee4LATq5pF3',
]

type Request = Parameters<DataEngine['query']>[0]
type Stage = (typeof inpatientProgram)['programStages'][number]
// The inpatient events were never scheduled, so their type lacks `scheduledAt`.
type Event = (typeof inpatientEvents)['events'][number] & {
    scheduledAt: string
}

const engineFor = <P, E, M>(program: P, events: E, me: M) => {
    const requests: Request[] = []
    // SAFETY: loading only calls `query`, which answers every request from the fixtures.
    const engine = {
        query: async (request: Request) => {
            requests.push(request)
            return { program, events, me }
        },
    } as DataEngine
    return { engine, requests }
}

const inpatient = (options: Partial<EventSourceOptions> = {}) =>
    eventSource({
        programId: INPATIENT,
        orgUnitId: NGELEHUN,
        today: TODAY,
        ...options,
    })

const person = (options: Partial<EventSourceOptions> = {}) =>
    eventSource({
        programId: RMNCH,
        orgUnitId: PERSON_ORG_UNIT,
        enrollmentId: PERSON,
        order: 'occurredAt:asc',
        today: TODAY,
        ...options,
    })

const loadInpatient = <P, E, M>(
    program: P,
    events: E,
    me: M,
    options: Partial<EventSourceOptions> = {}
) => inpatient(options).load(engineFor(program, events, me).engine)

const withStage = (edit: Partial<Stage>) => ({
    ...inpatientProgram,
    programStages: inpatientProgram.programStages.map((stage) => ({
        ...stage,
        ...edit,
    })),
})

const withEvent = (index: number, edit: Partial<Event>) => ({
    ...inpatientEvents,
    events: inpatientEvents.events.map((event, at) =>
        at === index ? { ...event, ...edit } : event
    ),
})

const withAuthorities = (authorities: string[]) => ({ ...meAdmin, authorities })

test('columns are the event date, then the stage’s data elements', async () => {
    const { engine, requests } = engineFor(
        inpatientProgram,
        inpatientEvents,
        meAdmin
    )
    const form = await inpatient().load(engine)
    expect(requests[0].events.params).toEqual({
        program: INPATIENT,
        orgUnit: NGELEHUN,
        orgUnitMode: 'SELECTED',
        pageSize: 50,
        order: 'occurredAt:desc',
        fields: expect.stringContaining('scheduledAt'),
    })
    expect(requests[0].me).toEqual({
        resource: 'me',
        params: { fields: 'id,authorities' },
    })
    expect(form.tables).toHaveLength(1)
    const [table] = form.tables
    const stage = inpatientProgram.programStages[0]

    expect(table.columns[0]).toMatchObject({
        id: EVENT_DATE_COLUMN,
        field: { valueType: 'DATE' },
    })
    expect(table.columns.slice(1).map(({ id }) => id)).toEqual(
        stage.programStageDataElements.map(({ dataElement }) => dataElement.id)
    )
    expect(table.columns).toHaveLength(13)
    expect(table.columns[1]).toEqual({
        id: 'oZg33kd9taw',
        label: 'Gender',
        field: {
            valueType: 'TEXT',
            options: [
                { code: 'Male', name: 'Male' },
                { code: 'Female', name: 'Female' },
            ],
        },
    })
    expect(table.headerRows).toEqual([
        table.columns.map(({ id, label }) => ({ id, label, span: 1 })),
    ])
    expect(table.rows.map(({ label }) => label)).toEqual([
        '2026-12-25',
        '2026-12-18',
        '2026-12-16',
        '2026-12-13',
        '2026-12-03',
    ])
    expect(table.closed.size).toBe(0)
    expect(form.values.get(cellKey('NGxc7JpmqqD', EVENT_DATE_COLUMN))).toBe(
        '2026-12-25'
    )
})

test('event-program rows carry no enrollment', async () => {
    const form = await loadInpatient(inpatientProgram, inpatientEvents, meAdmin)
    const [table] = form.tables

    expect(table.rows[0]).toEqual({
        id: 'NGxc7JpmqqD',
        label: '2026-12-25',
        programStageId: INPATIENT_STAGE,
        orgUnitId: NGELEHUN,
        status: 'COMPLETED',
    })
    expect(table.rows.map(({ enrollmentId }) => enrollmentId)).toEqual(
        INPATIENT_ROWS.map(() => undefined)
    )
    expect(form.rules).toEqual({
        programId: INPATIENT,
        programStageIds: [INPATIENT_STAGE],
        tracker: false,
        enrollmentIds: [],
    })
})

test('the reason a cell is closed is translated', async () => {
    i18n.addResources('xx', 'translation', {
        'Not in this stage': 'Pas dans cette étape',
    })
    await i18n.changeLanguage('xx')
    try {
        const { engine } = engineFor(rmnchProgram, rmnchEvents, meAdmin)
        const [table] = (await person().load(engine)).tables
        expect(table.closed.get(cellKey('yDPqyTvcRpA', 'de0FEHSIoxh'))).toBe(
            'Pas dans cette étape'
        )
    } finally {
        await i18n.changeLanguage('en')
    }
})

test('one person’s events across stages share one table with "Not in this stage" cells', async () => {
    const { engine, requests } = engineFor(rmnchProgram, rmnchEvents, meAdmin)
    const form = await person().load(engine)
    expect(form.tables).toHaveLength(1)
    const [table] = form.tables
    const shown = [FIRST_VISIT, SECOND_VISIT, 'PFDfvmGpsR3', 'bbKtnxRZKEP']
    const union = new Set(
        rmnchProgram.programStages
            .filter(({ id }) => shown.includes(id))
            .flatMap(({ programStageDataElements }) =>
                programStageDataElements.map(
                    ({ dataElement }) => dataElement.id
                )
            )
    )

    expect(table.rows).toHaveLength(8)
    expect(table.rows[1]).toEqual({
        id: 'yDPqyTvcRpA',
        label: '2026-04-14 · Second antenatal care visit',
        programStageId: SECOND_VISIT,
        enrollmentId: PERSON,
        orgUnitId: PERSON_ORG_UNIT,
        status: 'ACTIVE',
    })
    expect(table.columns.map(({ id }) => id)).toEqual([
        EVENT_DATE_COLUMN,
        ...union,
    ])
    // A stage the person has no event in adds no columns.
    expect(table.columns.map(({ id }) => id)).not.toContain('mrVkW9h2Rdp')
    expect(table.closed.get(cellKey('yDPqyTvcRpA', 'de0FEHSIoxh'))).toBe(
        'Not in this stage'
    )
    expect(table.closed.has(cellKey('Evahwp3zrQ4', 'de0FEHSIoxh'))).toBe(false)
    expect(table.closed.has(cellKey('yDPqyTvcRpA', EVENT_DATE_COLUMN))).toBe(
        false
    )
    expect(form.rules).toEqual({
        programId: RMNCH,
        programStageIds: shown,
        tracker: true,
        enrollmentIds: [PERSON],
    })
    // One person's events wherever they happened, not only at one org unit.
    expect(requests[0].events.params).toMatchObject({
        program: RMNCH,
        enrollments: PERSON,
        orgUnit: undefined,
        order: 'occurredAt:asc',
    })
})

test('reads values and required fields per stage', async () => {
    const personForm = await person().load(
        engineFor(rmnchProgram, rmnchEvents, meAdmin).engine
    )
    expect(personForm.values.get(cellKey('Evahwp3zrQ4', 'de0FEHSIoxh'))).toBe(
        'false'
    )
    expect(personForm.strategy.get(SECOND_VISIT)).toBe('ON_COMPLETE')

    const form = await loadInpatient(inpatientProgram, inpatientEvents, meAdmin)
    expect(form.required.get(INPATIENT_STAGE)).toEqual(
        new Set(['eMyVanycQSC', 'msodh3rEMJa', 'fWIAEtYVEGk', 'K6uUAvq500H'])
    )
    expect(form.strategy.get(INPATIENT_STAGE)).toBe('ON_UPDATE_AND_INSERT')
})

test('reads each stage’s sections with their data elements', async () => {
    const form = await loadInpatient(inpatientProgram, inpatientEvents, meAdmin)
    expect(form.sections.get(INPATIENT_STAGE)).toEqual(
        new Map([
            [
                'd7ZILSbPgYh',
                [
                    'oZg33kd9taw',
                    'SWfdB5lX0fk',
                    'qrur9Dvnyt5',
                    'GieVkTxp4HH',
                    'vV9UWAZohSf',
                ],
            ],
            [
                'OeSqs7pkKqI',
                [
                    'eMyVanycQSC',
                    'K6uUAvq500H',
                    'msodh3rEMJa',
                    'S33cRBsnXPo',
                    'fWIAEtYVEGk',
                    'ulD2zW0TIy2',
                ],
            ],
        ])
    )

    const personForm = await person().load(
        engineFor(rmnchProgram, rmnchEvents, meAdmin).engine
    )
    expect(personForm.sections.get(PREVIOUS_DELIVERIES)).toEqual(new Map())
    expect(personForm.sections.get(FIRST_VISIT)?.get('AyWdV7K24Ih')).toEqual([
        'dpiyZz8bkVE',
        'a7XjFEuZuKE',
        'X8HbdaoS9LN',
        'vANAXwtLwcT',
        'Itl05OEupgQ',
        'AAaJGnWR5js',
    ])
})

test('new rows: one org unit for event programs, a named stage for one person', async () => {
    const selected = await loadInpatient(
        inpatientProgram,
        inpatientEvents,
        meAdmin
    )
    expect(selected.newRows).toEqual({
        tableId: selected.tables[0].id,
        programStageId: INPATIENT_STAGE,
        orgUnitId: NGELEHUN,
        closedColumns: new Set(),
    })
    const descendants = await loadInpatient(
        inpatientProgram,
        inpatientEvents,
        meAdmin,
        { orgUnitMode: 'DESCENDANTS' }
    )
    expect(descendants.newRows).toBeUndefined()

    const personLoad = (options: Partial<EventSourceOptions>) =>
        person(options).load(
            engineFor(rmnchProgram, rmnchEvents, meAdmin).engine
        )
    const repeatable = await personLoad({ newRowStageId: SECOND_VISIT })
    expect(repeatable.newRows).toMatchObject({
        tableId: repeatable.tables[0].id,
        programStageId: SECOND_VISIT,
        orgUnitId: PERSON_ORG_UNIT,
        enrollmentId: PERSON,
    })
    // First visit only; in both visits; the event date.
    const closedColumns = repeatable.newRows?.closedColumns
    expect(closedColumns?.has('de0FEHSIoxh')).toBe(true)
    expect(closedColumns?.has('roKuXYfw1BW')).toBe(false)
    expect(closedColumns?.has(EVENT_DATE_COLUMN)).toBe(false)
    expect((await personLoad({})).newRows).toBeUndefined()
    // A stage that is not repeatable takes one event per person.
    expect(
        (await personLoad({ newRowStageId: FIRST_VISIT })).newRows
    ).toBeUndefined()
    const firstOfItsStage = await personLoad({
        newRowStageId: PREVIOUS_DELIVERIES,
    })
    expect(firstOfItsStage.newRows?.programStageId).toBe(PREVIOUS_DELIVERIES)
    expect(firstOfItsStage.tables[0].columns.map(({ id }) => id)).toContain(
        'mrVkW9h2Rdp'
    )
    expect(firstOfItsStage.rules?.programStageIds).toContain(
        PREVIOUS_DELIVERIES
    )
    // Many people's events: a new row would mean enrolling someone.
    expect(
        (
            await personLoad({
                enrollmentId: undefined,
                newRowStageId: SECOND_VISIT,
            })
        ).newRows
    ).toBeUndefined()
})

test('an event that has not happened yet is labelled by its scheduled date', async () => {
    const scheduled = {
        status: 'SCHEDULE' as const,
        occurredAt: undefined,
        scheduledAt: '2026-11-02T00:00:00.000',
    }
    const form = await loadInpatient(
        inpatientProgram,
        withEvent(0, scheduled),
        meAdmin
    )
    expect(form.tables[0].rows[0].label).toBe('2026-11-02')
    expect(form.values.has(cellKey('NGxc7JpmqqD', EVENT_DATE_COLUMN))).toBe(
        false
    )

    const personForm = await person().load(
        engineFor(
            rmnchProgram,
            {
                ...rmnchEvents,
                events: rmnchEvents.events.map((event, at) =>
                    at === 1
                        ? { ...event, ...scheduled }
                        : at === 2
                          ? { ...event, ...scheduled, scheduledAt: undefined }
                          : event
                ),
            },
            meAdmin
        ).engine
    )
    expect(personForm.tables[0].rows[1].label).toBe(
        '2026-11-02 · Second antenatal care visit'
    )
    // With no date at all, the stage still names the row.
    expect(personForm.tables[0].rows[2].label).toBe(
        'Second antenatal care visit'
    )
})

test('the key names the context', () => {
    expect(eventSource({ programId: 'p', orgUnitId: 'o' }).key).toBe(
        'events:p:-:o:SELECTED:-'
    )
    expect(
        eventSource({
            programId: 'p',
            programStageId: 's',
            orgUnitId: 'o',
            orgUnitMode: 'DESCENDANTS',
            enrollmentId: 'e',
        }).key
    ).toBe('events:p:s:o:DESCENDANTS:e')
})

test('a completed event in a blockEntryForm stage is read-only; reopening needs F_UNCOMPLETE_EVENT', async () => {
    const open = await loadInpatient(inpatientProgram, inpatientEvents, meAdmin)
    expect(open.readOnlyRows.size).toBe(0)
    expect(open.canReopen).toEqual(new Set(INPATIENT_ROWS))

    const blocking = withStage({ blockEntryForm: true })
    const blocked = await loadInpatient(blocking, inpatientEvents, meAdmin)
    expect(blocked.readOnlyRows).toEqual(
        new Map(
            INPATIENT_ROWS.map((id) => [
                id,
                'Completed events in this stage cannot be edited',
            ])
        )
    )
    expect(blocked.canReopen).toEqual(new Set(INPATIENT_ROWS))

    const noAuthority = await loadInpatient(
        blocking,
        inpatientEvents,
        withAuthorities([])
    )
    expect(noAuthority.canReopen.size).toBe(0)
    const superuser = await loadInpatient(
        blocking,
        inpatientEvents,
        withAuthorities(['ALL'])
    )
    expect(superuser.canReopen).toEqual(new Set(INPATIENT_ROWS))

    const active = await loadInpatient(
        blocking,
        withEvent(0, { status: 'ACTIVE' }),
        meAdmin
    )
    expect(active.readOnlyRows.has('NGxc7JpmqqD')).toBe(false)
    expect(active.canReopen.has('NGxc7JpmqqD')).toBe(false)
})

test('a skipped event is read-only', async () => {
    const form = await loadInpatient(
        inpatientProgram,
        withEvent(1, { status: 'SKIPPED' }),
        meAdmin
    )
    expect(form.readOnlyRows).toEqual(
        new Map([['wAiGPfJGMxt', 'Skipped events cannot be edited']])
    )
})

test('no data write access to the stage makes its events read-only', async () => {
    const form = await loadInpatient(
        withStage({ access: { data: { write: false } } }),
        inpatientEvents,
        meAdmin
    )
    expect(form.readOnlyRows).toEqual(
        new Map(
            INPATIENT_ROWS.map((id) => [
                id,
                'You do not have access to enter data in this stage',
            ])
        )
    )
    expect(form.canReopen.size).toBe(0)
    expect(form.newRows).toBeUndefined()
})

test('an expired event is read-only unless the user has F_EDIT_EXPIRED', async () => {
    const program = {
        ...inpatientProgram,
        expiryPeriodType: 'Monthly',
        expiryDays: 1,
    }
    const events = withEvent(0, { occurredAt: '2026-08-26T00:00:00.000' })

    const form = await loadInpatient(
        program,
        events,
        withAuthorities(['F_UNCOMPLETE_EVENT'])
    )
    expect(form.readOnlyRows).toEqual(
        new Map([['NGxc7JpmqqD', 'This event is in an expired period']])
    )
    expect(form.canReopen.has('NGxc7JpmqqD')).toBe(false)
    expect(form.canReopen.has('wAiGPfJGMxt')).toBe(true)

    const allowed = await loadInpatient(
        program,
        events,
        withAuthorities(['F_UNCOMPLETE_EVENT', 'F_EDIT_EXPIRED'])
    )
    expect(allowed.readOnlyRows.size).toBe(0)
    expect(allowed.canReopen.has('NGxc7JpmqqD')).toBe(true)
})

test('a scheduled event expires by its scheduled date', async () => {
    const program = {
        ...inpatientProgram,
        expiryPeriodType: 'Monthly',
        expiryDays: 1,
    }
    const events = withEvent(0, {
        status: 'SCHEDULE',
        occurredAt: undefined,
        completedAt: undefined,
        scheduledAt: '2026-08-26T00:00:00.000',
    })

    const form = await loadInpatient(program, events, withAuthorities([]))
    expect(form.readOnlyRows).toEqual(
        new Map([['NGxc7JpmqqD', 'This event is in an expired period']])
    )

    const allowed = await loadInpatient(
        program,
        events,
        withAuthorities(['F_EDIT_EXPIRED'])
    )
    expect(allowed.readOnlyRows.size).toBe(0)
})

test('an event completed longer ago than completeEventsExpiryDays is read-only unless the user has F_EDIT_EXPIRED', async () => {
    // Every fixture event was completed on 2026-04-21.
    const program = { ...inpatientProgram, completeEventsExpiryDays: 7 }
    const events = withEvent(0, { status: 'ACTIVE', completedAt: undefined })

    const form = await loadInpatient(program, events, withAuthorities([]))
    expect(form.readOnlyRows).toEqual(
        new Map(
            INPATIENT_ROWS.slice(1).map((id) => [
                id,
                'This event was completed too long ago to edit',
            ])
        )
    )

    const allowed = await loadInpatient(
        program,
        events,
        withAuthorities(['F_EDIT_EXPIRED'])
    )
    expect(allowed.readOnlyRows.size).toBe(0)
})

test('a program with a non-default category combo loads read-only with the reason', async () => {
    const form = await loadInpatient(
        {
            ...inpatientProgram,
            categoryCombo: { id: 'P8lFcxYJOV0', isDefault: false },
        },
        inpatientEvents,
        meAdmin
    )
    expect(form.readOnlyRows).toEqual(
        new Map(
            INPATIENT_ROWS.map((id) => [
                id,
                'Programs with attribute categories are not supported in this grid',
            ])
        )
    )
    expect(form.canReopen.size).toBe(0)
    expect(form.newRows).toBeUndefined()
})
