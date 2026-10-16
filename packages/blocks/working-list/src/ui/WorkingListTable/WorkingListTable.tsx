import { IconWarningFilled16 } from '@dhis2/ui'
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
import { z } from 'zod'
import type { WorkingListField, WorkingListSort } from '../../domain/model'
import type {
    WorkingListDisplayRow,
    WorkingListPageSize,
} from '../../provider/contracts'
import type { WorkingListCellValue } from '../../query/normalizeRows'
import { DEFAULT_WORKING_LIST_SORT } from '../../query/serialize'
import {
    getCellDisplayValue,
    type CellDisplayValue,
    type CellFormattingContext,
} from '../../registry/valueTypes'
import { fieldDisplayName, localizedField } from '../FilterControls'
import type { WorkingListDataQualityMode } from '../types'
import { Tooltip, TooltipContent, TooltipTrigger } from '../primitives/tooltip'
import { useWorkingListText } from '../WorkingListText'
import {
    WorkingListTableView,
    type WorkingListTableViewModel,
} from './WorkingListTableView'

const visuallyHiddenClassName =
    'absolute! m-[-1px]! h-px! w-px! overflow-hidden! whitespace-nowrap! border-0! p-0! [clip:rect(0,0,0,0)]!'

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

/**
 * Best-effort rendering for a value that failed validation: the raw scalar
 * verbatim, an empty cell for a missing value, a dash when unrenderable.
 */
const InvalidCellScalarSchema = z.union([z.string(), z.number(), z.boolean()])

const invalidCellText = (
    cellValue: Extract<WorkingListCellValue, { valid: false }>
) => {
    const raw = cellValue.raw
    if (raw === undefined || raw === null || raw === '') {
        return ''
    }
    const scalar = InvalidCellScalarSchema.safeParse(raw)
    return scalar.success ? String(scalar.data) : '-'
}

const RowIssuesMarker = ({ row }: { row: WorkingListDisplayRow }) => {
    const t = useWorkingListText()
    return (
        <Tooltip>
            <TooltipTrigger
                render={
                    <span
                        className="inline-flex items-center text-[#b93d2e]"
                        role="img"
                        data-testid={`row-issues-${row.id}`}
                        aria-label={t('Row has {{count}} data quality issues', {
                            count: row.issues.length,
                        })}
                    />
                }
            >
                <IconWarningFilled16 />
            </TooltipTrigger>
            <TooltipContent>
                <ul className="m-0 pl-4">
                    {row.issues.map((issue) => (
                        <li key={`${issue.fieldId}-${issue.message}`}>
                            {`${issue.fieldName}: ${issue.message}`}
                        </li>
                    ))}
                </ul>
            </TooltipContent>
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
                    className="text-[#0053a0] underline-offset-2"
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
                    className="text-[#0053a0] underline-offset-2"
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
                    className="text-[#0053a0] underline-offset-2"
                    href={display.href}
                    rel="noreferrer noopener"
                    target="_blank"
                >
                    <img
                        alt={display.alt || t('Image attachment')}
                        className="block h-10 w-14 rounded-[3px] border border-[#d5dde5] bg-[#f3f5f7] object-cover"
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
    formattingContext: CellFormattingContext
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
    const translate = useWorkingListText()
    const showIssuesColumn = dataQualityMode === 'highlighted'
    const columns = useMemo(() => {
        const fieldColumns = allFields.map((field) =>
            columnHelper.accessor((row) => row.values[field.id], {
                id: field.id,
                header: fieldDisplayName(field, translate),
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
                    <span className={visuallyHiddenClassName}>
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

    const model: WorkingListTableViewModel = {
        headerGroups: table.getHeaderGroups().map((group) => ({
            id: group.id,
            headers: group.headers.map((header) => ({
                id: header.id,
                fieldId: header.column.id,
                content: <table.FlexRender header={header} />,
                canSort: header.column.getCanSort(),
                isDataQuality: header.column.id === DATA_QUALITY_COLUMN_ID,
                sorted: header.column.getIsSorted(),
                onToggleSorting: (event) =>
                    header.column.getToggleSortingHandler()?.(event),
            })),
        })),
        rows: table.getRowModel().rows.map((row) => ({
            id: row.id,
            displayIndex: row.getDisplayIndex(),
            original: row.original,
            cells: row.getVisibleCells().map((cell) => ({
                id: cell.id,
                fieldId: cell.column.id,
                content: <table.FlexRender cell={cell} />,
                isDataQuality: cell.column.id === DATA_QUALITY_COLUMN_ID,
            })),
        })),
    }

    return (
        <WorkingListTableView
            model={model}
            visibleColumnCount={visibleColumnIds.length}
            dataQualityMode={dataQualityMode}
            page={page}
            pageSize={pageSize}
            hasNextPage={hasNextPage}
            isInitialLoading={isInitialLoading}
            isUpdating={isUpdating}
            configurationDisabled={configurationDisabled}
            onPageChange={onPageChange}
            onPageSizeChange={onPageSizeChange}
            onRowOpen={onRowOpen}
        />
    )
}
