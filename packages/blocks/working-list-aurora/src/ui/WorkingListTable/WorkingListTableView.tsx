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

const pagerButtonClassName =
    'inline-flex h-8 cursor-pointer items-center gap-1 rounded-full border border-white/15 bg-white/5 px-4 text-xs font-medium tracking-wide text-cyan-100 backdrop-blur transition-colors hover:border-cyan-300/60 hover:bg-cyan-400/15 hover:text-white disabled:cursor-not-allowed disabled:opacity-35 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-300/70'

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
        Math.max(visibleColumnCount, 1) + (showIssuesColumn ? 1 : 0)

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
                    <table
                        className="w-full border-separate border-spacing-0 text-left text-sm text-slate-100"
                        data-test="working-list-data-table"
                    >
                        <thead>
                            {model.headerGroups.map((group) => (
                                <tr key={group.id}>
                                    {group.headers.map((header) => (
                                        <th
                                            key={header.id}
                                            scope="col"
                                            className="sticky top-0 z-1 whitespace-nowrap border-b border-white/10 bg-[#120b2e]/85 px-4 py-3 text-[11px] font-semibold uppercase tracking-[0.18em] text-cyan-200/80 backdrop-blur"
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
                                                    className="flex w-full cursor-pointer items-center justify-between gap-2 border-0 bg-transparent p-0 text-left text-[inherit] uppercase tracking-[inherit] [font-weight:inherit] transition-colors hover:text-cyan-100 disabled:cursor-default focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-300/70"
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
                                                                ? 'text-cyan-300'
                                                                : 'text-slate-500'
                                                        }
                                                    >
                                                        {header.sorted === 'asc'
                                                            ? '▲'
                                                            : header.sorted ===
                                                                'desc'
                                                              ? '▼'
                                                              : '◇'}
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
                                            className="p-0"
                                        >
                                            <div className="mx-4 my-2 h-8 animate-pulse rounded-lg bg-white/5 motion-reduce:animate-none" />
                                        </td>
                                    </tr>
                                ))}
                            {!isInitialLoading && model.rows.length === 0 && (
                                <tr>
                                    <td
                                        colSpan={columnCount}
                                        className="px-4 py-14 text-center"
                                    >
                                        <strong className="mb-1 block bg-gradient-to-r from-cyan-200 to-fuchsia-300 bg-clip-text text-base font-semibold text-transparent">
                                            {i18n.t('No items to display')}
                                        </strong>
                                        <span className="block text-slate-400">
                                            {i18n.t(
                                                'Try adjusting the filters or organisation unit.'
                                            )}
                                        </span>
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
                                        className={`group transition-colors ${highlightIssues ? 'bg-rose-500/10' : 'odd:bg-white/[0.02]'} ${interactive ? 'cursor-pointer hover:bg-cyan-400/10' : ''}`}
                                        data-test={`working-list-row-${row.id}`}
                                        data-testid={`working-list-row-${row.id}`}
                                        data-invalid={
                                            highlightIssues ? 'true' : undefined
                                        }
                                    >
                                        {row.cells.map((cell, index) => (
                                            <td
                                                key={cell.id}
                                                className={`border-b border-white/5 px-4 py-3 align-middle ${cell.isDataQuality ? 'w-px whitespace-nowrap text-center' : 'min-w-[140px]'} ${index === 0 ? 'font-medium text-white group-hover:text-cyan-100' : 'text-slate-300'}`}
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
                                            </td>
                                        ))}
                                    </tr>
                                )
                            })}
                        </tbody>
                    </table>
                </div>
            </div>
            <div className="flex min-h-14 w-full flex-wrap items-center justify-between gap-3 px-4 py-3 text-xs text-slate-400">
                <label className="inline-flex items-center gap-2">
                    <span className="uppercase tracking-[0.18em]">
                        {i18n.t('Rows')}
                    </span>
                    <select
                        className="h-8 cursor-pointer rounded-full border border-white/15 bg-white/5 px-3 text-xs text-cyan-100 backdrop-blur focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-300/70"
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
                        className={pagerButtonClassName}
                        disabled={page <= 1 || isInitialLoading}
                        onClick={() => onPageChange(page - 1)}
                    >
                        ← {i18n.t('Previous')}
                    </button>
                    <span className="rounded-full border border-fuchsia-300/30 bg-fuchsia-400/10 px-3 py-1 font-medium text-fuchsia-100">
                        {i18n.t('Page {{number}}', { number: page })}
                    </span>
                    <button
                        type="button"
                        className={pagerButtonClassName}
                        disabled={!hasNextPage || isInitialLoading}
                        onClick={() => onPageChange(page + 1)}
                    >
                        {i18n.t('Next')} →
                    </button>
                </div>
            </div>
        </div>
    )
}
