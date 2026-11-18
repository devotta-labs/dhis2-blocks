import type {
    ColumnFiltersState,
    PaginationState,
    SortingState,
} from '@tanstack/react-table'
import { filterFn_includesString } from '@tanstack/react-table'
import { useState } from 'react'
import { page } from 'vitest/browser'
import { render } from 'vitest-browser-react'
import { announce } from '@/components/dhis2/ui/announcer'
import {
    DataTable,
    dataTableFilterFn,
    useDataTable,
    useDataTableInstance,
    type DataTableInstance,
    type DataTableState,
    type DataTableStatus,
    type UseDataTableOptions,
} from '..'
import { liveRegion } from '../../../test/liveRegion'
import { useAppTable } from '../tableHook'
import {
    StateProbe,
    makePeople,
    personColumns,
    type Person,
} from './dataTableTestSupport'

type HarnessOptions = Omit<
    UseDataTableOptions<Person>,
    'data' | 'columns' | 'getRowId'
>

interface Snapshot {
    sorting: string
    columnFilters: string
    globalFilter: string
    pageIndex: number
}

const people = makePeople(25)
const getRowId = (person: Person) => person.id
const startPage: PaginationState = { pageIndex: 2, pageSize: 10 }
const settle = (ms = 100) => new Promise((resolve) => setTimeout(resolve, ms))

let renders: Snapshot[] = []
let latest: DataTableInstance<Person> | undefined

const current = (): DataTableInstance<Person> => {
    if (!latest) throw new Error('The harness has not rendered.')
    return latest
}

const names = () =>
    current()
        .getRowModel()
        .rows.map((row) => row.original.name)

const record = (state: DataTableState) => {
    renders.push({
        sorting: JSON.stringify(state.sorting),
        columnFilters: JSON.stringify(state.columnFilters),
        globalFilter: String(state.globalFilter ?? ''),
        pageIndex: state.pagination.pageIndex,
    })
}

/** Records what a part sees through context, as well as the caller's view. */
const Recorder = () => {
    const table = useDataTableInstance()
    record(table.state)
    return null
}

const changes = [
    {
        slice: 'sorting',
        button: 'Sort by age',
        apply: (table: DataTableInstance<Person>) =>
            table.setSorting([{ id: 'age', desc: true }]),
        isNew: (snapshot: Snapshot) =>
            snapshot.sorting === '[{"id":"age","desc":true}]',
    },
    {
        slice: 'column filters',
        button: 'Filter Bo',
        apply: (table: DataTableInstance<Person>) =>
            table
                .getColumn('district')
                ?.setFilterValue({ kind: 'options', values: ['Bo'] }),
        isNew: (snapshot: Snapshot) =>
            snapshot.columnFilters.includes('"district"'),
    },
    {
        slice: 'global filter',
        button: 'Search Amina',
        apply: (table: DataTableInstance<Person>) =>
            table.setGlobalFilter('Amina'),
        isNew: (snapshot: Snapshot) => snapshot.globalFilter === 'Amina',
    },
]

const Harness = ({
    options,
    data = people,
}: {
    options: HarnessOptions
    data?: Person[]
}) => {
    const table = useDataTable({
        data,
        columns: personColumns,
        getRowId,
        ...options,
    })
    latest = table
    record(table.state)
    return (
        <DataTable table={table} label="People">
            {changes.map((change) => (
                <button
                    key={change.button}
                    type="button"
                    onClick={() => change.apply(current())}
                >
                    {change.button}
                </button>
            ))}
            <Recorder />
            <StateProbe />
        </DataTable>
    )
}

type QuerySlice = 'sorting' | 'columnFilters' | 'globalFilter' | 'pagination'

/** Server mode with the listed slices in the caller's React state. */
const Controlled = ({ slices }: { slices: readonly QuerySlice[] }) => {
    const [sorting, setSorting] = useState<SortingState>([])
    const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([])
    const [globalFilter, setGlobalFilter] = useState('')
    const [pagination, setPagination] = useState(startPage)
    const has = (slice: QuerySlice) => slices.includes(slice)
    return (
        <Harness
            options={{
                mode: 'server',
                initialState: { pagination: startPage },
                state: {
                    rowSelection: { 'person-4': true },
                    ...(has('sorting') && { sorting }),
                    ...(has('columnFilters') && { columnFilters }),
                    ...(has('globalFilter') && { globalFilter }),
                    ...(has('pagination') && { pagination }),
                },
                ...(has('sorting') && { onSortingChange: setSorting }),
                ...(has('columnFilters') && {
                    onColumnFiltersChange: setColumnFilters,
                }),
                ...(has('globalFilter') && {
                    onGlobalFilterChange: setGlobalFilter,
                }),
                ...(has('pagination') && { onPaginationChange: setPagination }),
            }}
        />
    )
}

/**
 * Server mode with every query slice in an external atom. Another table's base
 * atoms stand in for atoms the caller would create with TanStack Store.
 */
const WithAtoms = () => {
    const store = useAppTable<Person>({
        data: [],
        columns: personColumns,
        initialState: { pagination: startPage },
    })
    return (
        <Harness
            options={{
                mode: 'server',
                state: { rowSelection: { 'person-4': true } },
                atoms: {
                    sorting: store.baseAtoms.sorting,
                    columnFilters: store.baseAtoms.columnFilters,
                    globalFilter: store.baseAtoms.globalFilter,
                    pagination: store.baseAtoms.pagination,
                },
            }}
        />
    )
}

beforeEach(() => {
    renders = []
    latest = undefined
})

describe('client mode', () => {
    it('sorts, filters and pages the rows itself', async () => {
        await render(<Harness options={{}} />)
        expect(names()).toEqual(people.slice(0, 10).map((p) => p.name))
        expect(current().getPageCount()).toBe(3)

        current().setSorting([{ id: 'age', desc: false }])
        const byAge = people.toSorted((a, b) => a.age - b.age)
        await expect.poll(names).toEqual(byAge.slice(0, 10).map((p) => p.name))

        current().nextPage()
        await expect.poll(names).toEqual(byAge.slice(10, 20).map((p) => p.name))

        current().resetSorting()
        current()
            .getColumn('district')
            ?.setFilterValue({ kind: 'options', values: ['Bo'] })
        await expect
            .poll(names)
            .toEqual(
                people.filter((p) => p.district === 'Bo').map((p) => p.name)
            )

        current().resetColumnFilters()
        current().setGlobalFilter('amina')
        await expect.poll(names).toEqual(['Amina 1', 'Amina 12', 'Amina 23'])
    })
})

describe('server mode', () => {
    it('leaves the rows as given', async () => {
        await render(<Harness options={{ mode: 'server' }} />)
        const given = people.map((p) => p.name)
        expect(names()).toEqual(given)

        current().setSorting([{ id: 'age', desc: true }])
        current().setGlobalFilter('Amina')
        current()
            .getColumn('district')
            ?.setFilterValue({ kind: 'options', values: ['Bo'] })
        current().setPageIndex(1)
        await expect
            .element(page.getByTestId('state'))
            .toHaveTextContent('"pageIndex":1')
        expect(names()).toEqual(given)
    })

    it('reports an unknown page count without rowCount', async () => {
        await render(<Harness options={{ mode: 'server' }} />)
        expect(current().getPageCount()).toBe(-1)
        expect(current().getCanNextPage()).toBe(true)
    })

    it('counts pages from rowCount, also when it arrives later', async () => {
        const screen = await render(<Harness options={{ mode: 'server' }} />)
        expect(current().getPageCount()).toBe(-1)
        await screen.rerender(
            <Harness options={{ mode: 'server', rowCount: 95 }} />
        )
        expect(current().getRowCount()).toBe(95)
        expect(current().getPageCount()).toBe(10)
        expect(current().getCanNextPage()).toBe(true)
    })
})

const owners = [
    {
        owner: 'internal state',
        ui: () => (
            <Harness
                options={{
                    mode: 'server',
                    initialState: {
                        pagination: startPage,
                        rowSelection: { 'person-4': true },
                    },
                }}
            />
        ),
    },
    {
        owner: 'controlled state',
        ui: () => (
            <Controlled
                slices={[
                    'sorting',
                    'columnFilters',
                    'globalFilter',
                    'pagination',
                ]}
            />
        ),
    },
    {
        owner: 'internal query state with a controlled page',
        ui: () => <Controlled slices={['pagination']} />,
    },
    {
        owner: 'controlled query state with an internal page',
        ui: () => (
            <Controlled slices={['sorting', 'columnFilters', 'globalFilter']} />
        ),
    },
    { owner: 'external atoms', ui: () => <WithAtoms /> },
]

const triggers = [
    {
        trigger: 'a click',
        run: (change: (typeof changes)[number]) =>
            page.getByRole('button', { name: change.button }).click(),
    },
    {
        trigger: 'a call outside an event',
        run: (change: (typeof changes)[number]) => {
            change.apply(current())
        },
    },
]

describe('server mode page reset', () => {
    describe.each(owners)('with $owner', ({ ui }) => {
        describe.each(triggers)('from $trigger', ({ run }) => {
            it.each(changes)(
                'moves to the first page when $slice changes, in the same render',
                async (change) => {
                    await render(ui())
                    await expect
                        .element(page.getByTestId('state'))
                        .toHaveTextContent('"pageIndex":2')

                    await run(change)
                    await expect
                        .poll(() => renders.some(change.isNew))
                        .toBe(true)
                    await settle()

                    const stale = renders.filter(
                        (snapshot) =>
                            change.isNew(snapshot) && snapshot.pageIndex !== 0
                    )
                    expect(stale).toEqual([])
                    expect(renders.at(-1)).toMatchObject({ pageIndex: 0 })
                    expect(current().store.state.rowSelection).toEqual({
                        'person-4': true,
                    })
                }
            )
        })

        it('keeps the page when a change leaves the query as it was', async () => {
            await render(ui())
            current().setSorting([])
            current().setGlobalFilter('')
            current().setColumnFilters([])
            await settle()
            expect(current().store.state.pagination.pageIndex).toBe(2)
        })
    })
})

describe('defaults', () => {
    it('applies the column and table defaults', async () => {
        await render(<Harness options={{}} />)
        const name = current().getColumn('name')
        expect(name?.getSize()).toBe(180)
        expect(name?.columnDef.minSize).toBe(64)
        expect(name?.columnDef.maxSize).toBe(640)
        expect(name?.getFilterFn()).toBe(dataTableFilterFn)
        expect(current().options).toMatchObject({
            enableSortingRemoval: true,
            sortDescFirst: false,
            columnResizeMode: 'onChange',
            globalFilterFn: 'includesString',
        })
    })

    it('merges the caller defaultColumn over the defaults', async () => {
        await render(
            <Harness
                options={{
                    sortDescFirst: true,
                    defaultColumn: { size: 300, filterFn: 'includesString' },
                }}
            />
        )
        const name = current().getColumn('name')
        expect(name?.getSize()).toBe(300)
        expect(name?.columnDef.minSize).toBe(64)
        expect(name?.columnDef.maxSize).toBe(640)
        expect(name?.getFilterFn()).toBe(filterFn_includesString)
        expect(current().options.sortDescFirst).toBe(true)
    })
})

describe('DataTable announcements', () => {
    let said: string[] = []
    let observer: MutationObserver | undefined

    beforeEach(async () => {
        announce('')
        await settle(400)
        said = []
        observer = new MutationObserver(() => {
            const text = liveRegion().textContent
            if (text) said.push(text)
        })
        observer.observe(liveRegion(), {
            childList: true,
            characterData: true,
            subtree: true,
        })
    })

    afterEach(async () => {
        observer?.disconnect()
        await settle(400)
    })

    const Announcing = ({ status }: { status: DataTableStatus }) => {
        const table = useDataTable({
            data: people,
            columns: personColumns,
            getRowId,
        })
        return (
            <DataTable table={table} label="People" status={status}>
                <StateProbe />
            </DataTable>
        )
    }

    it('says nothing on mount', async () => {
        await render(<Announcing status="ready" />)
        await settle(400)
        await render(<Announcing status="loading" />)
        await settle(400)
        expect(said).toEqual([])
    })

    it('announces the rows when loading or updating ends, and errors', async () => {
        const screen = await render(<Announcing status="loading" />)
        await screen.rerender(<Announcing status="ready" />)
        await expect.poll(() => said).toEqual(['10 rows shown'])

        await screen.rerender(<Announcing status="updating" />)
        await screen.rerender(<Announcing status="error" />)
        await expect
            .poll(() => said)
            .toEqual(['10 rows shown', 'The list could not be loaded.'])

        await screen.rerender(<Announcing status="updating" />)
        await screen.rerender(<Announcing status="ready" />)
        await expect
            .poll(() => said)
            .toEqual([
                '10 rows shown',
                'The list could not be loaded.',
                '10 rows shown',
            ])

        await screen.rerender(<Announcing status="loading" />)
        await settle(400)
        expect(said).toHaveLength(3)
    })
})
