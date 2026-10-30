import {
    Cell,
    useDataEntry,
    type CellKey,
    type GridColumn,
    type GridRow,
    type GridTable,
    type NavKey,
} from '@/components/data-entry'
import { useState } from 'react'

/**
 * A layout of your own, from the block's public pieces: `useDataEntry` for the rows, `Cell` for each field. Every
 * element of a row (its name, its status, its buttons, each field) can be pinned to the first column, shown in
 * order, or left out.
 */

type Placement = 'pinned' | 'shown' | 'hidden'

interface Element {
    id: string
    label: string
    column?: GridColumn
}

const ROW_ELEMENTS: Element[] = [
    { id: 'row:name', label: 'Row name' },
    { id: 'row:status', label: 'Status' },
    { id: 'row:actions', label: 'Complete / reopen' },
]

// Rows and fields each key moves by; Tab is the browser's.
const STEPS = new Map<NavKey, readonly [number, number]>([
    ['up', [-1, 0]],
    ['down', [1, 0]],
    ['enter', [1, 0]],
    ['left', [0, -1]],
    ['right', [0, 1]],
])

const Actions = ({ row }: { row: GridRow }) => {
    const complete = useDataEntry((view) => view.complete)
    const reopen = useDataEntry((view) => view.reopen)
    const [refusal, setRefusal] = useState<string>()
    const completed = row.status === 'COMPLETED'
    return (
        <span className="flex flex-col items-start gap-0.5">
            <button
                type="button"
                className="text-xs text-dhis2-blue-700 underline"
                onClick={async () => {
                    const outcomes = await (completed ? reopen : complete)(
                        row.id
                    )
                    const reasons = outcomes
                        .filter(({ result }) => result === 'failed')
                        .map(({ reason }) => reason)
                    setRefusal(
                        reasons.length > 0 ? reasons.join('; ') : undefined
                    )
                }}
            >
                {completed ? 'Reopen' : 'Complete'}
            </button>
            {refusal === undefined ? null : (
                <span role="status" className="text-xs text-dhis2-red-700">
                    {refusal}
                </span>
            )}
        </span>
    )
}

const ComposedTable = ({
    table,
    pinned,
    shown,
}: {
    table: GridTable
    pinned: Element[]
    shown: Element[]
}) => {
    const columns = new Set(table.columns.map(({ id }) => id))
    const usable = (element: Element) =>
        element.column === undefined || columns.has(element.column.id)
    const pinnedHere = pinned.filter(usable)
    const shownHere = shown.filter(usable)
    // The fields in the order they show, for the arrows: pinned first, then the rest.
    const fields = [...pinnedHere, ...shownHere].flatMap(({ column }) =>
        column === undefined ? [] : [column.id]
    )
    const headerId = (id: string) => `lab-${table.id}-header-${id}`
    const rowNameId = (row: GridRow) => `lab-${table.id}-row-${row.id}`

    // shortcut: the grid's own navigation is not exported, so this layout moves focus itself (no right-to-left
    // flip, no Tab memory); export `nextCell` and `cellDomId` from the block if layouts of your own need them.
    const move = (from: CellKey) => (key: NavKey) => {
        const rowAt = table.rows.findIndex(({ id }) =>
            from.startsWith(`${id}.`)
        )
        const fieldAt = fields.indexOf(from.slice(from.indexOf('.') + 1))
        const step = STEPS.get(key)
        const row = table.rows[rowAt + (step?.[0] ?? 0)]
        const field = fields[fieldAt + (step?.[1] ?? 0)]
        if (step === undefined || row === undefined || field === undefined) {
            return
        }
        document
            .getElementById(`lab-${table.id}`)
            ?.querySelector<HTMLElement>(`[id$="-cell-${row.id}.${field}"]`)
            ?.focus()
    }

    const render = (element: Element, row: GridRow) => {
        if (element.column === undefined) {
            if (element.id === 'row:name') {
                return <span>{row.label}</span>
            }
            if (element.id === 'row:status') {
                return (
                    <span className="rounded-full bg-dhis2-grey-200 px-1.5 text-xs">
                        {row.status ?? 'ACTIVE'}
                    </span>
                )
            }
            return <Actions row={row} />
        }
        const key: CellKey = `${row.id}.${element.column.id}`
        return (
            <Cell
                cellKey={key}
                field={element.column.field}
                labelledBy={`${headerId(element.id)} ${rowNameId(row)}`}
                closedReason={table.closed.get(key)}
                move={move(key)}
            />
        )
    }

    const stickyClass = 'sticky start-0 z-10 bg-white'
    const cellClass = 'border-b border-e border-dhis2-grey-300 p-0 align-top'

    return (
        <div className="flex flex-col gap-2">
            <h2 className="text-base font-medium">{table.title}</h2>
            <div className="max-h-[70vh] overflow-auto rounded border border-dhis2-grey-300">
                <table
                    id={`lab-${table.id}`}
                    className="border-separate border-spacing-0 text-sm"
                >
                    <thead className="sticky top-0 z-20 bg-dhis2-grey-100">
                        <tr>
                            {pinnedHere.length === 0 ? null : (
                                <th
                                    className={`${stickyClass} ${cellClass} bg-dhis2-grey-100 px-2 py-1 text-start font-medium`}
                                >
                                    {pinnedHere.map((element) => (
                                        <span
                                            key={element.id}
                                            id={headerId(element.id)}
                                            className="block"
                                        >
                                            {element.label}
                                        </span>
                                    ))}
                                </th>
                            )}
                            {shownHere.map((element) => (
                                <th
                                    key={element.id}
                                    id={headerId(element.id)}
                                    className={`${cellClass} min-w-28 px-2 py-1 text-start font-medium`}
                                >
                                    {element.label}
                                </th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {table.rows.map((row) => (
                            <tr key={row.id}>
                                {pinnedHere.length === 0 ? null : (
                                    <th
                                        scope="row"
                                        className={`${stickyClass} ${cellClass} min-w-40 px-2 py-1 text-start font-normal`}
                                    >
                                        <span
                                            id={rowNameId(row)}
                                            className="sr-only"
                                        >
                                            {row.label}
                                        </span>
                                        <span className="flex flex-col gap-1">
                                            {pinnedHere.map((element) => (
                                                <span key={element.id}>
                                                    {render(element, row)}
                                                </span>
                                            ))}
                                        </span>
                                    </th>
                                )}
                                {shownHere.map((element, at) => (
                                    <td
                                        key={element.id}
                                        className={`${cellClass} ${element.column === undefined ? 'px-2 py-1' : ''}`}
                                    >
                                        {pinnedHere.length === 0 && at === 0 ? (
                                            <span
                                                id={rowNameId(row)}
                                                className="sr-only"
                                            >
                                                {row.label}
                                            </span>
                                        ) : null}
                                        {render(element, row)}
                                    </td>
                                ))}
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    )
}

const PlacementEditor = ({
    elements,
    placements,
    setPlacement,
    moveElement,
}: {
    elements: Element[]
    placements: ReadonlyMap<string, Placement>
    setPlacement: (id: string, placement: Placement) => void
    moveElement: (id: string, by: number) => void
}) => (
    <details open className="rounded border border-dhis2-grey-300 p-2 text-sm">
        <summary className="cursor-pointer font-medium">
            Row elements: where each one goes
        </summary>
        <ol className="mt-2 grid grid-cols-[repeat(auto-fill,minmax(16rem,1fr))] gap-x-4 gap-y-1">
            {elements.map((element, at) => (
                <li key={element.id} className="flex items-center gap-1.5">
                    <select
                        aria-label={`Where ${element.label} goes`}
                        value={placements.get(element.id) ?? 'shown'}
                        onChange={(event) =>
                            setPlacement(
                                element.id,
                                event.target.value === 'pinned' ||
                                    event.target.value === 'hidden'
                                    ? event.target.value
                                    : 'shown'
                            )
                        }
                        className="rounded border border-dhis2-grey-500 px-1 py-0.5"
                    >
                        <option value="pinned">Pinned</option>
                        <option value="shown">Shown</option>
                        <option value="hidden">Hidden</option>
                    </select>
                    <button
                        type="button"
                        aria-label={`Move ${element.label} earlier`}
                        disabled={at === 0}
                        onClick={() => moveElement(element.id, -1)}
                        className="px-1 disabled:opacity-30"
                    >
                        ↑
                    </button>
                    <button
                        type="button"
                        aria-label={`Move ${element.label} later`}
                        disabled={at === elements.length - 1}
                        onClick={() => moveElement(element.id, 1)}
                        className="px-1 disabled:opacity-30"
                    >
                        ↓
                    </button>
                    <span className="truncate">{element.label}</span>
                </li>
            ))}
        </ol>
    </details>
)

/** Every table of the form in a layout of your own, with the panel that says where each row element goes. */
export const ComposedGrid = () => {
    const tables = useDataEntry((view) => view.tables)
    const [placements, setPlacements] = useState<
        ReadonlyMap<string, Placement>
    >(new Map([['row:name', 'pinned']]))
    const [order, setOrder] = useState<string[]>([])

    // The row's name, every field of every table once, then the row's status and buttons; until something is moved,
    // and for a field a page adds later, in that order.
    const [name, ...rest] = ROW_ELEMENTS
    const byId = new Map<string, Element>(
        [
            name,
            ...tables.flatMap((table) =>
                table.columns.map((column) => ({
                    id: column.id,
                    label: column.label,
                    column,
                }))
            ),
            ...rest,
        ].map((element) => [element.id, element])
    )
    const ordered = [
        ...order,
        ...[...byId.keys()].filter((id) => !order.includes(id)),
    ].flatMap((id) => {
        const element = byId.get(id)
        return element === undefined ? [] : [element]
    })
    const placed = (placement: Placement) =>
        ordered.filter(
            ({ id }) => (placements.get(id) ?? 'shown') === placement
        )

    return (
        <div className="flex flex-col gap-4">
            <PlacementEditor
                elements={ordered}
                placements={placements}
                setPlacement={(id, placement) =>
                    setPlacements(new Map(placements).set(id, placement))
                }
                moveElement={(id, by) => {
                    const ids = ordered.map((element) => element.id)
                    const from = ids.indexOf(id)
                    ids.splice(from, 1)
                    ids.splice(from + by, 0, id)
                    setOrder(ids)
                }}
            />
            {tables.map((table) => (
                <ComposedTable
                    key={table.id}
                    table={table}
                    pinned={placed('pinned')}
                    shown={placed('shown')}
                />
            ))}
        </div>
    )
}
