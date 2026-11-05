/// <reference types="@vitest/browser-playwright" />
import { page, userEvent } from 'vitest/browser'
import type { Field } from '@/components/dhis2-value-types'
import { cellDomId, cellKey, SpreadsheetGrid } from '@/components/spreadsheet'
import {
    control,
    focused,
    paste,
} from '@/components/spreadsheet/grid/__tests__/gridRig'
import type { DataRecord, TrackerColumn, TrackerRow } from '../model/types'
import {
    BLOCKED,
    change,
    cleanUp,
    freshServer,
    KEY,
    memorySource,
    mount,
    notesOf,
    records,
    withOutbox,
} from './__tests__/rig'
import type { SlotDef } from '../register/compileLayout'
import {
    BCG,
    engineFor,
    FIRST_NAME,
    immunisationRegister,
} from '../register/__tests__/registerRig'
import type { FormPage, LoadedForm, NewRow } from '../sources/types'
import { TrackerDataEntrySummary } from '../summary/TrackerDataEntrySummary'

afterEach(cleanUp)

const TEXT: Field = { valueType: 'TEXT' }
const DATE: Field = { valueType: 'DATE' }
const TYPE = 'person'
const PROGRAM = 'program'
const VISIT = 'visit'
const FIRST = 'first'
const LAST = 'last'
/** A generated attribute no column shows: a new person gets a reserved value for it. */
const CHILD_ID = 'childId'
const VISIT_1 = `${VISIT}#1` as const
const VISIT_2 = `${VISIT}#2` as const
const CANCELLED = 'This enrolment is cancelled'

const COLUMNS: TrackerColumn[] = [
    {
        id: 'person:first',
        label: 'First name',
        field: TEXT,
        slot: 'person',
        fieldId: FIRST,
    },
    {
        id: 'person:last',
        label: 'Last name',
        field: TEXT,
        slot: 'person',
        fieldId: LAST,
    },
    {
        id: 'enrollment:enrolledAt',
        label: 'Registered',
        field: DATE,
        slot: 'enrollment',
        fieldId: 'enrolledAt',
    },
    {
        id: `${VISIT_1}:occurredAt`,
        label: '1st visit',
        field: DATE,
        slot: VISIT_1,
        fieldId: 'occurredAt',
    },
    {
        id: `${VISIT_2}:occurredAt`,
        label: '2nd visit',
        field: DATE,
        slot: VISIT_2,
        fieldId: 'occurredAt',
    },
]

const occurrence = (n: number): SlotDef => ({
    name: `${VISIT}#${n}`,
    stageId: VISIT,
    kind: 'occurrence',
    occurrence: n,
    hasDateColumn: true,
    label: `Visit ${n}`,
})

/** A person's row and records, by the ids' prefix: `<p>p` the person, `<p>e` the enrolment, `<p>1`/`<p>2` visits. */
const person = (prefix: string, isNew?: true) => {
    const ids = {
        person: `${prefix}p`,
        enrollment: `${prefix}e`,
        [VISIT_1]: `${prefix}1`,
        [VISIT_2]: `${prefix}2`,
    }
    const row: TrackerRow = {
        id: ids.enrollment,
        label: isNew ? 'New person' : prefix,
        slots: ids,
        labelFrom: [cellKey(ids.person, FIRST), cellKey(ids.person, LAST)],
    }
    const records: DataRecord[] = [
        {
            kind: 'trackedEntity',
            id: ids.person,
            trackedEntityTypeId: TYPE,
            orgUnitId: 'o1',
            isNew,
        },
        {
            kind: 'enrollment',
            id: ids.enrollment,
            programId: PROGRAM,
            trackedEntityId: ids.person,
            orgUnitId: 'o1',
            status: 'ACTIVE',
            isNew,
        },
        ...([VISIT_1, VISIT_2] as const).map((slot): DataRecord => ({
            kind: 'event',
            id: ids[slot],
            programStageId: VISIT,
            orgUnitId: 'o1',
            enrollmentId: ids.enrollment,
            status: 'ACTIVE',
            isNew: true,
            slot,
        })),
    ]
    return { row, records }
}

const table = (rows: TrackerRow[]) => ({
    id: PROGRAM,
    title: 'Child register',
    rows,
    columns: COLUMNS,
    headerRows: [COLUMNS.map(({ id, label }) => ({ id, label, span: 1 }))],
    closed: new Map(),
})

const AMINA = person('a')
const JOSEPH = person('j')

/**
 * Two people: Amina Bangura and Joseph Kamara, each with two visit slots of one stage; a note on Joseph's row, and
 * Joseph's enrolment cancelled when `cancelled`.
 */
const register = ({
    cancelled = false,
    hasMore = false,
}: { cancelled?: boolean; hasMore?: boolean } = {}): LoadedForm => ({
    tables: [table([AMINA.row, JOSEPH.row])],
    values: new Map([
        [cellKey('ap', FIRST), 'Amina'],
        [cellKey('ap', LAST), 'Bangura'],
        [cellKey('jp', FIRST), 'Joseph'],
        [cellKey('jp', LAST), 'Kamara'],
    ]),
    records: new Map(
        [...AMINA.records, ...JOSEPH.records].map((record) => [
            record.id,
            record,
        ])
    ),
    fields: new Map([
        [FIRST, TEXT],
        [LAST, TEXT],
        [CHILD_ID, TEXT],
        ['enrolledAt', DATE],
        ['occurredAt', DATE],
    ]),
    fieldNames: new Map([
        [FIRST, 'First name'],
        [LAST, 'Last name'],
        [CHILD_ID, 'Child ID'],
        ['enrolledAt', 'Enrolment date'],
        ['occurredAt', 'Visit date'],
    ]),
    fieldsByForm: new Map([
        [TYPE, new Set([FIRST, LAST, CHILD_ID])],
        [PROGRAM, new Set(['enrolledAt'])],
        [VISIT, new Set<string>()],
    ]),
    required: new Map(),
    strategy: new Map(),
    sections: new Map(),
    readOnlyRecords: new Map(
        cancelled
            ? JOSEPH.records.map(({ id }): [string, string] => [id, CANCELLED])
            : []
    ),
    canReopen: new Set(),
    readOnlyWhenCompleted: new Map([[VISIT, BLOCKED]]),
    mayUncomplete: true,
    newRows: { tableId: PROGRAM, orgUnitId: 'o1' },
    orgUnitNames: new Map(),
    fileNames: new Map(),
    hasMore,
    rowKind: 'person',
    rowNotes: new Map([[JOSEPH.row.id, ['1 more visit not in this register']]]),
    slots: [
        { name: 'person', kind: 'person', hasDateColumn: false, label: '' },
        occurrence(1),
        occurrence(2),
    ],
})

let count = 0
/** A new person, as a register source makes one: new records, and a reserved child id. */
const newRow = (): NewRow => {
    count += 1
    return {
        ...person(`n${count}`, true),
        values: new Map([[cellKey(`n${count}p`, CHILD_ID), `CH-${count}`]]),
    }
}

/** The register over a source that keeps its saves waiting, so the outbox holds every change. */
const mountHeld = async (server = freshServer()) => {
    const memory = memorySource(register())
    memory.hold()
    return mount(
        { ...memory.source, newRow },
        {
            server,
            children: (
                <>
                    <SpreadsheetGrid />
                    <TrackerDataEntrySummary />
                </>
            ),
        }
    )
}

const queued = async (server: string) =>
    (await records(server, KEY)).map(({ key, value, record }) => ({
        key,
        value,
        record,
    }))

const header = (n: number) => page.getByRole('rowheader').nth(n)

test('the row header names the person from the cells and follows typing', async () => {
    await mountHeld()
    await expect.element(header(0)).toHaveTextContent('Amina Bangura')
    // The source's note on a row shows under its name.
    await expect
        .element(header(1))
        .toHaveTextContent('Joseph Kamara1 more visit not in this register')
    control(cellKey('ap', LAST)).focus()
    await userEvent.keyboard('Conteh{Enter}')
    await expect.element(header(0)).toHaveTextContent('Amina Conteh')
    // Its cells are named by it.
    await expect
        .element(page.getByRole('textbox', { name: '1st visit Amina Conteh' }))
        .toBeInTheDocument()
})

test('Tab across a row, Enter returns to its first column on the next row', async () => {
    const { context } = await mountHeld()
    control(cellKey('ap', FIRST)).focus()
    await userEvent.keyboard('{Tab}{Tab}{Tab}{Enter}')
    expect(focused()).toBe(cellDomId(context().idScope, cellKey('jp', FIRST)))
})

test('Ctrl+Enter adds a person whose cells save to its own new records', async () => {
    const { server, context } = await mountHeld()
    control(cellKey('ap', FIRST)).focus()
    await userEvent.keyboard('{Control>}{Enter}{/Control}')
    await expect.element(header(2)).toHaveTextContent('New person')
    const added: TrackerRow = context().tables[0].rows[2]
    const { person: personId = '', [VISIT_2]: visitId = '' } = added.slots ?? {}
    // Focus is on the new person's first open cell.
    expect(focused()).toBe(
        cellDomId(context().idScope, cellKey(personId, FIRST))
    )
    await userEvent.keyboard('Fatmata{Enter}')
    control(cellKey(visitId, 'occurredAt')).focus()
    await userEvent.keyboard('2026-10-05{Enter}')
    await expect.element(header(2)).toHaveTextContent('Fatmata')
    await expect
        .poll(() => queued(server))
        .toEqual(
            expect.arrayContaining([
                {
                    key: cellKey(personId, FIRST),
                    value: 'Fatmata',
                    record: expect.objectContaining({
                        kind: 'trackedEntity',
                        id: personId,
                        isNew: true,
                    }),
                },
                {
                    key: cellKey(visitId, 'occurredAt'),
                    value: '2026-10-05',
                    record: expect.objectContaining({
                        kind: 'event',
                        id: visitId,
                        slot: VISIT_2,
                        enrollmentId: added.id,
                    }),
                },
            ])
        )
})

test('a new person’s reserved values are saved, and undo leaves them', async () => {
    const { server, context } = await mountHeld()
    await userEvent.click(page.getByRole('button', { name: 'Add person' }))
    await expect.element(header(2)).toHaveTextContent('New person')
    const added: TrackerRow = context().tables[0].rows[2]
    const personId = added.slots?.person ?? ''
    const reserved = cellKey(personId, CHILD_ID)
    await expect
        .poll(async () => (await queued(server)).map(({ key }) => key))
        .toEqual([reserved])
    await userEvent.keyboard('Fatmata{Enter}')
    control(cellKey(personId, FIRST)).focus()
    // Twice: the second would undo the reserved value, were it the person's own.
    await userEvent.keyboard('{Control>}z{/Control}{Control>}z{/Control}')
    const { cells } = context().store.getState()
    expect(cells[cellKey(personId, FIRST)]?.value).toBeUndefined()
    expect(cells[reserved]?.value).toMatch(/^CH-/)
})

test('the buttons speak of people', async () => {
    const memory = memorySource(register({ hasMore: true }))
    const more: FormPage = {
        tables: [table([person('k').row])],
        values: new Map([[cellKey('kp', FIRST), 'Kadiatu']]),
        records: new Map(
            person('k').records.map((record) => [record.id, record])
        ),
        readOnlyRecords: new Map(),
        canReopen: new Set(),
        orgUnitNames: new Map(),
        fileNames: new Map(),
        hasMore: false,
        rowNotes: new Map([['ke', ['2 events hold the 1st visit']]]),
    }
    await mount({ ...memory.source, newRow, loadPage: async () => more })
    await expect
        .element(page.getByRole('button', { name: 'Add person' }))
        .toBeInTheDocument()
    await userEvent.click(
        page.getByRole('button', { name: 'Show more people' })
    )
    await expect
        .element(page.getByRole('status'))
        .toHaveTextContent('People shown: 3')
    // A page's notes show on its rows.
    await expect
        .element(header(2))
        .toHaveTextContent('Kadiatu2 events hold the 1st visit')
})

test('a summary line names a slotted column by its own heading', async () => {
    await mountHeld()
    control(cellKey('a1', 'occurredAt')).focus()
    await userEvent.keyboard('soon{Enter}')
    await expect
        .element(
            page.getByRole('link', { name: /^Amina Bangura, 1st visit: / })
        )
        .toBeInTheDocument()
})

test('a visit dated before the one before it warns on its date, without blocking it', async () => {
    const { server } = await mountHeld()
    control(cellKey('a1', 'occurredAt')).focus()
    await userEvent.keyboard('2026-10-20{Tab}2026-10-10{Enter}')
    await expect
        .poll(() => notesOf(cellKey('a2', 'occurredAt')))
        .toContain('Earlier than the 1st visit')
    expect(notesOf(cellKey('a1', 'occurredAt'))).toContain(
        'Later than the 2nd visit'
    )
    await expect.poll(async () => (await queued(server)).length).toBe(2)
    // Put in order, the warnings go.
    control(cellKey('a2', 'occurredAt')).focus()
    await userEvent.keyboard('2026-10-25{Enter}')
    await expect
        .poll(() => notesOf(cellKey('a2', 'occurredAt')))
        .not.toContain('Earlier than the 1st visit')
    expect(notesOf(cellKey('a1', 'occurredAt'))).not.toContain(
        'Later than the 2nd visit'
    )
})

test('nothing reaches the outbox for a read-only person: not a paste, an undo or a rule’s value', async () => {
    const memory = memorySource(register({ cancelled: true }))
    const { server, context, view } = await mount({ ...memory.source, newRow })
    // A block pasted down over Joseph's row fills only Amina's.
    control(cellKey('ap', LAST)).focus()
    expect(paste(control(cellKey('ap', LAST)), 'Conteh\nSesay')).toBe(true)
    const { store } = context()
    expect(store.getState().cells[cellKey('jp', LAST)]?.value).toBe('Kamara')
    // A rule's value for the read-only person is not taken.
    expect(
        store
            .getState()
            .commitMany([{ key: cellKey('jp', FIRST), text: 'Joe' }], 'rule')
    ).toEqual(['unchanged'])
    // A visit typed, then completed in a stage that blocks entry: undo cannot change it any more.
    control(cellKey('a1', 'occurredAt')).focus()
    await userEvent.keyboard('2026-10-05{Enter}')
    expect(await view().complete('a1')).toMatchObject([{ result: 'saved' }])
    control(cellKey('a1', 'occurredAt')).focus()
    await userEvent.keyboard('{Control>}z{/Control}')
    expect(store.getState().cells[cellKey('a1', 'occurredAt')]?.value).toBe(
        '2026-10-05'
    )
    await expect
        .poll(() => memory.sent.flat().map(({ key, value }) => [key, value]))
        .toEqual([
            [cellKey('ap', LAST), 'Conteh'],
            [cellKey('a1', 'occurredAt'), '2026-10-05'],
        ])
    await expect.poll(() => records(server, KEY)).toEqual([])
})

test('a change that waits for a person on no row shown is counted as not sent', async () => {
    const server = freshServer()
    const offPage = cellKey('zz1', 'occurredAt')
    await withOutbox(server, async (outbox) => {
        await outbox.put(change(offPage, '2026-10-05'))
        await outbox.mark(
            [{ sourceKey: KEY, key: offPage }],
            'waiting',
            'DHIS2 could not be reached to check this change'
        )
    })
    const { view } = await mountHeld(server)
    await expect
        .element(page.getByText('Not yet sent to DHIS2: 1'))
        .toBeInTheDocument()
    // Counted, with no cell to link to.
    expect(view().summary.items).toEqual([])
})

test('a new person’s visit in a stage the user may not enter data in is read-only, with why', async () => {
    const noWrite = 'You do not have access to enter data in this stage'
    const memory = memorySource(register())
    const { context } = await mount({
        ...memory.source,
        newRow: () => {
            const made = newRow()
            const visit = made.row.slots?.[VISIT_1] ?? ''
            return { ...made, readOnlyRecords: new Map([[visit, noWrite]]) }
        },
    })
    await userEvent.click(page.getByRole('button', { name: 'Add person' }))
    await expect.element(header(2)).toHaveTextContent('New person')
    const added: TrackerRow = context().tables[0].rows[2]
    const { [VISIT_1]: visit = '', [VISIT_2]: other = '' } = added.slots ?? {}
    const cell = control(cellKey(visit, 'occurredAt'))
    expect(cell).toHaveAttribute('readonly')
    expect(cell).toHaveAccessibleDescription(noWrite)
    expect(control(cellKey(other, 'occurredAt'))).not.toHaveAttribute(
        'readonly'
    )
    // Nothing typed into it is kept.
    cell.focus()
    await userEvent.keyboard('2026-10-05{Enter}')
    expect(
        context().store.getState().cells[cellKey(visit, 'occurredAt')]?.value
    ).toBeUndefined()
})

test('a person’s file or image is shown read-only, to be edited in their own form', async () => {
    const PHOTO = 'photo'
    const form = register()
    const [shown] = form.tables
    const photo: TrackerColumn = {
        id: 'person:photo',
        label: 'Photo',
        field: { valueType: 'IMAGE' },
        slot: 'person',
        fieldId: PHOTO,
    }
    const memory = memorySource({
        ...form,
        tables: [
            {
                ...shown,
                columns: [...shown.columns, photo],
                headerRows: [[...shown.headerRows[0], { ...photo, span: 1 }]],
            },
        ],
        values: new Map([
            ...form.values,
            [cellKey('ap', PHOTO), 'FileRes0001'],
        ]),
        fields: new Map([...form.fields, [PHOTO, photo.field]]),
        fieldsByForm: new Map([
            ...form.fieldsByForm,
            [TYPE, new Set([FIRST, LAST, CHILD_ID, PHOTO])],
        ]),
        fileNames: new Map([['FileRes0001', 'amina.jpg']]),
    })
    await mount({ ...memory.source, newRow })
    const cell = control(cellKey('ap', PHOTO))
    expect(cell).toHaveValue('amina.jpg')
    expect(cell).toHaveAttribute('readonly')
    expect(cell).toHaveAccessibleDescription('Edit this field in its own form')
})

test('a new person’s first cell takes focus and saves to its slot', async () => {
    const immunisation = immunisationRegister()
    const memory = memorySource(await immunisation.load(engineFor().engine))
    memory.hold()
    const server = freshServer()
    const { context } = await mount(
        { ...memory.source, newRow: immunisation.newRow },
        { server }
    )
    const shown = context().tables[0].rows.length
    await userEvent.click(page.getByRole('button', { name: 'Add person' }))
    await expect.poll(() => context().tables[0].rows).toHaveLength(shown + 1)
    const added: TrackerRow = context().tables[0].rows[shown]
    const { person = '', [BCG]: bcg = '' } = added.slots ?? {}
    await expect
        .poll(focused)
        .toBe(cellDomId(context().idScope, cellKey(person, FIRST_NAME)))
    control(cellKey(bcg, 'occurredAt')).focus()
    await userEvent.keyboard('2026-10-05{Enter}')
    await expect
        .poll(() => queued(server))
        .toEqual(
            expect.arrayContaining([
                {
                    key: cellKey(bcg, 'occurredAt'),
                    value: '2026-10-05',
                    record: expect.objectContaining({
                        kind: 'event',
                        id: bcg,
                        slot: BCG,
                        isNew: true,
                    }),
                },
            ])
        )
})
