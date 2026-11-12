/// <reference types="@vitest/browser-playwright" />
import { CustomDataProvider } from '@dhis2/app-runtime'
import { page, userEvent } from 'vitest/browser'
import { render } from 'vitest-browser-react'
import { createStore } from 'zustand/vanilla'
import type { Field } from '@/components/dhis2-value-types'
import type { AnnotationsState } from '../model/annotations'
import { cellKey } from '../model/types'
import type { GridTable } from '../model/types'
import { Spreadsheet } from '../provider/Spreadsheet'
import { createCellStore } from '../store/store'
import { SpreadsheetGrid } from './SpreadsheetGrid'
import { control } from './__tests__/gridRig'

const SETTINGS = { calendar: 'iso8601', dateFormat: 'YYYY-MM-DD' } as const

/** Rows are data elements, columns category option combos: the aggregate shape. */
const FIELDS = new Map<string, Field>([
    ['measles', { valueType: 'INTEGER_ZERO_OR_POSITIVE' }],
    ['comment', { valueType: 'TEXT' }],
])

const table: GridTable = {
    id: 'form',
    title: 'Form',
    rows: [
        { id: 'measles', label: 'Measles' },
        { id: 'comment', label: 'Comment' },
    ],
    columns: [
        { id: 'under1', label: 'Under 1' },
        { id: 'over1', label: 'Over 1' },
    ],
    headerRows: [
        [
            { id: 'under1', label: 'Under 1', span: 1 },
            { id: 'over1', label: 'Over 1', span: 1 },
        ],
    ],
    closed: new Map(),
}

const mountAggregate = async (annotations: Partial<AnnotationsState> = {}) => {
    const enqueue = vi.fn()
    const store = createStore<AnnotationsState>()(() => ({
        cells: {},
        rowMessages: new Map(),
        rowNotes: new Map(),
        ...annotations,
    }))
    const cells = createCellStore({
        fields: FIELDS,
        fieldIdOf: (key) => key.slice(0, key.indexOf('.')),
        values: new Map(),
        settings: SETTINGS,
        annotations: store,
        enqueue,
    })
    const Harness = () => (
        <Spreadsheet
            cells={cells}
            annotations={store}
            tables={[table]}
            settings={SETTINGS}
            idScope="aggregate"
        >
            <SpreadsheetGrid />
        </Spreadsheet>
    )
    await render(
        <CustomDataProvider data={{}}>
            <Harness />
        </CustomDataProvider>
    )
    return { enqueue, cells, store }
}

test('an aggregate-shaped grid: rows are data elements, columns are category option combos', async () => {
    const { enqueue, cells } = await mountAggregate()
    control(cellKey('measles', 'under1')).focus()
    await userEvent.keyboard('-1{Enter}')
    expect(cells.getState().cells[cellKey('measles', 'under1')]?.error).toBe(
        'Enter a whole number of zero or more'
    )
    expect(enqueue).not.toHaveBeenCalled()
    control(cellKey('comment', 'under1')).focus()
    await userEvent.keyboard('abc{Enter}')
    expect(enqueue).toHaveBeenCalledExactlyOnceWith(
        'comment.under1',
        'abc',
        null
    )
})

test('validation messages land on cells and rows', async () => {
    await mountAggregate({
        cells: {
            [cellKey('measles', 'over1')]: {
                required: false,
                messages: [{ tone: 'error', text: 'Over 1 exceeds under 1' }],
            },
        },
        rowMessages: new Map([
            ['measles', [{ tone: 'error' as const, text: 'Rule failed' }]],
        ]),
    })
    // A cell's messages are its description, which the screen reader reads.
    await expect
        .element(control(cellKey('measles', 'over1')))
        .toHaveAccessibleDescription('Over 1 exceeds under 1')
    const row = page.getByRole('listitem').getByText('Rule failed')
    await expect.element(row).toBeVisible()
    expect(row.element().className).toContain(
        'border-dhis2-destructive-indicator'
    )
})

test('a grid with no rules', async () => {
    const required = cellKey('comment', 'over1')
    const { enqueue, cells } = await mountAggregate({
        cells: { [required]: { required: true, messages: [] } },
    })
    // Required comes from the annotations, which never change here.
    await expect.element(control(required)).toBeRequired()
    await expect
        .element(control(cellKey('comment', 'under1')))
        .not.toBeRequired()
    const key = cellKey('measles', 'under1')
    control(key).focus()
    await userEvent.keyboard('abc{Enter}')
    expect(cells.getState().cells[key]?.error).toBe(
        'Enter a whole number of zero or more'
    )
    expect(enqueue).not.toHaveBeenCalled()
    const other = cellKey('measles', 'over1')
    control(other).focus()
    await userEvent.keyboard('7{Enter}')
    expect(cells.getState().cells[other]?.value).toBe('7')
    await userEvent.keyboard('{Control>}z{/Control}')
    expect(cells.getState().cells[other]?.value).toBeUndefined()
    expect(enqueue).toHaveBeenLastCalledWith(other, null, null)
})
