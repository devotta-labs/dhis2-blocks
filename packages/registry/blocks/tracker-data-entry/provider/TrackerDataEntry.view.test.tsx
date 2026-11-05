/// <reference types="@vitest/browser-playwright" />
import { page, userEvent } from 'vitest/browser'
import type { Field } from '@/components/dhis2-value-types'
import { SpreadsheetGrid, cellKey } from '@/components/spreadsheet'
import type { ServerRequest } from '@/components/spreadsheet/cells/__tests__/harness'
import { control } from '@/components/spreadsheet/grid/__tests__/gridRig'
import type { TrackerColumn } from '../model/types'
import type { LoadedForm } from '../sources/types'
import { TrackerDataEntrySummary } from '../summary/TrackerDataEntrySummary'
import {
    cleanUp,
    HIDDEN_FIELD,
    later,
    memorySource,
    mount,
    visit,
    visitForm,
} from './__tests__/rig'

afterEach(cleanUp)

const EVENT_DATE: TrackerColumn = {
    id: 'occurredAt',
    label: 'Event date',
    field: { valueType: 'DATE' },
}

/** The visits with an event date first; visit 1 happened on 2026-10-20, visit 2 has no date yet. */
const datedVisits = (): LoadedForm => {
    const form = visitForm({
        values: [[cellKey('r1', 'occurredAt'), '2026-10-20']],
    })
    const [table] = form.tables
    const columns = [EVENT_DATE, ...table.columns]
    return {
        ...form,
        fields: new Map([...form.fields, [EVENT_DATE.id, EVENT_DATE.field]]),
        tables: [
            {
                ...table,
                columns,
                headerRows: [
                    columns.map(({ id, label }) => ({ id, label, span: 1 })),
                ],
            },
        ],
    }
}

test('a row is named by its event date in the system’s format, and a new row once its date is typed', async () => {
    const { context, view } = await mount(memorySource(datedVisits()).source, {
        data: {
            'system/info': { calendar: 'iso8601', dateFormat: 'dd-MM-yyyy' },
        },
        children: (
            <>
                <SpreadsheetGrid />
                <TrackerDataEntrySummary />
            </>
        ),
    })
    const headers = page.getByRole('rowheader')
    await expect.element(headers.nth(0)).toHaveTextContent('20-10-2026')
    await expect.element(headers.nth(1)).toHaveTextContent('Visit 2')
    // Its cells are named by it.
    await expect
        .element(page.getByRole('textbox', { name: 'Children 20-10-2026' }))
        .toBeInTheDocument()

    await userEvent.click(page.getByRole('button', { name: 'Add event' }))
    await expect.element(headers.nth(2)).toHaveTextContent('New event')
    const added = context().tables[0].rows[2].id
    control(cellKey(added, 'occurredAt')).focus()
    await userEvent.keyboard('21-10-2026{Enter}')
    await expect.element(headers.nth(2)).toHaveTextContent('21-10-2026')
    // The summary names the rows the same way; a message that names its field is not given the field again.
    await expect
        .element(
            page.getByRole('link', { name: '21-10-2026: Children is required' })
        )
        .toBeInTheDocument()
    await expect
        .element(
            page.getByRole('link', { name: 'Visit 2: Children is required' })
        )
        .toBeInTheDocument()
    // The form's tables, for a host to lay out its own controls by.
    expect(view().tables).toBe(context().tables)
})

test('a compulsory field with no column is asked for as soon as the form opens, with no rules', async () => {
    const form = visitForm()
    const [stage] = form.fieldsByForm.keys()
    const { view } = await mount(
        memorySource({
            ...form,
            required: new Map([[stage, new Set(['c1', HIDDEN_FIELD])]]),
        }).source
    )
    const { items, canComplete } = view().summary
    expect(canComplete).toBe(false)
    expect(
        items
            .filter(({ key }) => key.endsWith(`.${HIDDEN_FIELD}`))
            .map(({ key, kind }) => [key, kind])
    ).toEqual([
        [cellKey('r1', HIDDEN_FIELD), 'errorOnComplete'],
        [cellKey('r2', HIDDEN_FIELD), 'errorOnComplete'],
    ])
})

test('a form that cannot be loaded says why', async () => {
    const { source } = memorySource(visitForm())
    const { view } = await mount(
        {
            ...source,
            load: async () => {
                throw new Error('You have no access to this program')
            },
        },
        { until: 'error' }
    )
    expect(view().error).toBe('You have no access to this program')
})

test('a completed row’s record says so in the view', async () => {
    const memory = memorySource(
        visitForm({ values: [[cellKey('r1', 'c1'), '2']] })
    )
    const { view } = await mount(memory.source)
    expect(view().records.get('r1')).toMatchObject({ status: 'ACTIVE' })
    expect(await view().complete('r1')).toMatchObject([{ result: 'saved' }])
    await expect
        .poll(() => view().records.get('r1'))
        .toMatchObject({ status: 'COMPLETED' })
    await expect
        .element(page.getByRole('rowheader', { name: 'Visit 1' }))
        .toHaveTextContent('Completed')
})

test('row headers mark completed and scheduled events', async () => {
    const statuses = ['COMPLETED', 'SCHEDULE', 'OVERDUE', 'ACTIVE'] as const
    await mount(
        memorySource(
            visitForm({
                rows: statuses.map((status, i) =>
                    visit(`r${i + 1}`, `2026-10-2${i}`, status)
                ),
            })
        ).source
    )
    await expect
        .element(page.getByRole('rowheader', { name: '2026-10-20 Completed' }))
        .toBeVisible()
    await expect
        .element(page.getByRole('rowheader', { name: '2026-10-21 Scheduled' }))
        .toBeVisible()
    await expect
        .element(page.getByRole('rowheader', { name: '2026-10-22 Scheduled' }))
        .toBeVisible()
    await expect
        .element(
            page.getByRole('rowheader', { name: '2026-10-23', exact: true })
        )
        .toBeVisible()
    // The marker is the row's, not part of every cell's name.
    await expect
        .element(
            page.getByRole('textbox', {
                name: 'Children 2026-10-20',
                exact: true,
            })
        )
        .toBeVisible()
})

const CHC = 'DiszpKrYNg8'
const MCHP = 'FwKJ7gYEv8U'
const PLACE: Field = { valueType: 'ORGANISATION_UNIT' }
const FILE: Field = { valueType: 'FILE_RESOURCE' }
// A file DHIS2 holds for the event, with the name the form loaded for it.
const STORED = 'Yqp5K9rz3I2'
const STORED_NAME = 'doc.pdf'
const NAMES = new Map([[STORED, STORED_NAME]])

const PLACE_COLUMN: TrackerColumn = { id: 'c4', label: 'Place', field: PLACE }

test('a cell shows the org unit name, not its id', async () => {
    const named = cellKey('r1', 'c4')
    const unnamed = cellKey('r2', 'c4')
    const form = visitForm({
        values: [
            [named, CHC],
            [unnamed, MCHP],
        ],
    })
    const [table] = form.tables
    await mount(
        memorySource({
            ...form,
            tables: [
                {
                    ...table,
                    columns: [PLACE_COLUMN, ...table.columns],
                    headerRows: [
                        [
                            { id: 'c4', label: 'Place', span: 1 },
                            ...table.headerRows[0],
                        ],
                    ],
                },
            ],
            fields: new Map([...form.fields, ['c4', PLACE]]),
            orgUnitNames: new Map([[CHC, 'Ngelehun CHC']]),
        }).source
    )
    expect(control(named)).toHaveValue('Ngelehun CHC')
    // An org unit the form has no name for shows its id.
    expect(control(unnamed)).toHaveValue(MCHP)
})

const SCAN = cellKey('r1', 'c4')

/** The visits with a file column first; visit 1's scan is a file DHIS2 holds for the event. */
const scanForm = (): LoadedForm => {
    const form = visitForm({ values: [[SCAN, STORED]] })
    const [table] = form.tables
    const column: TrackerColumn = { id: 'c4', label: 'Scan', field: FILE }
    return {
        ...form,
        tables: [
            {
                ...table,
                columns: [column, ...table.columns],
                headerRows: [
                    [
                        { id: 'c4', label: 'Scan', span: 1 },
                        ...table.headerRows[0],
                    ],
                ],
            },
        ],
        fields: new Map([...form.fields, ['c4', FILE]]),
        fileNames: NAMES,
    }
}

test('a file cell shows the name the form loaded, and asks for none itself', async () => {
    const reads: ServerRequest[] = []
    await mount(memorySource(scanForm()).source, {
        data: {
            fileResources: async (_type, request) => {
                reads.push(request)
                return { name: 'Asked for' }
            },
        },
    })
    expect(control(SCAN)).toHaveValue(STORED_NAME)
    await later(50)
    expect(reads).toEqual([])
})

test('offline, the file editor says files cannot be uploaded; an event’s file downloads from the event', async () => {
    const { server, view } = await mount(memorySource(scanForm()).source)
    vi.spyOn(Navigator.prototype, 'onLine', 'get').mockReturnValue(false)
    window.dispatchEvent(new Event('offline'))
    await expect.poll(() => view().sync).toBe('offline')
    control(SCAN).focus()
    await userEvent.keyboard('{F2}')
    const dialog = page.getByRole('dialog')
    await expect
        .element(dialog.getByText('Connect to the internet to upload files'))
        .toBeVisible()
    await expect
        .element(dialog.getByRole('button', { name: 'Choose a file' }))
        .toHaveAttribute('aria-disabled', 'true')
    await expect
        .element(dialog.getByRole('link', { name: 'Download' }))
        .toHaveAttribute(
            'href',
            `${server}/api/tracker/events/r1/dataValues/c4/file`
        )
})
