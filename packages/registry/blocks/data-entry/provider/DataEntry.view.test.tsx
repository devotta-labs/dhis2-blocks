/// <reference types="@vitest/browser-playwright" />
import { page, userEvent } from 'vitest/browser'
import { DataGrid } from '../grid/DataGrid'
import { control } from '../grid/__tests__/gridRig'
import { cellKey } from '../model/types'
import type { GridColumn } from '../model/types'
import type { LoadedForm } from '../sources/types'
import { DataEntrySummary } from '../summary/DataEntrySummary'
import { cleanUp, memorySource, mount, visitForm } from './__tests__/rig'

afterEach(cleanUp)

const EVENT_DATE: GridColumn = {
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
                <DataGrid />
                <DataEntrySummary />
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
