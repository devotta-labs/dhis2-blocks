import type { ReactNode } from 'react'
import { page } from 'vitest/browser'
import { z } from 'zod'
import {
    DataTable,
    useDataTable,
    useDataTableInstance,
    type DataTableColumnDef,
    type DataTableInstance,
    type UseDataTableOptions,
} from '..'
import {
    StateProbe,
    makePeople,
    personColumns,
    type Person,
} from './dataTableTestSupport'

type ToolsHarnessOptions = Omit<
    UseDataTableOptions<Person>,
    'data' | 'columns' | 'getRowId'
>

const defaultPeople = makePeople(12)
const getRowId = (person: Person) => person.id

/** A bare grid, so the tools can be tested without the grid parts. */
export const ToolsGrid = () => {
    const table = useDataTableInstance()
    return (
        <table>
            <thead>
                {table.getHeaderGroups().map((group) => (
                    <tr key={group.id}>
                        {group.headers.map((header) => (
                            <th key={header.id}>
                                {header.isPlaceholder ? null : (
                                    <table.FlexRender header={header} />
                                )}
                            </th>
                        ))}
                    </tr>
                ))}
            </thead>
            <tbody>
                {table.getRowModel().rows.map((row) => (
                    <tr key={row.id} data-row-id={row.id}>
                        {row.getVisibleCells().map((cell) => (
                            <td key={cell.id}>
                                <table.FlexRender cell={cell} />
                            </td>
                        ))}
                    </tr>
                ))}
            </tbody>
        </table>
    )
}

/** The tools under test, a bare grid and the state probe inside `<DataTable>`. */
export const ToolsHarness = ({
    children,
    options,
    columns = personColumns,
    data = defaultPeople,
    onTable,
}: {
    children?: ReactNode
    options?: ToolsHarnessOptions
    columns?: DataTableColumnDef<Person>[]
    data?: Person[]
    onTable?: (table: DataTableInstance<Person>) => void
}) => {
    const table = useDataTable({ data, columns, getRowId, ...options })
    onTable?.(table)
    return (
        <DataTable table={table} label="People">
            {children}
            <ToolsGrid />
            <StateProbe />
        </DataTable>
    )
}

const probeSchema = z.object({
    sorting: z.array(z.object({ id: z.string(), desc: z.boolean() })),
    columnFilters: z.array(z.object({ id: z.string(), value: z.json() })),
    globalFilter: z.json().optional(),
    pagination: z.object({ pageIndex: z.number(), pageSize: z.number() }),
    rowSelection: z.record(z.string(), z.boolean()),
    columnVisibility: z.record(z.string(), z.boolean()),
    columnOrder: z.array(z.string()),
    columnPinning: z.object({
        start: z.array(z.string()),
        end: z.array(z.string()),
    }),
})

/** The `StateProbe` output, parsed. */
export const toolsState = () =>
    probeSchema.parse(
        JSON.parse(page.getByTestId('state').element().textContent ?? '{}')
    )

/** The names in the bare grid's body, in order. */
export const toolsRowNames = () =>
    Array.from(
        document.querySelectorAll('tbody tr td:first-child'),
        (cell) => cell.textContent ?? ''
    )
