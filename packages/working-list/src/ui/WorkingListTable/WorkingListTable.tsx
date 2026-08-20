import { IconWarningFilled16, Pagination, Tooltip } from '@dhis2/ui'
import {
    columnOrderingFeature,
    columnVisibilityFeature,
    createColumnHelper,
    rowPaginationFeature,
    rowSortingFeature,
    tableFeatures,
    useTable,
    type ColumnVisibilityState,
    type PaginationState,
    type SortingState,
} from '@tanstack/react-table'
import React, { useMemo } from 'react'
import type {
    WorkingListField,
    WorkingListRowOpenEvent,
    WorkingListSort,
} from '../../domain/model'
import type { WorkingListCellValue } from '../../query/normalizeRows'
import {
    getCellDisplayValue,
    type CellDisplayValue,
    type CellFormattingContext,
} from '../../registry/valueTypes'
import { fieldDisplayName, localizedField } from '../FilterControls'
import accessibilityStyles from '../styles/accessibility.module.css'
import {
    rowOpenEvent,
    type WorkingListDataQualityMode,
    type WorkingListDisplayRow,
} from '../types'
import { useWorkingListText } from '../WorkingListText'
import styles from './WorkingListTable.module.css'

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

const isInteractiveTarget = (target: EventTarget | null) =>
    target instanceof Element &&
    Boolean(
        target.closest(
            'a, button, input, select, textarea, summary, [role="button"], [role="link"]'
        )
    )

/**
 * Best-effort rendering for a value that failed validation: the raw scalar
 * verbatim, an empty cell for a missing value, a dash when unrenderable.
 */
const invalidCellText = (raw: unknown) => {
    if (raw === undefined || raw === null || raw === '') {
        return ''
    }
    if (
        typeof raw === 'string' ||
        typeof raw === 'number' ||
        typeof raw === 'boolean'
    ) {
        return String(raw)
    }
    return '-'
}

const RowIssuesMarker = ({ row }: { row: WorkingListDisplayRow }) => {
    const t = useWorkingListText()
    return (
        <Tooltip
            content={
                <ul className={styles['working-list-row-issues']}>
                    {row.issues.map((issue) => (
                        <li key={`${issue.fieldId}-${issue.message}`}>
                            {`${issue.fieldName}: ${issue.message}`}
                        </li>
                    ))}
                </ul>
            }
        >
            <span
                className={styles['working-list-warning-icon']}
                role="img"
                data-testid={`row-issues-${row.id}`}
                aria-label={t('Row has {{count}} data quality issues', {
                    count: row.issues.length,
                })}
            >
                <IconWarningFilled16 />
            </span>
        </Tooltip>
    )
}

const CellValue = ({ display }: { display: CellDisplayValue }) => {
    const t = useWorkingListText()
    switch (display.kind) {
        case 'empty':
            return null
        case 'link':
            return (
                <a
                    href={display.href}
                    rel="noreferrer noopener"
                    target="_blank"
                >
                    {display.text}
                </a>
            )
        case 'file':
            return (
                <a
                    href={display.href}
                    rel="noreferrer noopener"
                    target="_blank"
                >
                    {display.text}
                </a>
            )
        case 'image':
            return (
                <a
                    href={display.href}
                    rel="noreferrer noopener"
                    target="_blank"
                >
                    <img
                        alt={display.alt || t('Image attachment')}
                        className={styles['working-list-cell-image']}
                        loading="lazy"
                        src={display.previewHref}
                    />
                </a>
            )
        case 'coordinate':
            return (
                <span
                    title={t('Latitude {{latitude}}, longitude {{longitude}}', {
                        latitude: display.latitude,
                        longitude: display.longitude,
                    })}
                >
                    {display.text}
                </span>
            )
        case 'reference':
        case 'text':
            return <>{display.text}</>
    }
}

interface WorkingListTableProps {
    allFields: WorkingListField[]
    visibleColumnIds: string[]
    rows?: WorkingListDisplayRow[]
    dataQualityMode?: WorkingListDataQualityMode
    sort: WorkingListSort
    page: number
    pageSize: number
    hasNextPage: boolean
    isInitialLoading: boolean
    isUpdating: boolean
    formattingContext: CellFormattingContext
    onColumnConfigurationChange: (columnIds: string[]) => void
    onPageChange: (page: number, pageSize: number) => void
    onRowOpen: (event: WorkingListRowOpenEvent) => void
    onSortChange: (sort: WorkingListSort) => void
}

export const WorkingListTable = ({
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
    formattingContext,
    onColumnConfigurationChange,
    onPageChange,
    onRowOpen,
    onSortChange,
}: WorkingListTableProps) => {
    const translate = useWorkingListText()
    const i18n = useMemo(() => ({ t: translate }), [translate])
    const showIssuesColumn = dataQualityMode === 'highlighted'
    const columns = useMemo(() => {
        const fieldColumns = allFields.map((field) =>
            columnHelper.accessor((row) => row.values[field.id], {
                id: field.id,
                header: fieldDisplayName(field, translate),
                enableSorting: true,
                cell: (context) => {
                    const cellValue = context.getValue() as
                        | WorkingListCellValue
                        | undefined
                    if (cellValue && !cellValue.valid) {
                        return <>{invalidCellText(cellValue.raw)}</>
                    }
                    return (
                        <CellValue
                            display={getCellDisplayValue(
                                cellValue?.value,
                                localizedField(field, translate),
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
                    <span className={accessibilityStyles['visually-hidden']}>
                        {translate('Data quality')}
                    </span>
                ),
                enableSorting: false,
                cell: (context) =>
                    context.row.original.issues.length > 0 ? (
                        <RowIssuesMarker row={context.row.original} />
                    ) : null,
            }),
        ])
    }, [allFields, formattingContext, showIssuesColumn, translate])

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
            enableSortingRemoval: false,
            state: {
                columnOrder,
                columnVisibility,
                pagination,
                sorting,
            },
            onColumnOrderChange: (updater) => {
                const next =
                    typeof updater === 'function'
                        ? updater(columnOrder)
                        : updater
                onColumnConfigurationChange(
                    next.filter(
                        (id) =>
                            id !== DATA_QUALITY_COLUMN_ID &&
                            columnVisibility[id] !== false
                    )
                )
            },
            onColumnVisibilityChange: (updater) => {
                const next =
                    typeof updater === 'function'
                        ? updater(columnVisibility)
                        : updater
                onColumnConfigurationChange(
                    allFields
                        .map((field) => field.id)
                        .filter((id) => next[id] !== false)
                )
            },
            onSortingChange: (updater) => {
                const next =
                    typeof updater === 'function' ? updater(sorting) : updater
                const first = next[0]
                if (first) {
                    onSortChange({
                        fieldId: first.id,
                        direction: first.desc ? 'desc' : 'asc',
                    })
                }
            },
        },
        (state) => ({
            columnOrder: state.columnOrder,
            columnVisibility: state.columnVisibility,
            pagination: state.pagination,
            sorting: state.sorting,
        })
    )

    const openRow = (row: WorkingListDisplayRow) => onRowOpen(rowOpenEvent(row))

    return (
        <section
            className={styles['working-list-results']}
            data-testid="working-list-results"
            aria-labelledby="results-heading"
        >
            <h2
                id="results-heading"
                className={accessibilityStyles['visually-hidden']}
            >
                {i18n.t('Working list results')}
            </h2>
            <div
                className={styles['working-list-table-scroll']}
                data-testid="working-list-table-scroll"
            >
                <table
                    className={styles['working-list-table']}
                    data-testid="working-list-table"
                >
                    <thead>
                        {table.getHeaderGroups().map((group) => (
                            <tr key={group.id}>
                                {group.headers.map((header) => {
                                    if (
                                        header.column.id ===
                                        DATA_QUALITY_COLUMN_ID
                                    ) {
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
                                                <table.FlexRender
                                                    header={header}
                                                />
                                            </th>
                                        )
                                    }
                                    const sorted = header.column.getIsSorted()
                                    return (
                                        <th
                                            key={header.id}
                                            scope="col"
                                            aria-sort={
                                                sorted === 'asc'
                                                    ? 'ascending'
                                                    : sorted === 'desc'
                                                      ? 'descending'
                                                      : 'none'
                                            }
                                        >
                                            <button
                                                type="button"
                                                className={
                                                    styles['sort-button']
                                                }
                                                data-testid={`sort-${header.column.id}`}
                                                disabled={
                                                    !header.column.getCanSort()
                                                }
                                                onClick={(event) =>
                                                    header.column.getToggleSortingHandler()?.(
                                                        event
                                                    )
                                                }
                                            >
                                                <table.FlexRender
                                                    header={header}
                                                />
                                                <span
                                                    aria-hidden="true"
                                                    className={
                                                        styles['sort-indicator']
                                                    }
                                                >
                                                    {sorted === 'asc'
                                                        ? '↑'
                                                        : sorted === 'desc'
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
                        {!isInitialLoading &&
                            table.getRowModel().rows.length === 0 && (
                                <tr>
                                    <td
                                        colSpan={
                                            Math.max(
                                                visibleColumnIds.length,
                                                1
                                            ) + (showIssuesColumn ? 1 : 0)
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
                        {table.getRowModel().rows.map((row) => {
                            const highlightIssues =
                                dataQualityMode === 'highlighted' &&
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
                                    {row
                                        .getVisibleCells()
                                        .map((cell, index) => (
                                            <td
                                                key={cell.id}
                                                className={
                                                    cell.column.id ===
                                                    DATA_QUALITY_COLUMN_ID
                                                        ? styles[
                                                              'working-list-issues-cell'
                                                          ]
                                                        : undefined
                                                }
                                                data-testid={
                                                    cell.column.id ===
                                                    DATA_QUALITY_COLUMN_ID
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
                                                            openRow(
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
                                                <table.FlexRender cell={cell} />
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
                    pageLength={rows.length}
                    pageSizes={['10', '15', '25', '50', '100']}
                    isLastPage={!hasNextPage}
                    hidePageSelect
                    hidePageSummary
                    disabled={isInitialLoading}
                    onPageChange={(nextPage) =>
                        onPageChange(nextPage, pageSize)
                    }
                    onPageSizeChange={(nextPageSize) =>
                        onPageChange(1, nextPageSize)
                    }
                />
            </div>
        </section>
    )
}
