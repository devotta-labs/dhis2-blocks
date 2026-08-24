import { Pagination } from '@dhis2/ui'
import React from 'react'
import {
    WORKING_LIST_PAGE_SIZES,
    type WorkingListDisplayRow,
    type WorkingListPageSize,
} from '../../provider/contracts'
import { useWorkingListText } from '../WorkingListText'

const visuallyHiddenClassName =
    'absolute! m-[-1px]! h-px! w-px! overflow-hidden! whitespace-nowrap! border-0! p-0! [clip:rect(0,0,0,0)]!'

const tableHeaderClassName =
    'h-10 whitespace-nowrap border-b border-[#d5dde5] bg-[#f3f5f7] p-0 text-left text-[12px] font-medium text-[#405261]'

const tableCellClassName =
    'h-11 border-b border-[#e8edf2] px-3 py-2.5 align-middle text-[#25394a]'

export interface WorkingListTableHeaderView {
    id: string
    fieldId: string
    content: React.ReactNode
    canSort: boolean
    isDataQuality: boolean
    sorted: false | 'asc' | 'desc'
    onToggleSorting: (event: React.MouseEvent<HTMLButtonElement>) => void
}

export interface WorkingListTableHeaderGroupView {
    id: string
    headers: WorkingListTableHeaderView[]
}

export interface WorkingListTableCellView {
    id: string
    fieldId: string
    content: React.ReactNode
    isDataQuality: boolean
}

export interface WorkingListTableRowView {
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
    onRowOpen: (row: WorkingListDisplayRow) => void
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
    const openRow = (row: WorkingListDisplayRow) => onRowOpen(row)

    return (
        <div
            className="w-full min-w-0 max-w-full"
            data-testid="working-list-results"
        >
            <div
                className="w-full min-w-0 max-w-full overflow-x-auto [contain:layout] [overscroll-behavior-inline:contain]"
                data-testid="working-list-table-scroll"
            >
                <table
                    className="w-full min-w-[680px] border-separate border-spacing-0 text-[14px]"
                    data-testid="working-list-table"
                >
                    <thead>
                        {model.headerGroups.map((group) => (
                            <tr key={group.id}>
                                {group.headers.map((header, index) => {
                                    if (header.isDataQuality) {
                                        return (
                                            <th
                                                key={header.id}
                                                scope="col"
                                                className={`${tableHeaderClassName} w-px min-w-0 text-center ${index > 0 ? 'border-l border-[#f0f2f4]' : ''}`}
                                            >
                                                {header.content}
                                            </th>
                                        )
                                    }
                                    return (
                                        <th
                                            key={header.id}
                                            scope="col"
                                            className={`${tableHeaderClassName} ${index > 0 ? 'border-l border-[#f0f2f4]' : ''}`}
                                            aria-sort={
                                                header.sorted === 'asc'
                                                    ? 'ascending'
                                                    : header.sorted === 'desc'
                                                      ? 'descending'
                                                      : 'none'
                                            }
                                        >
                                            <button
                                                type="button"
                                                className="flex min-h-10 w-full cursor-pointer items-center justify-between gap-2.5 border-0 bg-transparent px-3 py-[7px] text-left text-[inherit] [font-weight:inherit] [&:hover]:bg-[#eaf3fa] [&:hover]:text-[#0053a0] focus-visible:[outline:3px_solid_rgb(20_124_215_/_35%)] focus-visible:outline-offset-2"
                                                data-testid={`sort-${header.fieldId}`}
                                                disabled={
                                                    !header.canSort ||
                                                    configurationDisabled
                                                }
                                                onClick={header.onToggleSorting}
                                            >
                                                {header.content}
                                                <span
                                                    aria-hidden="true"
                                                    className="text-[13px] text-[#6c7785]"
                                                >
                                                    {header.sorted === 'asc'
                                                        ? '↑'
                                                        : header.sorted ===
                                                            'desc'
                                                          ? '↓'
                                                          : '↕'}
                                                </span>
                                            </button>
                                        </th>
                                    )
                                })}
                            </tr>
                        ))}
                    </thead>
                    <tbody aria-busy={isInitialLoading || isUpdating}>
                        {!isInitialLoading && model.rows.length === 0 && (
                            <tr>
                                <td
                                    colSpan={
                                        Math.max(visibleColumnCount, 1) +
                                        (showIssuesColumn ? 1 : 0)
                                    }
                                    className={`${tableCellClassName} min-w-[140px] bg-white px-4! py-10! text-center text-[#5f6b7a]!`}
                                >
                                    <strong className="mb-1 block font-medium text-[#36454f]">
                                        {i18n.t('No items to display')}
                                    </strong>
                                    <span className="block">
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
                            return (
                                <tr
                                    key={row.id}
                                    className={
                                        highlightIssues
                                            ? 'cursor-pointer [&_td]:bg-[#fff0f0] [&:hover_td]:bg-[#ffe6e6] [&:focus-within_td]:bg-[#ffdcdc]'
                                            : 'cursor-pointer [&_td]:bg-white [&:hover_td]:bg-[#f7fbff] [&:focus-within_td]:bg-[#eaf3fa]'
                                    }
                                    data-testid={`working-list-row-${row.id}`}
                                    data-invalid={
                                        highlightIssues ? 'true' : undefined
                                    }
                                    onClick={(event) => {
                                        if (
                                            !isInteractiveTarget(event.target)
                                        ) {
                                            openRow(row.original)
                                        }
                                    }}
                                >
                                    {row.cells.map((cell, index) => (
                                        <td
                                            key={cell.id}
                                            className={`${tableCellClassName} ${index > 0 ? 'border-l border-[#f0f2f4]' : ''} ${cell.isDataQuality ? 'w-px min-w-0 whitespace-nowrap text-center' : 'min-w-[140px]'}`}
                                            data-testid={
                                                cell.isDataQuality
                                                    ? `working-list-issues-cell-${row.id}`
                                                    : undefined
                                            }
                                        >
                                            {index === 0 && (
                                                <button
                                                    type="button"
                                                    className={
                                                        visuallyHiddenClassName
                                                    }
                                                    data-testid={`row-open-${row.id}`}
                                                    onClick={() =>
                                                        openRow(row.original)
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
            <div className="flex min-h-14 w-full min-w-0 max-w-full items-center justify-end px-3 py-2 [&_[data-test='dhis2-uicore-select-input']_>_:last-child]:[margin-block-start:0]">
                <Pagination
                    dataTest="working-list-pagination"
                    page={page}
                    pageSize={pageSize}
                    pageLength={model.rows.length}
                    pageSizes={WORKING_LIST_PAGE_SIZES.map(String)}
                    isLastPage={!hasNextPage}
                    hidePageSelect
                    hidePageSummary
                    disabled={isInitialLoading}
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
        </div>
    )
}
