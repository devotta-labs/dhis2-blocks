import React from 'react'
import type {
    WorkingListDisplayRow,
    WorkingListPageSize,
} from '../../provider/contracts'
import { cn } from '@/registry/dhis2/ui/cn'
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/registry/dhis2/ui/table'
import { useWorkingListText } from '../WorkingListText'
import { WorkingListPagination } from './WorkingListPagination'

export interface WorkingListTableHeaderView {
    id: string
    fieldId: string
    content: React.ReactNode
    canSort: boolean
    isDataQuality: boolean
    sorted: false | 'asc' | 'desc'
    onToggleSorting: (event: React.MouseEvent<HTMLButtonElement>) => void
}

interface WorkingListTableHeaderGroupView {
    id: string
    headers: WorkingListTableHeaderView[]
}

interface WorkingListTableCellView {
    id: string
    fieldId: string
    content: React.ReactNode
    isDataQuality: boolean
}

interface WorkingListTableRowView {
    id: string
    displayIndex: number
    original: WorkingListDisplayRow
    cells: WorkingListTableCellView[]
}

export interface WorkingListTableViewModel {
    headerGroups: WorkingListTableHeaderGroupView[]
    rows: WorkingListTableRowView[]
}

export interface WorkingListTableViewProps {
    model: WorkingListTableViewModel
    visibleColumnCount: number
    dataQualityMode: 'hidden' | 'highlighted'
    page: number
    pageSize: WorkingListPageSize
    hasNextPage: boolean
    isInitialLoading: boolean
    isUpdating: boolean
    configurationDisabled?: boolean
    onPageChange: (page: number) => void
    onPageSizeChange: (pageSize: WorkingListPageSize) => void
    onRowOpen?: (row: WorkingListDisplayRow) => void
}

const isInteractiveTarget = (target: EventTarget | null) =>
    target instanceof Element &&
    Boolean(
        target.closest(
            'a, button, input, select, textarea, summary, [role="button"], [role="link"]'
        )
    )

/** The sort indicator @dhis2/ui DataTableColumnHeader draws. */
const SortIndicator = ({ sorted }: { sorted: false | 'asc' | 'desc' }) => (
    <span
        aria-hidden="true"
        data-slot="sort-indicator"
        data-direction={sorted || 'none'}
        className="ms-0.5 flex size-6 shrink-0 items-center justify-center rounded-dhis2-md group-hover/sort:bg-dhis2-grey-400 group-focus-visible/sort:bg-dhis2-grey-400 group-disabled/sort:bg-transparent"
    >
        <svg viewBox="0 0 16 16" className="size-4">
            {/* DHIS2 names these "top" and "bottom" by stacking order, not
                by direction: ascending highlights the down-pointing one. */}
            <polygon
                points="4 9 12 9 8 14"
                className={
                    sorted === 'asc'
                        ? 'fill-dhis2-blue-700'
                        : 'fill-dhis2-grey-500'
                }
            />
            <polygon
                points="4 7 12 7 8 2"
                className={
                    sorted === 'desc'
                        ? 'fill-dhis2-blue-700'
                        : 'fill-dhis2-grey-500'
                }
            />
        </svg>
    </span>
)

// The @dhis2/ui DataTableBody `loading` state: a white veil over the body
// with a CircularLoader-style ring in the middle.
const loadingBodyClassName =
    "before:absolute before:inset-0 before:bg-white/80 before:content-[''] after:absolute after:start-[calc(50%-24px)] after:top-[calc(50%-24px)] after:size-12 after:animate-spin after:rounded-full after:border-6 after:border-dhis2-grey-600/15 after:border-b-dhis2-blue-600 after:content-['']"

export const WorkingListTableView = ({
    model,
    visibleColumnCount,
    dataQualityMode,
    page,
    pageSize,
    hasNextPage,
    isInitialLoading,
    isUpdating,
    configurationDisabled = false,
    onPageChange,
    onPageSizeChange,
    onRowOpen,
}: WorkingListTableViewProps) => {
    const i18n = { t: useWorkingListText() }
    const showIssuesColumn = dataQualityMode === 'highlighted'
    const interactive = Boolean(onRowOpen)
    const openRow = (row: WorkingListDisplayRow) => onRowOpen?.(row)

    return (
        <div
            className="w-full min-w-0 max-w-full"
            data-testid="working-list-results"
        >
            <div
                className="w-full min-w-0 max-w-full overflow-x-auto [contain:layout] [overscroll-behavior-inline:contain]"
                data-testid="working-list-table-scroll"
            >
                <div className="min-w-[680px]" data-testid="working-list-table">
                    <Table data-test="working-list-data-table">
                        <TableHeader>
                            {model.headerGroups.map((group) => (
                                <TableRow key={group.id}>
                                    {group.headers.map((header) => {
                                        if (header.isDataQuality) {
                                            return (
                                                <TableHead
                                                    key={header.id}
                                                    scope="col"
                                                    className="w-px min-w-0 text-center whitespace-nowrap"
                                                >
                                                    {header.content}
                                                </TableHead>
                                            )
                                        }
                                        return (
                                            <TableHead
                                                key={header.id}
                                                scope="col"
                                                className="py-1.5 whitespace-nowrap"
                                                aria-sort={
                                                    header.sorted === 'asc'
                                                        ? 'ascending'
                                                        : header.sorted ===
                                                            'desc'
                                                          ? 'descending'
                                                          : 'none'
                                                }
                                            >
                                                <button
                                                    type="button"
                                                    className="group/sort flex min-h-6 w-full cursor-pointer items-center border-0 bg-transparent p-0 text-left text-[inherit] [font-weight:inherit] outline-none focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-dhis2-ring/35 disabled:cursor-default"
                                                    data-testid={`sort-${header.fieldId}`}
                                                    disabled={
                                                        !header.canSort ||
                                                        configurationDisabled
                                                    }
                                                    onClick={
                                                        header.onToggleSorting
                                                    }
                                                >
                                                    {header.content}
                                                    <SortIndicator
                                                        sorted={header.sorted}
                                                    />
                                                </button>
                                            </TableHead>
                                        )
                                    })}
                                </TableRow>
                            ))}
                        </TableHeader>
                        <TableBody
                            aria-busy={isInitialLoading || isUpdating}
                            className={
                                isInitialLoading
                                    ? loadingBodyClassName
                                    : undefined
                            }
                        >
                            {isInitialLoading &&
                                model.rows.length === 0 && (
                                    // Gives the loading ring a body to sit in
                                    // before the first page of rows arrives.
                                    <TableRow aria-hidden="true">
                                        <TableCell
                                            colSpan={
                                                Math.max(
                                                    visibleColumnCount,
                                                    1
                                                ) + (showIssuesColumn ? 1 : 0)
                                            }
                                            className="h-32"
                                        />
                                    </TableRow>
                                )}
                            {!isInitialLoading && model.rows.length === 0 && (
                                <TableRow>
                                    <TableCell
                                        colSpan={
                                            Math.max(visibleColumnCount, 1) +
                                            (showIssuesColumn ? 1 : 0)
                                        }
                                        className="min-w-[140px] py-10 text-center"
                                    >
                                        <strong className="mb-1 block font-medium">
                                            {i18n.t('No items to display')}
                                        </strong>
                                        <span className="block">
                                            {i18n.t(
                                                'Try adjusting the filters or organisation unit.'
                                            )}
                                        </span>
                                    </TableCell>
                                </TableRow>
                            )}
                            {model.rows.map((row) => {
                                const highlightIssues =
                                    showIssuesColumn &&
                                    row.original.issues.length > 0
                                const openRowFromCell = (
                                    event: React.MouseEvent<HTMLTableCellElement>
                                ) => {
                                    if (
                                        interactive &&
                                        !isInteractiveTarget(event.target)
                                    ) {
                                        openRow(row.original)
                                    }
                                }
                                return (
                                    <TableRow
                                        key={row.id}
                                        className={
                                            interactive
                                                ? 'cursor-pointer'
                                                : undefined
                                        }
                                        data-test={`working-list-row-${row.id}`}
                                        data-testid={`working-list-row-${row.id}`}
                                        data-invalid={
                                            highlightIssues ? 'true' : undefined
                                        }
                                    >
                                        {row.cells.map((cell, index) => (
                                            <TableCell
                                                key={cell.id}
                                                className={cn(
                                                    cell.isDataQuality
                                                        ? 'w-px min-w-0 text-center whitespace-nowrap'
                                                        : 'min-w-[140px]',
                                                    // A fixed background
                                                    // turns off the hover and
                                                    // press states, as in
                                                    // DataTable.
                                                    highlightIssues &&
                                                        'bg-dhis2-red-050 group-hover/table-row:bg-dhis2-red-050 group-active/table-row:bg-dhis2-red-050'
                                                )}
                                                data-test={
                                                    cell.isDataQuality
                                                        ? `working-list-issues-cell-${row.id}`
                                                        : undefined
                                                }
                                                data-testid={
                                                    cell.isDataQuality
                                                        ? `working-list-issues-cell-${row.id}`
                                                        : undefined
                                                }
                                                onClick={
                                                    interactive
                                                        ? openRowFromCell
                                                        : undefined
                                                }
                                            >
                                                {index === 0 && interactive && (
                                                    <button
                                                        type="button"
                                                        className="sr-only"
                                                        data-testid={`row-open-${row.id}`}
                                                        onClick={() =>
                                                            openRow(
                                                                row.original
                                                            )
                                                        }
                                                    >
                                                        {i18n.t(
                                                            'Open row {{number}}',
                                                            {
                                                                number:
                                                                    row.displayIndex +
                                                                    1,
                                                            }
                                                        )}
                                                    </button>
                                                )}
                                                {cell.content}
                                            </TableCell>
                                        ))}
                                    </TableRow>
                                )
                            })}
                        </TableBody>
                    </Table>
                </div>
            </div>
            <div className="flex min-h-14 w-full min-w-0 max-w-full items-center px-3 py-2">
                <WorkingListPagination
                    page={page}
                    pageSize={pageSize}
                    hasNextPage={hasNextPage}
                    disabled={isInitialLoading}
                    onPageChange={onPageChange}
                    onPageSizeChange={onPageSizeChange}
                />
            </div>
        </div>
    )
}
