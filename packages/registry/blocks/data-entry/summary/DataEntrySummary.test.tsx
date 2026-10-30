/// <reference types="@vitest/browser-playwright" />
import i18n from '@dhis2/d2-i18n'
import { page } from 'vitest/browser'
import { DataGrid } from '../grid/DataGrid'
import { cellKey } from '../model/types'
import type { GridColumn } from '../model/types'
import {
    cleanUp,
    memorySource,
    mount,
    visitForm,
} from '../provider/__tests__/rig'
import { DataEntrySummary } from './DataEntrySummary'

afterEach(cleanUp)

const EVENT_DATE: GridColumn = {
    id: 'occurredAt',
    label: 'Event date',
    field: { valueType: 'DATE' },
}

/** Visit 1 has its date and its required Children, so only Visit 2, which has neither, is in the summary. */
const visits = () => {
    const form = visitForm({
        values: [
            [cellKey('r1', 'occurredAt'), '2026-10-20'],
            [cellKey('r1', 'c1'), '3'],
        ],
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

test('a change to a row the summary does not list leaves its items alone, and a listed row’s name follows its date', async () => {
    const { source, hold } = memorySource(visits())
    // Unsent changes stay counted, so the summary is seen to change.
    hold()
    const { context } = await mount(source, {
        children: (
            <>
                <DataGrid />
                <DataEntrySummary />
            </>
        ),
    })
    await expect
        .element(
            page.getByRole('link', { name: 'Visit 2: Children is required' })
        )
        .toBeVisible()

    // Each time an item names its row, it asks for the message's text.
    const named = vi.spyOn(i18n, 't')
    const namings = () =>
        named.mock.calls.filter(([key]) => String(key).startsWith('{{row}}'))
            .length
    const before = namings()
    context().store.getState().commit(cellKey('r1', 'c3'), 'Seen at home')
    await expect
        .element(page.getByText('Not yet sent to DHIS2: 1'))
        .toBeVisible()
    expect(namings()).toBe(before)

    context().store.getState().commit(cellKey('r2', 'occurredAt'), '2026-10-21')
    await expect
        .element(
            page.getByRole('link', {
                name: '2026-10-21: Children is required',
            })
        )
        .toBeVisible()
})
