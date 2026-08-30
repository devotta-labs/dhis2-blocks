import React from 'react'
import {
    WORKING_LIST_PAGE_SIZES,
    type WorkingListDisplayRow,
    type WorkingListPageSize,
} from '../../provider/contracts'
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

const minimumLoadingRowCount = WORKING_LIST_PAGE_SIZES[0]

const commandButtonClassName =
    'cursor-pointer border border-emerald-500/40 bg-transparent px-3 py-1 font-mono text-xs tracking-widest text-emerald-300 transition-colors hover:bg-emerald-400 hover:text-black disabled:cursor-not-allowed disabled:border-emerald-900 disabled:text-emerald-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-400'

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
    const columnCount =
        Math.max(visibleColumnCount, 1) + (showIssuesColumn ? 1 : 0) + 1

    return (
        <div
            className="w-full min-w-0 max-w-full font-mono"
            data-testid="working-list-results"
        >
            <div
                className="w-full min-w-0 max-w-full overflow-x-auto [contain:layout] [overscroll-behavior-inline:contain]"
                data-testid="working-list-table-scroll"
            >
                <div className="min-w-[680px]" data-testid="working-list-table">
                    <table
                        className="w-full border-collapse text-left font-mono text-[13px] text-emerald-200"
                        data-test="working-list-data-table"
                    >
                        <thead>
                            {model.headerGroups.map((group) => (
                                <tr key={group.id}>
                                    <th
                                        scope="col"
                                        aria-hidden="true"
                                        className="w-10 border-y border-dashed border-emerald-500/30 bg-black/60 px-2 py-2 text-emerald-600"
                                    >
                                        #
                                    </th>
                                    {group.headers.map((header) => (
                                        <th
                                            key={header.id}
                                            scope="col"
                                            className="whitespace-nowrap border-y border-dashed border-emerald-500/30 bg-black/60 px-3 py-2 text-[11px] font-normal uppercase tracking-[0.2em] text-emerald-400"
                                            aria-sort={
                                                header.sorted === 'asc'
                                                    ? 'ascending'
                                                    : header.sorted === 'desc'
                                                      ? 'descending'
                                                      : 'none'
                                            }
                                        >
                                            {header.isDataQuality ? (
                                                header.content
                                            ) : (
                                                <button
                                                    type="button"
                                                    className="flex w-full cursor-pointer items-center gap-2 border-0 bg-transparent p-0 text-left font-mono text-[inherit] uppercase tracking-[inherit] transition-colors hover:text-emerald-200 disabled:cursor-default focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-400"
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
                                                        className={
                                                            header.sorted
                                                                ? 'text-emerald-300'
                                                                : 'text-emerald-800'
                                                        }
                                                    >
                                                        {header.sorted === 'asc'
                                                            ? '[asc]'
                                                            : header.sorted ===
                                                                'desc'
                                                              ? '[desc]'
                                                              : '[--]'}
                                                    </span>
                                                </button>
                                            )}
                                        </th>
                                    ))}
                                </tr>
                            ))}
                        </thead>
                        <tbody aria-busy={isInitialLoading || isUpdating}>
                            {isInitialLoading &&
                                Array.from({
                                    length: minimumLoadingRowCount,
                                }).map((_, index) => (
                                    <tr
                                        key={index}
                                        aria-hidden="true"
                                        data-testid="working-list-loading-row"
                                    >
                                        <td
                                            colSpan={columnCount}
                                            className="px-3 py-1.5 text-emerald-700"
                                        >
                                            {'>'} loading records
                                            {'.'.repeat((index % 3) + 1)}
                                        </td>
                                    </tr>
                                ))}
                            {!isInitialLoading && model.rows.length === 0 && (
                                <tr>
                                    <td
                                        colSpan={columnCount}
                                        className="px-3 py-12 text-emerald-400"
                                    >
                                        <div>
                                            {'>'}{' '}
                                            {i18n.t('No items to display')}
                                        </div>
                                        <div className="text-emerald-700">
                                            {'>'}{' '}
                                            {i18n.t(
                                                'Try adjusting the filters or organisation unit.'
                                            )}
                                        </div>
                                        <div className="mt-2 text-emerald-500">
                                            {'>'}{' '}
                                            <span className="inline-block h-4 w-2 animate-pulse bg-emerald-400 align-middle motion-reduce:animate-none" />
                                        </div>
                                    </td>
                                </tr>
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
                                    <tr
                                        key={row.id}
                                        className={`group ${highlightIssues ? 'bg-amber-500/10 text-amber-200' : ''} ${interactive ? 'cursor-pointer hover:bg-emerald-400 hover:text-black' : ''}`}
                                        data-test={`working-list-row-${row.id}`}
                                        data-testid={`working-list-row-${row.id}`}
                                        data-invalid={
                                            highlightIssues ? 'true' : undefined
                                        }
                                    >
                                        <td
                                            aria-hidden="true"
                                            className="w-10 px-2 py-1.5 text-right text-emerald-700 group-hover:text-black/60"
                                        >
                                            {String(
                                                row.displayIndex + 1
                                            ).padStart(2, '0')}
                                        </td>
                                        {row.cells.map((cell, index) => (
                                            <td
                                                key={cell.id}
                                                className={`px-3 py-1.5 align-middle whitespace-nowrap ${cell.isDataQuality ? 'w-px text-center' : 'min-w-[140px]'} ${index === 0 ? 'text-emerald-100 group-hover:text-black' : ''}`}
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
                                                {index === 0 && (
                                                    <>
                                                        {interactive && (
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
                                                        <span
                                                            aria-hidden="true"
                                                            className="mr-2 text-emerald-500 group-hover:text-black/70"
                                                        >
                                                            {'>'}
                                                        </span>
                                                    </>
                                                )}
                                                {cell.content}
                                            </td>
                                        ))}
                                    </tr>
                                )
                            })}
                        </tbody>
                    </table>
                </div>
            </div>
            <div className="flex min-h-14 w-full flex-wrap items-center justify-between gap-3 border-t border-dashed border-emerald-500/30 px-3 py-3 text-xs text-emerald-500">
                <label className="inline-flex items-center gap-2">
                    <span className="tracking-widest">
                        --rows={i18n.t('Rows').toLowerCase()}
                    </span>
                    <select
                        className="cursor-pointer border border-emerald-500/40 bg-black px-2 py-1 font-mono text-xs text-emerald-300 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-400"
                        data-testid="working-list-page-size"
                        value={pageSize}
                        onChange={(event) => {
                            // SAFETY: every option is rendered from WORKING_LIST_PAGE_SIZES, so the selected value is always a valid page size.
                            onPageSizeChange(
                                Number(
                                    event.currentTarget.value
                                ) as WorkingListPageSize
                            )
                        }}
                    >
                        {WORKING_LIST_PAGE_SIZES.map((size) => (
                            <option key={size} value={size}>
                                {size}
                            </option>
                        ))}
                    </select>
                </label>
                <div
                    className="flex items-center gap-2"
                    data-testid="working-list-pagination"
                >
                    <button
                        type="button"
                        className={commandButtonClassName}
                        disabled={page <= 1 || isInitialLoading}
                        onClick={() => onPageChange(page - 1)}
                    >
                        [ {i18n.t('Previous')} ]
                    </button>
                    <span className="px-1 tracking-widest text-emerald-300">
                        {i18n.t('Page {{number}}', { number: page })}
                    </span>
                    <button
                        type="button"
                        className={commandButtonClassName}
                        disabled={!hasNextPage || isInitialLoading}
                        onClick={() => onPageChange(page + 1)}
                    >
                        [ {i18n.t('Next')} ]
                    </button>
                </div>
            </div>
        </div>
    )
}
