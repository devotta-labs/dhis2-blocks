import {
    DataTable,
    DataTableBody,
    DataTableCell,
    DataTableHead,
    DataTableRow,
    Pagination,
} from '@dhis2/ui'
import React from 'react'
import {
    WORKING_LIST_PAGE_SIZES,
    type WorkingListDisplayRow,
    type WorkingListPageSize,
} from '../../provider/contracts'
import { SkeletonBlock } from '../Skeleton'
import { useWorkingListText } from '../WorkingListText'

const visuallyHiddenClassName =
    'absolute! m-[-1px]! h-px! w-px! overflow-hidden! whitespace-nowrap! border-0! p-0! [clip:rect(0,0,0,0)]!'

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

const isWorkingListPageSize = (value: number): value is WorkingListPageSize =>
    WORKING_LIST_PAGE_SIZES.some((pageSize) => pageSize === value)

const skeletonCellWidths = [
    'w-[46%]',
    'w-[62%]',
    'w-[34%]',
    'w-[54%]',
    'w-[40%]',
]

const skeletonCellWidth = (row: number, column: number) =>
    skeletonCellWidths[(row * 3 + column) % skeletonCellWidths.length]

// One placeholder row per expected record, built from the same table cells
// as real rows so the body keeps its final height while results load.
const SkeletonRows = ({
    columnCount,
    rowCount,
}: {
    columnCount: number
    rowCount: number
}) =>
    Array.from({ length: rowCount }, (_, row) => (
        <DataTableRow key={row} dataTest="working-list-skeleton-row">
            {Array.from({ length: columnCount }, (_, column) => (
                <DataTableCell key={column} className="min-w-[140px]">
                    <SkeletonBlock
                        className={`h-3.5 rounded-[3px] ${skeletonCellWidth(row, column)}`}
                    />
                </DataTableCell>
            ))}
        </DataTableRow>
    ))

const PaginationFooter = ({
    page,
    pageSize,
    pageLength,
    hasNextPage,
    disabled,
    onPageChange,
    onPageSizeChange,
}: {
    page: number
    pageSize: WorkingListPageSize
    pageLength: number
    hasNextPage: boolean
    disabled: boolean
    onPageChange: (page: number) => void
    onPageSizeChange: (pageSize: WorkingListPageSize) => void
}) => (
    <div className="flex min-h-14 w-full min-w-0 max-w-full items-center justify-end px-3 py-2 [&_[data-test='dhis2-uicore-select-input']_>_:last-child]:[margin-block-start:0]">
        <Pagination
            dataTest="working-list-pagination"
            page={page}
            pageSize={pageSize}
            pageLength={pageLength}
            pageSizes={WORKING_LIST_PAGE_SIZES.map(String)}
            isLastPage={!hasNextPage}
            hidePageSelect
            hidePageSummary
            disabled={disabled}
            onPageChange={onPageChange}
            onPageSizeChange={(nextPageSize) => {
                if (!isWorkingListPageSize(nextPageSize)) {
                    throw new Error(
                        `Unsupported working-list page size: ${nextPageSize}`
                    )
                }

                onPageSizeChange(nextPageSize)
            }}
        />
    </div>
)

const ignorePaginationChange = () => {}

/**
 * Results placeholder for when the columns are not known yet (initializing,
 * or switching saved lists). It mirrors the loaded table — header, one row
 * per page slot, pagination — so real data replaces it without a jump.
 */
export const WorkingListTableSkeleton = ({
    pageSize,
    columnCount = 4,
}: {
    pageSize: WorkingListPageSize
    columnCount?: number
}) => (
    <div
        className="w-full min-w-0 max-w-full"
        data-testid="working-list-results-skeleton"
        aria-hidden="true"
    >
        <div className="w-full min-w-0 max-w-full overflow-x-hidden">
            <div className="min-w-[680px]">
                <DataTable>
                    <DataTableHead>
                        <DataTableRow>
                            {Array.from(
                                { length: columnCount },
                                (_, column) => (
                                    <DataTableCell key={column} tag="th">
                                        <SkeletonBlock
                                            className={`h-3 rounded-[3px] ${column % 2 === 0 ? 'w-24' : 'w-20'}`}
                                        />
                                    </DataTableCell>
                                )
                            )}
                        </DataTableRow>
                    </DataTableHead>
                    <DataTableBody>
                        <SkeletonRows
                            columnCount={columnCount}
                            rowCount={pageSize}
                        />
                    </DataTableBody>
                </DataTable>
            </div>
        </div>
        <PaginationFooter
            page={1}
            pageSize={pageSize}
            pageLength={0}
            hasNextPage={false}
            disabled
            onPageChange={ignorePaginationChange}
            onPageSizeChange={ignorePaginationChange}
        />
    </div>
)

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
                    <DataTable dataTest="working-list-data-table">
                        <DataTableHead>
                            {model.headerGroups.map((group) => (
                                <DataTableRow key={group.id}>
                                    {group.headers.map((header) => {
                                        if (header.isDataQuality) {
                                            return (
                                                <DataTableCell
                                                    key={header.id}
                                                    tag="th"
                                                    scope="col"
                                                    align="center"
                                                    className="w-px min-w-0 whitespace-nowrap"
                                                >
                                                    {header.content}
                                                </DataTableCell>
                                            )
                                        }
                                        return (
                                            <DataTableCell
                                                key={header.id}
                                                tag="th"
                                                scope="col"
                                                className="whitespace-nowrap"
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
                                                    className="flex w-full cursor-pointer items-center justify-between gap-2.5 border-0 bg-transparent text-left text-[inherit] [font-weight:inherit] disabled:cursor-default focus-visible:[outline:3px_solid_rgb(20_124_215_/_35%)] focus-visible:outline-offset-2"
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
                                                    <span
                                                        aria-hidden="true"
                                                        className="text-[var(--colors-grey600)]"
                                                    >
                                                        {header.sorted === 'asc'
                                                            ? '↑'
                                                            : header.sorted ===
                                                                'desc'
                                                              ? '↓'
                                                              : '↕'}
                                                    </span>
                                                </button>
                                            </DataTableCell>
                                        )
                                    })}
                                </DataTableRow>
                            ))}
                        </DataTableHead>
                        <DataTableBody
                            aria-busy={isInitialLoading || isUpdating}
                        >
                            {isInitialLoading && (
                                <SkeletonRows
                                    columnCount={
                                        Math.max(visibleColumnCount, 1) +
                                        (showIssuesColumn ? 1 : 0)
                                    }
                                    rowCount={pageSize}
                                />
                            )}
                            {!isInitialLoading && model.rows.length === 0 && (
                                <DataTableRow>
                                    <DataTableCell
                                        colSpan={String(
                                            Math.max(visibleColumnCount, 1) +
                                                (showIssuesColumn ? 1 : 0)
                                        )}
                                        align="center"
                                        className="min-w-[140px] py-10!"
                                    >
                                        <strong className="mb-1 block font-medium">
                                            {i18n.t('No items to display')}
                                        </strong>
                                        <span className="block">
                                            {i18n.t(
                                                'Try adjusting the filters or organisation unit.'
                                            )}
                                        </span>
                                    </DataTableCell>
                                </DataTableRow>
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
                                    <DataTableRow
                                        key={row.id}
                                        className={
                                            interactive
                                                ? 'cursor-pointer'
                                                : undefined
                                        }
                                        dataTest={`working-list-row-${row.id}`}
                                        data-testid={`working-list-row-${row.id}`}
                                        data-invalid={
                                            highlightIssues ? 'true' : undefined
                                        }
                                    >
                                        {row.cells.map((cell, index) => (
                                            <DataTableCell
                                                key={cell.id}
                                                align={
                                                    cell.isDataQuality
                                                        ? 'center'
                                                        : 'left'
                                                }
                                                backgroundColor={
                                                    highlightIssues
                                                        ? 'var(--colors-red050)'
                                                        : undefined
                                                }
                                                className={
                                                    cell.isDataQuality
                                                        ? 'w-px min-w-0 whitespace-nowrap'
                                                        : 'min-w-[140px]'
                                                }
                                                dataTest={
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
                                                        className={
                                                            visuallyHiddenClassName
                                                        }
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
                                            </DataTableCell>
                                        ))}
                                    </DataTableRow>
                                )
                            })}
                        </DataTableBody>
                    </DataTable>
                </div>
            </div>
            <PaginationFooter
                page={page}
                pageSize={pageSize}
                pageLength={model.rows.length}
                hasNextPage={hasNextPage}
                disabled={isInitialLoading}
                onPageChange={onPageChange}
                onPageSizeChange={onPageSizeChange}
            />
        </div>
    )
}
