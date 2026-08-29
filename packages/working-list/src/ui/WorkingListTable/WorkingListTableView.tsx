import { Pagination } from '@dhis2/ui'
import React from 'react'
import {
    WORKING_LIST_PAGE_SIZES,
    type WorkingListDisplayRow,
    type WorkingListPageSize,
} from '../../provider/contracts'
import accessibilityStyles from '../styles/accessibility.module.css'
import { useWorkingListText } from '../WorkingListText'
import styles from './WorkingListTable.module.css'

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
            className={styles['working-list-results']}
            data-testid="working-list-results"
        >
            <div
                className={styles['working-list-table-scroll']}
                data-testid="working-list-table-scroll"
            >
                <table
                    className={styles['working-list-table']}
                    data-testid="working-list-table"
                >
                    <thead>
                        {model.headerGroups.map((group) => (
                            <tr key={group.id}>
                                {group.headers.map((header) => {
                                    if (header.isDataQuality) {
                                        return (
                                            <th
                                                key={header.id}
                                                scope="col"
                                                className={
                                                    styles[
                                                        'working-list-issues-cell'
                                                    ]
                                                }
                                            >
                                                {header.content}
                                            </th>
                                        )
                                    }
                                    return (
                                        <th
                                            key={header.id}
                                            scope="col"
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
                                                className={
                                                    styles['sort-button']
                                                }
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
                                                    className={
                                                        styles['sort-indicator']
                                                    }
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
                                    className={styles['empty-results']}
                                >
                                    <strong>
                                        {i18n.t('No items to display')}
                                    </strong>
                                    <span>
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
                                    className={`${styles['working-list-row']}${
                                        highlightIssues
                                            ? ` ${styles['working-list-row--invalid']}`
                                            : ''
                                    }`}
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
                                            className={
                                                cell.isDataQuality
                                                    ? styles[
                                                          'working-list-issues-cell'
                                                      ]
                                                    : undefined
                                            }
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
                                                        accessibilityStyles[
                                                            'visually-hidden'
                                                        ]
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
            <div className={styles['working-list-pagination']}>
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
