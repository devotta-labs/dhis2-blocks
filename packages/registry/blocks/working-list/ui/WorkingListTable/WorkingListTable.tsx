import i18n from '@dhis2/d2-i18n'
import {
    columnOrderingFeature,
    columnVisibilityFeature,
    createColumnHelper,
    functionalUpdate,
    rowPaginationFeature,
    rowSortingFeature,
    tableFeatures,
    useTable,
    type ColumnVisibilityState,
    type PaginationState,
    type SortingState,
} from '@tanstack/react-table'
import React, { useMemo } from 'react'
import type { WorkingListField, WorkingListSort } from '../../domain/model'
import type {
    WorkingListDisplayRow,
    WorkingListPageSize,
} from '../../provider/contracts'
import { DEFAULT_WORKING_LIST_SORT } from '../../query/serialize'
import {
    getCellDisplayValue,
    type CellFormattingContext,
} from '../../registry/valueTypes'
import { fieldDisplayName, localizedField } from '../FilterControls'
import type { WorkingListDataQualityMode } from '../types'
import { cn } from '@/components/dhis2/ui/cn'
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/dhis2/ui/table'
import { CellValue, invalidCellText, RowIssuesMarker } from './cells'
import { WorkingListPagination } from './WorkingListPagination'
import { SkeletonRows, tableScrollClassName } from './WorkingListTableSkeleton'

const tableFeatureSet = tableFeatures({
    columnOrderingFeature,
    columnVisibilityFeature,
    rowPaginationFeature,
    rowSortingFeature,
})

const columnHelper = createColumnHelper<
    typeof tableFeatureSet,
    WorkingListDisplayRow
>()

const EMPTY_ROWS: WorkingListDisplayRow[] = []

/**
 * Trailing display column holding the per-row data-quality marker. The `__`
 * prefix keeps it clear of DHIS2 field ids, and it is filtered out before
 * column configuration changes are reported.
 */
const DATA_QUALITY_COLUMN_ID = '__dataQuality'

/** The column header's sort button. */
export const SORT_BUTTON_CLASS =
    'group/sort flex min-h-6 w-full cursor-pointer items-center border-0 bg-transparent p-0 text-left text-[inherit] [font-weight:inherit] outline-none focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-solid focus-visible:outline-dhis2-ring disabled:cursor-default'

const ariaSortByDirection = {
    asc: 'ascending',
    desc: 'descending',
} as const

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
        className="ms-0.5 flex size-6 shrink-0 items-center justify-center rounded-dhis2-md group-hover/sort:bg-dhis2-accent-strong group-focus-visible/sort:bg-dhis2-accent-strong group-disabled/sort:bg-transparent"
    >
        <svg viewBox="0 0 16 16" className="size-4">
            {/* DHIS2 names these "top" and "bottom" by stacking order, not
                by direction: ascending highlights the down-pointing one. */}
            <polygon
                points="4 9 12 9 8 14"
                className={
                    sorted === 'asc'
                        ? 'fill-dhis2-primary'
                        : 'fill-dhis2-subtle-foreground'
                }
            />
            <polygon
                points="4 7 12 7 8 2"
                className={
                    sorted === 'desc'
                        ? 'fill-dhis2-primary'
                        : 'fill-dhis2-subtle-foreground'
                }
            />
        </svg>
    </span>
)

interface WorkingListDataTableProps {
    allFields: WorkingListField[]
    visibleColumnIds: string[]
    rows?: WorkingListDisplayRow[]
    dataQualityMode?: WorkingListDataQualityMode
    sort: WorkingListSort
    page: number
    pageSize: WorkingListPageSize
    hasNextPage: boolean
    isInitialLoading: boolean
    isUpdating: boolean
    configurationDisabled?: boolean
    /** Absent until the first page is in; nothing is formatted before that. */
    formattingContext?: CellFormattingContext
    onColumnConfigurationChange: (columnIds: string[]) => void
    onPageChange: (page: number) => void
    onPageSizeChange: (pageSize: WorkingListPageSize) => void
    onRowOpen?: (row: WorkingListDisplayRow) => void
    onSortChange: (sort: WorkingListSort) => void
}

export const WorkingListDataTable = ({
    allFields,
    visibleColumnIds,
    rows = EMPTY_ROWS,
    dataQualityMode = 'hidden',
    sort,
    page,
    pageSize,
    hasNextPage,
    isInitialLoading,
    isUpdating,
    configurationDisabled = false,
    formattingContext,
    onColumnConfigurationChange,
    onPageChange,
    onPageSizeChange,
    onRowOpen,
    onSortChange,
}: WorkingListDataTableProps) => {
    const showIssuesColumn = dataQualityMode === 'highlighted'
    const columns = useMemo(() => {
        const fieldColumns = allFields.map((field) =>
            columnHelper.accessor((row) => row.values[field.id], {
                id: field.id,
                header: fieldDisplayName(field),
                enableSorting: true,
                cell: (context) => {
                    const cellValue = context.row.original.values[field.id]
                    if (cellValue && !cellValue.valid) {
                        return <>{invalidCellText(cellValue)}</>
                    }
                    return (
                        <CellValue
                            display={getCellDisplayValue(
                                cellValue?.value,
                                localizedField(field),
                                formattingContext
                            )}
                        />
                    )
                },
            })
        )
        if (!showIssuesColumn) {
            return columnHelper.columns(fieldColumns)
        }
        return columnHelper.columns([
            ...fieldColumns,
            columnHelper.display({
                id: DATA_QUALITY_COLUMN_ID,
                header: () => (
                    <span className="sr-only">{i18n.t('Data quality')}</span>
                ),
                enableSorting: false,
                cell: (context) =>
                    context.row.original.issues.length > 0 ? (
                        <RowIssuesMarker row={context.row.original} />
                    ) : null,
            }),
        ])
    }, [allFields, formattingContext, showIssuesColumn])

    const columnOrder = useMemo(
        () =>
            showIssuesColumn
                ? [...visibleColumnIds, DATA_QUALITY_COLUMN_ID]
                : visibleColumnIds,
        [showIssuesColumn, visibleColumnIds]
    )
    const columnVisibility = useMemo<ColumnVisibilityState>(
        () =>
            Object.fromEntries(
                allFields.map((field) => [
                    field.id,
                    visibleColumnIds.includes(field.id),
                ])
            ),
        [allFields, visibleColumnIds]
    )
    const sorting = useMemo<SortingState>(
        () => [{ id: sort.fieldId, desc: sort.direction === 'desc' }],
        [sort]
    )
    const pagination = useMemo<PaginationState>(
        () => ({ pageIndex: page - 1, pageSize }),
        [page, pageSize]
    )

    const table = useTable(
        {
            features: tableFeatureSet,
            columns,
            data: rows,
            getRowId: (row) => row.id,
            manualPagination: true,
            manualSorting: true,
            pageCount: -1,
            enableMultiSort: false,
            enableSortingRemoval: true,
            sortDescFirst: false,
            state: {
                columnOrder,
                columnVisibility,
                pagination,
                sorting,
            },
            onColumnOrderChange: (updater) => {
                const next = functionalUpdate(updater, columnOrder)
                onColumnConfigurationChange(
                    next.filter(
                        (id) =>
                            id !== DATA_QUALITY_COLUMN_ID &&
                            columnVisibility[id] !== false
                    )
                )
            },
            onColumnVisibilityChange: (updater) => {
                const next = functionalUpdate(updater, columnVisibility)
                onColumnConfigurationChange(
                    allFields
                        .map((field) => field.id)
                        .filter((id) => next[id] !== false)
                )
            },
            onSortingChange: (updater) => {
                const next = functionalUpdate(updater, sorting)
                const first = next[0]
                onSortChange(
                    first
                        ? {
                              fieldId: first.id,
                              direction: first.desc ? 'desc' : 'asc',
                          }
                        : { ...DEFAULT_WORKING_LIST_SORT }
                )
            },
        },
        (state) => ({
            columnOrder: state.columnOrder,
            columnVisibility: state.columnVisibility,
            pagination: state.pagination,
            sorting: state.sorting,
        })
    )

    const interactive = Boolean(onRowOpen)
    const columnCount =
        Math.max(visibleColumnIds.length, 1) + (showIssuesColumn ? 1 : 0)
    const tableRows = table.getRowModel().rows

    return (
        <div
            className="w-full min-w-0 max-w-full"
            data-testid="working-list-results"
        >
            <div className={tableScrollClassName}>
                <div className="min-w-[680px]" data-testid="working-list-table">
                    <Table data-test="working-list-data-table">
                        <TableHeader>
                            {table.getHeaderGroups().map((group) => (
                                <TableRow key={group.id}>
                                    {group.headers.map((header) => {
                                        const { column } = header
                                        if (
                                            column.id === DATA_QUALITY_COLUMN_ID
                                        ) {
                                            return (
                                                <TableHead
                                                    key={header.id}
                                                    scope="col"
                                                    className="w-px min-w-0 text-center whitespace-nowrap"
                                                >
                                                    <table.FlexRender
                                                        header={header}
                                                    />
                                                </TableHead>
                                            )
                                        }
                                        const sorted = column.getIsSorted()
                                        return (
                                            <TableHead
                                                key={header.id}
                                                scope="col"
                                                className="py-1.5 whitespace-nowrap"
                                                aria-sort={
                                                    sorted
                                                        ? ariaSortByDirection[
                                                              sorted
                                                          ]
                                                        : 'none'
                                                }
                                            >
                                                <button
                                                    type="button"
                                                    className={
                                                        SORT_BUTTON_CLASS
                                                    }
                                                    data-testid={`sort-${column.id}`}
                                                    disabled={
                                                        !column.getCanSort() ||
                                                        configurationDisabled
                                                    }
                                                    onClick={column.getToggleSortingHandler()}
                                                >
                                                    <table.FlexRender
                                                        header={header}
                                                    />
                                                    <SortIndicator
                                                        sorted={sorted}
                                                    />
                                                </button>
                                            </TableHead>
                                        )
                                    })}
                                </TableRow>
                            ))}
                        </TableHeader>
                        <TableBody aria-busy={isInitialLoading || isUpdating}>
                            {isInitialLoading && (
                                <SkeletonRows
                                    columnCount={columnCount}
                                    rowCount={pageSize}
                                />
                            )}
                            {!isInitialLoading && tableRows.length === 0 && (
                                <TableRow>
                                    <TableCell
                                        colSpan={columnCount}
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
                            {tableRows.map((row) => {
                                const highlightIssues =
                                    showIssuesColumn &&
                                    row.original.issues.length > 0
                                const openRowFromCell = (
                                    event: React.MouseEvent<HTMLTableCellElement>
                                ) => {
                                    if (!isInteractiveTarget(event.target)) {
                                        onRowOpen?.(row.original)
                                    }
                                }
                                return (
                                    <TableRow
                                        key={row.id}
                                        className={
                                            interactive
                                                ? // The open button is hidden, so its row shows where focus is.
                                                  'cursor-pointer has-[button:focus-visible]:outline-2 has-[button:focus-visible]:-outline-offset-2 has-[button:focus-visible]:outline-dhis2-ring has-[button:focus-visible]:outline-solid'
                                                : undefined
                                        }
                                        data-test={`working-list-row-${row.id}`}
                                        data-testid={`working-list-row-${row.id}`}
                                        data-invalid={
                                            highlightIssues ? 'true' : undefined
                                        }
                                    >
                                        {row
                                            .getVisibleCells()
                                            .map((cell, index) => {
                                                const issuesCellId =
                                                    cell.column.id ===
                                                    DATA_QUALITY_COLUMN_ID
                                                        ? `working-list-issues-cell-${row.id}`
                                                        : undefined
                                                return (
                                                    <TableCell
                                                        key={cell.id}
                                                        className={cn(
                                                            issuesCellId
                                                                ? 'w-px min-w-0 text-center whitespace-nowrap'
                                                                : 'min-w-[140px]',
                                                            // A fixed background
                                                            // turns off the hover
                                                            // and press states, as
                                                            // in DataTable.
                                                            highlightIssues &&
                                                                'bg-dhis2-destructive-subtle group-hover/table-row:bg-dhis2-destructive-subtle group-active/table-row:bg-dhis2-destructive-subtle'
                                                        )}
                                                        data-test={issuesCellId}
                                                        data-testid={
                                                            issuesCellId
                                                        }
                                                        onClick={
                                                            interactive
                                                                ? openRowFromCell
                                                                : undefined
                                                        }
                                                    >
                                                        {index === 0 &&
                                                            interactive && (
                                                                <button
                                                                    type="button"
                                                                    className="sr-only"
                                                                    data-testid={`row-open-${row.id}`}
                                                                    onClick={() =>
                                                                        onRowOpen?.(
                                                                            row.original
                                                                        )
                                                                    }
                                                                >
                                                                    {i18n.t(
                                                                        'Open row {{number}}',
                                                                        {
                                                                            number:
                                                                                row.getDisplayIndex() +
                                                                                1,
                                                                        }
                                                                    )}
                                                                </button>
                                                            )}
                                                        <table.FlexRender
                                                            cell={cell}
                                                        />
                                                    </TableCell>
                                                )
                                            })}
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
