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

const pagerLinkClassName =
    'cursor-pointer border-0 bg-transparent p-0 font-serif text-sm italic text-[#8a3324] underline decoration-[#d9c9a3] decoration-2 underline-offset-4 transition-colors hover:text-[#5d1f14] hover:decoration-[#8a3324] disabled:cursor-not-allowed disabled:text-[#b9ada0] disabled:no-underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#8a3324]'

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
                        className="w-full border-collapse text-left text-[15px] text-[#2f2a24]"
                        data-test="working-list-data-table"
                    >
                        <thead>
                            {model.headerGroups.map((group) => (
                                <tr key={group.id}>
                                    {group.headers.map((header, index) => (
                                        <th
                                            key={header.id}
                                            scope="col"
                                            className={`whitespace-nowrap border-b-2 border-[#2f2a24] px-6 pt-2 pb-3 font-serif text-[11px] font-semibold uppercase tracking-[0.28em] text-[#6b5f52] ${index === 0 ? 'pl-8' : ''}`}
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
                                                    className="flex w-full cursor-pointer items-center gap-2 border-0 bg-transparent p-0 text-left font-serif text-[inherit] uppercase tracking-[inherit] [font-weight:inherit] transition-colors hover:text-[#8a3324] disabled:cursor-default focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#8a3324]"
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
                                                                ? 'text-[#8a3324]'
                                                                : 'text-[#c8bdaf]'
                                                        }
                                                    >
                                                        {header.sorted === 'asc'
                                                            ? '↑'
                                                            : header.sorted ===
                                                                'desc'
                                                              ? '↓'
                                                              : '·'}
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
                                            <div className="mx-8 my-4 h-4 animate-pulse rounded-sm bg-[#e6ddcb] motion-reduce:animate-none" />
                                        </td>
                                    </tr>
                                ))}
                            {!isInitialLoading && model.rows.length === 0 && (
                                <tr>
                                    <td
                                        colSpan={columnCount}
                                        className="px-8 py-16 text-center"
                                    >
                                        <strong className="mb-2 block font-serif text-2xl font-normal italic text-[#2f2a24]">
                                            {i18n.t('No items to display')}
                                        </strong>
                                        <span className="block font-serif text-[#6b5f52]">
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
                                        className={`group ${highlightIssues ? 'bg-[#f6e7dd]' : ''} ${interactive ? 'cursor-pointer hover:bg-[#f1ead9]' : ''}`}
                                        data-test={`working-list-row-${row.id}`}
                                        data-testid={`working-list-row-${row.id}`}
                                        data-invalid={
                                            highlightIssues ? 'true' : undefined
                                        }
                                    >
                                        {row.cells.map((cell, index) => (
                                            <td
                                                key={cell.id}
                                                className={`border-b border-[#e0d6c2] px-6 py-5 align-top ${cell.isDataQuality ? 'w-px whitespace-nowrap text-center' : 'min-w-[150px]'} ${
                                                    index === 0
                                                        ? "relative pl-8 font-serif text-[19px] leading-snug text-[#1c1814] before:absolute before:top-5 before:left-0 before:h-6 before:w-[3px] before:bg-[#8a3324] before:opacity-0 before:transition-opacity before:content-[''] group-hover:before:opacity-100"
                                                        : 'font-sans text-[13px] tracking-wide text-[#5c5347]'
                                                }`}
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
            <div className="flex min-h-16 w-full flex-wrap items-center justify-between gap-4 border-t-2 border-[#2f2a24] px-8 py-4 font-serif text-sm text-[#6b5f52]">
                <label className="inline-flex items-center gap-2">
                    <span className="text-[11px] uppercase tracking-[0.28em]">
                        {i18n.t('Rows')}
                    </span>
                    <select
                        className="cursor-pointer border-0 border-b border-[#8a3324] bg-transparent px-1 py-0.5 font-serif text-sm text-[#2f2a24] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#8a3324]"
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
                    className="flex items-center gap-5"
                    data-testid="working-list-pagination"
                >
                    <button
                        type="button"
                        className={pagerLinkClassName}
                        disabled={page <= 1 || isInitialLoading}
                        onClick={() => onPageChange(page - 1)}
                    >
                        ← {i18n.t('Previous')}
                    </button>
                    <span className="font-serif text-base italic text-[#2f2a24]">
                        {i18n.t('Page {{number}}', { number: page })}
                    </span>
                    <button
                        type="button"
                        className={pagerLinkClassName}
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
