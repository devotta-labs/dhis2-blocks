import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import type { WorkingListField } from '../../domain/model'
import type { WorkingListDisplayRow } from '../types'
import { WorkingListTable } from '../WorkingListTable'
import { WorkingListTextProvider } from '../WorkingListText'

jest.mock('@dhis2/ui', () => ({
    Pagination: () => null,
    Tooltip: ({ children }: { children: React.ReactNode }) => <>{children}</>,
    IconWarningFilled16: () => null,
}))

jest.mock('@tanstack/react-table', () => {
    const React = jest.requireActual<typeof import('react')>('react')
    const feature = {}
    type MockColumn = {
        id: string
        accessor?: (row: unknown) => unknown
        enableSorting?: boolean
        cell: (context: {
            getValue: () => unknown
            row: { original: unknown }
        }) => React.ReactNode
        header: React.ReactNode | (() => React.ReactNode)
    }
    const orderedColumns = (options: {
        columns: MockColumn[]
        state: {
            columnOrder: string[]
            columnVisibility: Record<string, boolean>
            sorting: Array<{ id: string; desc: boolean }>
        }
    }) =>
        options.state.columnOrder.flatMap((id) => {
            const column = options.columns.find((item) => item.id === id)
            return column && options.state.columnVisibility[id] !== false
                ? [column]
                : []
        })

    return {
        columnOrderingFeature: feature,
        columnVisibilityFeature: feature,
        rowPaginationFeature: feature,
        rowSortingFeature: feature,
        tableFeatures: (features: unknown) => features,
        createColumnHelper: () => ({
            columns: (columns: unknown) => columns,
            accessor: (
                accessor: (row: unknown) => unknown,
                definition: Record<string, unknown>
            ) => ({ ...definition, accessor }),
            display: (definition: Record<string, unknown>) => definition,
        }),
        useTable: (options: {
            columns: MockColumn[]
            data: Array<{ id: string }>
            state: {
                columnOrder: string[]
                columnVisibility: Record<string, boolean>
                sorting: Array<{ id: string; desc: boolean }>
            }
        }) => {
            const columns = orderedColumns(options)
            const columnApi = (column: (typeof columns)[number]) => ({
                id: column.id,
                columnDef: column,
                getCanSort: () => column.enableSorting !== false,
                getIsSorted: () => {
                    const sort = options.state.sorting[0]
                    return sort?.id === column.id
                        ? sort.desc
                            ? 'desc'
                            : 'asc'
                        : false
                },
                getToggleSortingHandler: () => () => undefined,
            })
            return {
                FlexRender: ({
                    header,
                    cell,
                }: {
                    header?: { column: ReturnType<typeof columnApi> }
                    cell?: {
                        column: ReturnType<typeof columnApi>
                        value: unknown
                        row: { original: unknown }
                    }
                }) =>
                    header
                        ? React.createElement(
                              React.Fragment,
                              null,
                              typeof header.column.columnDef.header ===
                                  'function'
                                  ? header.column.columnDef.header()
                                  : header.column.columnDef.header
                          )
                        : cell
                          ? cell.column.columnDef.cell({
                                getValue: () => cell.value,
                                row: cell.row,
                            })
                          : null,
                getHeaderGroups: () => [
                    {
                        id: 'header',
                        headers: columns.map((column) => ({
                            id: column.id,
                            column: columnApi(column),
                        })),
                    },
                ],
                getRowModel: () => ({
                    rows: options.data.map((original, rowIndex) => ({
                        id: original.id,
                        original,
                        getDisplayIndex: () => rowIndex,
                        getVisibleCells: () =>
                            columns.map((column) => ({
                                id: `${original.id}-${column.id}`,
                                column: columnApi(column),
                                value: column.accessor?.(original),
                                row: { original },
                            })),
                    })),
                }),
            }
        },
    }
})

const fields: WorkingListField[] = [
    {
        id: 'website',
        displayName: 'Website',
        source: 'trackedEntityAttribute',
        scope: 'trackedEntity',
        valueType: 'URL',
        filterable: true,
    },
    {
        id: 'firstName',
        displayName: 'First name',
        source: 'trackedEntityAttribute',
        scope: 'trackedEntity',
        valueType: 'TEXT',
        filterable: true,
    },
    {
        id: 'lastName',
        displayName: 'Last name',
        source: 'trackedEntityAttribute',
        scope: 'trackedEntity',
        valueType: 'TEXT',
        filterable: true,
    },
]

const translate = (
    message: string,
    values?: Record<string, string | number | boolean | undefined>
) =>
    Object.entries(values ?? {}).reduce(
        (result, [key, value]) => result.replace(`{{${key}}}`, String(value)),
        message
    )

const renderTable = (
    container: HTMLElement,
    props: Partial<React.ComponentProps<typeof WorkingListTable>>
) => {
    const root = createRoot(container)
    act(() => {
        root.render(
            <WorkingListTextProvider translate={translate}>
                <WorkingListTable
                    allFields={fields}
                    visibleColumnIds={fields.map((field) => field.id)}
                    sort={{ fieldId: 'lastName', direction: 'desc' }}
                    page={1}
                    pageSize={15}
                    hasNextPage={false}
                    isInitialLoading={false}
                    isUpdating={false}
                    formattingContext={{ locale: 'en' }}
                    onColumnConfigurationChange={() => undefined}
                    onPageChange={() => undefined}
                    onRowOpen={() => undefined}
                    onSortChange={() => undefined}
                    {...props}
                />
            </WorkingListTextProvider>
        )
    })
    return root
}

const withActEnvironment = (run: () => void) => {
    const actEnvironment = globalThis as typeof globalThis & {
        IS_REACT_ACT_ENVIRONMENT?: boolean
    }
    const originalActEnvironment = actEnvironment.IS_REACT_ACT_ENVIRONMENT
    actEnvironment.IS_REACT_ACT_ENVIRONMENT = true
    try {
        run()
    } finally {
        actEnvironment.IS_REACT_ACT_ENVIRONMENT = originalActEnvironment
    }
}

describe('WorkingListTable', () => {
    it('opens a row by pointer or its accessible in-cell control without hijacking links', () => {
        withActEnvironment(() => {
            const container = document.createElement('div')
            document.body.appendChild(container)
            const onRowOpen = jest.fn()
            const root = renderTable(container, {
                rows: [
                    {
                        id: 'tei-1',
                        trackedEntityId: 'tei-1',
                        values: {
                            website: {
                                valid: true,
                                value: 'https://example.com/person',
                            },
                            firstName: { valid: true, value: 'Maria' },
                            lastName: { valid: true, value: 'Wright' },
                        },
                        issues: [],
                    },
                ],
                onRowOpen,
            })

            try {
                const table = container.querySelector(
                    '[data-testid="working-list-table"]'
                )
                const row = container.querySelector<HTMLTableRowElement>(
                    '[data-testid="working-list-row-tei-1"]'
                )
                const website = row?.querySelector<HTMLAnchorElement>('a')
                const firstNameCell = row?.querySelectorAll('td')[1]
                const openRowButton = row?.querySelector<HTMLButtonElement>(
                    '[data-testid="row-open-tei-1"]'
                )

                expect(table).not.toBeNull()
                expect(
                    container.querySelector('[data-testid="sort-lastName"]')
                ).not.toBeNull()
                expect(
                    container.querySelectorAll('[aria-sort="descending"]')
                ).toHaveLength(1)
                expect(row?.hasAttribute('tabindex')).toBe(false)
                expect(row?.hasAttribute('aria-label')).toBe(false)
                expect(
                    container.querySelector('[class*="row-action"]')
                ).toBeNull()
                expect(openRowButton?.type).toBe('button')
                expect(openRowButton?.textContent).toBe('Open row 1')
                expect(openRowButton?.closest('td')).toBe(
                    row?.querySelectorAll('td')[0]
                )
                expect(openRowButton?.getAttribute('aria-label')).toBeNull()

                act(() =>
                    firstNameCell?.dispatchEvent(
                        new MouseEvent('click', {
                            bubbles: true,
                        })
                    )
                )
                expect(onRowOpen).toHaveBeenLastCalledWith({
                    mode: 'trackedEntity',
                    trackedEntityId: 'tei-1',
                })

                act(() => openRowButton?.click())
                expect(onRowOpen).toHaveBeenCalledTimes(2)

                website?.addEventListener('click', (event) =>
                    event.preventDefault()
                )
                act(() => website?.click())
                act(() => {
                    website?.dispatchEvent(
                        new KeyboardEvent('keydown', {
                            key: 'Enter',
                            bubbles: true,
                        })
                    )
                })
                expect(onRowOpen).toHaveBeenCalledTimes(2)
            } finally {
                act(() => root.unmount())
                container.remove()
            }
        })
    })

    const rowWithIssues: WorkingListDisplayRow = {
        id: 'tei-2',
        trackedEntityId: 'tei-2',
        values: {
            website: { valid: true, value: 'https://example.com' },
            firstName: {
                valid: false,
                raw: '###',
                message: 'Bad value',
            },
            lastName: {
                valid: false,
                raw: undefined,
                message: 'A required value is missing',
            },
        },
        issues: [
            {
                fieldId: 'firstName',
                fieldName: 'First name',
                message: 'Bad value',
                raw: '###',
            },
            {
                fieldId: 'lastName',
                fieldName: 'Last name',
                message: 'A required value is missing',
            },
        ],
    }

    it('renders invalid values best-effort without visuals in hidden mode', () => {
        withActEnvironment(() => {
            const container = document.createElement('div')
            document.body.appendChild(container)
            const root = renderTable(container, {
                rows: [rowWithIssues],
                dataQualityMode: 'hidden',
            })

            try {
                const row = container.querySelector<HTMLTableRowElement>(
                    '[data-testid="working-list-row-tei-2"]'
                )
                expect(row).not.toBeNull()
                expect(row?.hasAttribute('data-invalid')).toBe(false)
                expect(
                    container.querySelector('[data-testid="row-issues-tei-2"]')
                ).toBeNull()
                expect(
                    container.querySelector(
                        '[data-testid^="working-list-issues-cell-"]'
                    )
                ).toBeNull()
                const cells = row?.querySelectorAll('td')
                expect(cells?.[1].textContent).toBe('###')
                expect(cells?.[2].textContent).toBe('')
            } finally {
                act(() => root.unmount())
                container.remove()
            }
        })
    })

    it('tints the row and shows a trailing issues marker in highlighted mode', () => {
        withActEnvironment(() => {
            const container = document.createElement('div')
            document.body.appendChild(container)
            const root = renderTable(container, {
                rows: [rowWithIssues],
                dataQualityMode: 'highlighted',
            })

            try {
                const row = container.querySelector<HTMLTableRowElement>(
                    '[data-testid="working-list-row-tei-2"]'
                )
                expect(row?.getAttribute('data-invalid')).toBe('true')
                const cells = row?.querySelectorAll('td')
                expect(cells?.[1].textContent).toBe('###')
                expect(cells?.[1].querySelector('[role="img"]')).toBeNull()
                const headerCells = container.querySelectorAll('thead th') ?? []
                expect(headerCells[headerCells.length - 1]?.textContent).toBe(
                    'Data quality'
                )
                const marker = container.querySelector(
                    '[data-testid="row-issues-tei-2"]'
                )
                expect(marker?.getAttribute('aria-label')).toBe(
                    'Row has 2 data quality issues'
                )
                const lastCell = cells?.[cells.length - 1]
                expect(marker?.closest('td')).toBe(lastCell)
                expect(lastCell?.dataset.testid).toBe(
                    'working-list-issues-cell-tei-2'
                )
            } finally {
                act(() => root.unmount())
                container.remove()
            }
        })
    })
})
