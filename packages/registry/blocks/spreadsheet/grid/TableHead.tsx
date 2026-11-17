import i18n from '@dhis2/d2-i18n'
import { useMemo } from 'react'
import type { RefObject, SyntheticEvent } from 'react'
import { cn } from '@/components/dhis2/ui/cn'
import type { GridColumn, GridTable } from '../model/types'
import { useSpreadsheetContext } from '../provider/context'
import { ACTIONS_CLASS, ActionsButton, takesColumnActions } from './BulkMenu'
import type { BulkTarget } from './BulkMenu'
import { drawnHeadings, headingsOver } from './columnWindow'
import type { ColumnWindow, DrawnHeading } from './columnWindow'
import { headerDomId } from './headers'
import { BORDER_CLASS, ROW_HEADER_CLASS } from './RowHeader'
import { LAST_CLASS } from './TableRow'

const HEADER_CLASS = cn(
    BORDER_CLASS,
    'bg-dhis2-muted px-2 py-1.5 text-start align-bottom text-[13px] font-medium text-dhis2-foreground'
)

interface HeadingProps {
    heading: DrawnHeading
    /** The DOM id of its label, which alone names the cells; a button in the heading is not part of it. */
    labelId: string
    /** It covers the table's last column, whose line is the actions column's own. */
    last: boolean
    table: GridTable
    /** The column it names, when that column takes column actions. */
    column?: GridColumn
    measure(element: Element | null): void
    openMenu(target: BulkTarget): void
}

/** A heading over several columns: its label stays beside the row headers when the group is wider than the screen. */
const GroupHeading = ({ heading, labelId, last }: HeadingProps) => {
    const { cell, start, span, drawn } = heading
    return (
        <th
            colSpan={span}
            rowSpan={cell.rowSpan}
            scope="col"
            aria-colindex={start + 2}
            className={cn(HEADER_CLASS, 'min-w-28', last && LAST_CLASS)}
        >
            <span
                id={labelId}
                className={cn(
                    'sticky start-[min(12rem,30vw)] inline-block',
                    // Over only some of its columns, its words never widen them.
                    drawn < cell.span && '[overflow-wrap:anywhere]'
                )}
            >
                {cell.label}
            </span>
        </th>
    )
}

/** The heading of one column, which is measured by it, with the column's actions. */
const ColumnHeading = ({
    heading,
    labelId,
    last,
    table,
    column,
    measure,
    openMenu,
}: HeadingProps) => {
    const { cell, first } = heading
    return (
        <th
            ref={measure}
            data-column={first}
            rowSpan={cell.rowSpan}
            scope="col"
            aria-colindex={first + 2}
            className={cn(HEADER_CLASS, 'min-w-28', last && LAST_CLASS)}
        >
            <span className="flex items-end justify-between gap-1">
                <span id={labelId}>{cell.label}</span>
                {column === undefined ? null : (
                    <ActionsButton
                        id={`${labelId}-actions`}
                        label={i18n.t('Column actions')}
                        labelledBy={labelId}
                        onOpen={(anchor) => openMenu({ anchor, table, column })}
                    />
                )}
            </span>
        </th>
    )
}

interface TableHeadProps {
    idScope: string
    table: GridTable
    /** The ids of the column headers that name each column's cells. */
    labels: ReadonlyArray<string>
    columns: ColumnWindow
    head: RefObject<HTMLTableSectionElement>
    /** The sticky cells at each end of the first heading row. */
    startInset: RefObject<HTMLTableCellElement>
    endInset: RefObject<HTMLTableCellElement>
    measure(element: Element | null): void
    note(event: SyntheticEvent): void
    openMenu(target: BulkTarget): void
}

/**
 * A table's sticky heading rows, only the headings over the drawn columns in them: a group spans the columns of its
 * own that are drawn, and a gap holds the place of the columns left out between two headings.
 */
export const TableHead = ({
    idScope,
    table,
    labels,
    columns,
    head,
    startInset,
    endInset,
    measure,
    note,
    openMenu,
}: TableHeadProps) => {
    const context = useSpreadsheetContext()
    const over = useMemo(() => headingsOver(table), [table])
    // The column each leaf heading names, for the columns that take column actions.
    const bulkLeaves = useMemo(
        () =>
            new Map(
                table.columns.flatMap(
                    (column, c): Array<[string, GridColumn]> =>
                        takesColumnActions(context, table, column)
                            ? [[labels[c].split(' ').at(-1) ?? '', column]]
                            : []
                )
            ),
        [context, table, labels]
    )
    const count = table.columns.length
    return (
        // oxlint-disable-next-line jsx-a11y/no-noninteractive-element-interactions -- notes which column's heading holds focus; the buttons inside are the controls
        <thead
            ref={head}
            className="sticky top-0 z-20"
            onFocus={note}
            onPointerDown={note}
        >
            {table.headerRows.map((_, level) => (
                <tr key={level} aria-rowindex={level + 1}>
                    {level === 0 ? (
                        <td
                            ref={startInset}
                            rowSpan={table.headerRows.length}
                            aria-colindex={1}
                            className={cn(
                                HEADER_CLASS,
                                ROW_HEADER_CLASS,
                                'sticky start-0 z-10'
                            )}
                        />
                    ) : null}
                    {drawnHeadings(over, level, columns, count).map(
                        (heading) => {
                            if (heading.gap !== undefined) {
                                return (
                                    <td
                                        key={`gap-${heading.before}`}
                                        aria-hidden="true"
                                        className="border-b border-dhis2-border bg-dhis2-muted p-0"
                                        style={{ minWidth: heading.gap }}
                                    />
                                )
                            }
                            const labelId = headerDomId(
                                idScope,
                                table.id,
                                heading.cell.id
                            )
                            const Heading =
                                heading.cell.span > 1
                                    ? GroupHeading
                                    : ColumnHeading
                            return (
                                <Heading
                                    key={heading.cell.id}
                                    heading={heading}
                                    labelId={labelId}
                                    last={heading.last === count - 1}
                                    table={table}
                                    column={bulkLeaves.get(labelId)}
                                    measure={measure}
                                    openMenu={openMenu}
                                />
                            )
                        }
                    )}
                    {level === 0 ? (
                        <td
                            ref={endInset}
                            rowSpan={table.headerRows.length}
                            aria-colindex={count + 2}
                            className={cn(HEADER_CLASS, ACTIONS_CLASS)}
                        />
                    ) : null}
                </tr>
            ))}
        </thead>
    )
}
