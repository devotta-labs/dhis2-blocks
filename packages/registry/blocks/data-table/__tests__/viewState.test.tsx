import { render } from 'vitest-browser-react'
import {
    applyDataTableViewState,
    dataTableViewInitialState,
    dataTableViewStateSchema,
    getDataTableViewState,
    parseDataTableViewState,
    type DataTableInstance,
    type DataTableState,
    type DataTableViewState,
} from '..'
import type { Person } from './dataTableTestSupport'
import { ToolsHarness, toolsState } from './toolsTestSupport'

let latest: DataTableInstance<Person> | undefined
const current = () => {
    if (!latest) throw new Error('The harness has not rendered.')
    return latest
}

const renderTable = (initialState: Partial<DataTableState> = {}) =>
    render(
        <ToolsHarness
            options={{ initialState }}
            onTable={(table) => {
                latest = table
            }}
        />
    )

const ageFilter = { id: 'age', value: { kind: 'number', min: 20 } } as const

const fullView = {
    version: 1,
    sorting: [{ id: 'age', desc: true }],
    columnFilters: [{ id: 'age', value: { kind: 'number', min: 20 } }],
    globalFilter: 'Bo',
    columnVisibility: { active: false },
    columnOrder: ['district', 'name'],
    columnPinning: { start: ['name'] },
    columnSizing: { name: 220 },
    grouping: ['district'],
    pageSize: 5,
} satisfies DataTableViewState

describe('view state', () => {
    it('round-trips through JSON into an initial state', async () => {
        await renderTable({
            sorting: [{ id: 'age', desc: true }],
            columnFilters: [
                ageFilter,
                // Not a DataTableFilterValue: not part of a view.
                { id: 'name', value: 'raw text' },
            ],
            globalFilter: 'Bo',
            columnVisibility: { active: false },
            columnOrder: ['district', 'name'],
            columnPinning: { start: ['name'], end: [] },
            columnSizing: { name: 220 },
            grouping: ['district'],
            pagination: { pageIndex: 2, pageSize: 5 },
            rowSelection: { 'person-1': true },
            expanded: { 'person-2': true },
        })

        const view = getDataTableViewState(current())
        expect(view).toEqual(fullView)

        const parsed = parseDataTableViewState(JSON.stringify(view))
        expect(parsed).toEqual(fullView)
        expect(dataTableViewInitialState(parsed)).toEqual({
            sorting: [{ id: 'age', desc: true }],
            columnFilters: [ageFilter],
            globalFilter: 'Bo',
            columnVisibility: { active: false },
            columnOrder: ['district', 'name'],
            columnPinning: { start: ['name'], end: [] },
            columnSizing: { name: 220 },
            grouping: ['district'],
            pagination: { pageIndex: 0, pageSize: 5 },
        })
    })

    it('leaves out empty slices and a global filter that is not text', async () => {
        await renderTable({ globalFilter: 42 })

        expect(getDataTableViewState(current())).toEqual({
            version: 1,
            pageSize: 10,
        })
    })

    it('rejects invalid JSON, another version and foreign values', () => {
        expect(parseDataTableViewState('{')).toBeUndefined()
        expect(parseDataTableViewState('null')).toBeUndefined()
        expect(
            parseDataTableViewState(JSON.stringify({ ...fullView, version: 2 }))
        ).toBeUndefined()
        expect(
            parseDataTableViewState(
                JSON.stringify({
                    version: 1,
                    columnFilters: [{ id: 'age', value: 'raw' }],
                })
            )
        ).toBeUndefined()
        expect(parseDataTableViewState(JSON.stringify({ version: 1 }))).toEqual(
            { version: 1 }
        )
        expect(dataTableViewStateSchema.safeParse({}).success).toBe(false)
        expect(dataTableViewInitialState(undefined)).toEqual({})
    })

    it('applies a view, resetting absent slices and the page index', async () => {
        await renderTable({
            sorting: [{ id: 'name', desc: false }],
            pagination: { pageIndex: 0, pageSize: 4 },
        })
        const table = current()
        table.setSorting([{ id: 'age', desc: true }])
        table.setColumnFilters([ageFilter])
        table.setColumnVisibility({ district: false })
        table.setColumnOrder(['age'])
        table.setColumnPinning({ start: ['age'], end: [] })
        table.setColumnSizing({ age: 120 })
        table.setGrouping(['district'])
        table.setRowSelection({ 'person-3': true })
        table.setPageIndex(1)
        await expect.poll(() => toolsState().pagination.pageIndex).toBe(1)

        applyDataTableViewState(current(), {
            version: 1,
            globalFilter: 'a',
            columnVisibility: { active: false },
        })

        await expect.poll(() => toolsState().globalFilter).toBe('a')
        const state = toolsState()
        expect(state.sorting).toEqual([{ id: 'name', desc: false }])
        expect(state.columnFilters).toEqual([])
        expect(state.columnVisibility).toEqual({ active: false })
        expect(state.columnOrder).toEqual([])
        expect(state.columnPinning).toEqual({ start: [], end: [] })
        expect(state.pagination).toEqual({ pageIndex: 0, pageSize: 4 })
        // Selection is not part of a view.
        expect(state.rowSelection).toEqual({ 'person-3': true })
        expect(current().store.state.columnSizing).toEqual({})
        expect(current().store.state.grouping).toEqual([])

        applyDataTableViewState(current(), fullView)

        await expect.poll(() => toolsState().pagination.pageSize).toBe(5)
        expect(getDataTableViewState(current())).toEqual(fullView)
        expect(toolsState().pagination.pageIndex).toBe(0)
    })

    it('applies a view in server mode, ending on page 0', async () => {
        await render(
            <ToolsHarness
                options={{
                    mode: 'server',
                    rowCount: 100,
                    initialState: {
                        pagination: { pageIndex: 3, pageSize: 10 },
                    },
                }}
                onTable={(table) => {
                    latest = table
                }}
            />
        )

        applyDataTableViewState(current(), {
            version: 1,
            sorting: [{ id: 'age', desc: false }],
            pageSize: 25,
        })

        await expect
            .poll(() => toolsState().pagination)
            .toEqual({ pageIndex: 0, pageSize: 25 })
        expect(toolsState().sorting).toEqual([{ id: 'age', desc: false }])
    })
})
