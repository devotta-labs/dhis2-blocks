import React, { act, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { z } from 'zod'
import type { WorkingListField, WorkingListSort } from '../../domain/model'
import type {
    WorkingListDisplayRow,
    WorkingListPageSize,
} from '../../provider/contracts'
import { WorkingListDataTable } from '../WorkingListTable/WorkingListTable'
import {
    WorkingListTableView,
    type WorkingListTableHeaderView,
    type WorkingListTableViewModel,
} from '../WorkingListTable/WorkingListTableView'
import { WorkingListTextProvider } from '../WorkingListText'

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

const TestCellScalarSchema = z.union([z.string(), z.number(), z.boolean()])

interface WorkingListTableScenario {
    rows: WorkingListDisplayRow[]
    dataQualityMode: 'hidden' | 'highlighted'
    sort: WorkingListSort
    page: number
    pageSize: WorkingListPageSize
    hasNextPage: boolean
    isInitialLoading: boolean
    isUpdating: boolean
    onPageChange: (page: number) => void
    onPageSizeChange: (pageSize: WorkingListPageSize) => void
    onRowOpen?: (row: WorkingListDisplayRow) => void
    onSortChange: (sort: WorkingListSort) => void
}

const cellContent = (row: WorkingListDisplayRow, field: WorkingListField) => {
    const cell = row.values[field.id]
    if (!cell) {
        return null
    }
    if (!cell.valid) {
        if (cell.raw === undefined || cell.raw === null || cell.raw === '') {
            return null
        }
        const scalar = TestCellScalarSchema.safeParse(cell.raw)
        return scalar.success ? String(scalar.data) : '-'
    }
    if (cell.value === undefined) {
        return null
    }
    if (field.valueType === 'URL') {
        const href = z.string().url().parse(cell.value)
        return (
            <a href={href} rel="noreferrer noopener" target="_blank">
                {href}
            </a>
        )
    }
    return String(TestCellScalarSchema.parse(cell.value))
}

const createViewModel = (
    scenario: WorkingListTableScenario
): WorkingListTableViewModel => {
    const showIssues = scenario.dataQualityMode === 'highlighted'
    const headers: WorkingListTableHeaderView[] = fields.map((field) => ({
        id: field.id,
        fieldId: field.id,
        content: field.displayName,
        canSort: true,
        isDataQuality: false,
        sorted:
            scenario.sort.fieldId === field.id
                ? scenario.sort.direction
                : false,
        onToggleSorting: () =>
            scenario.onSortChange({
                fieldId: field.id,
                direction:
                    scenario.sort.fieldId === field.id &&
                    scenario.sort.direction === 'asc'
                        ? 'desc'
                        : 'asc',
            }),
    }))
    if (showIssues) {
        headers.push({
            id: '__dataQuality',
            fieldId: '__dataQuality',
            content: 'Data quality',
            canSort: false,
            isDataQuality: true,
            sorted: false,
            onToggleSorting: () => undefined,
        })
    }
    return {
        headerGroups: [{ id: 'header', headers }],
        rows: scenario.rows.map((row, displayIndex) => ({
            id: row.id,
            displayIndex,
            original: row,
            cells: [
                ...fields.map((field) => ({
                    id: `${row.id}-${field.id}`,
                    fieldId: field.id,
                    content: cellContent(row, field),
                    isDataQuality: false,
                })),
                ...(showIssues
                    ? [
                          {
                              id: `${row.id}-__dataQuality`,
                              fieldId: '__dataQuality',
                              content:
                                  row.issues.length > 0 ? (
                                      <span
                                          role="img"
                                          data-testid={`row-issues-${row.id}`}
                                          aria-label={translate(
                                              'Row has {{count}} data quality issues',
                                              { count: row.issues.length }
                                          )}
                                      />
                                  ) : null,
                              isDataQuality: true,
                          },
                      ]
                    : []),
            ],
        })),
    }
}

const renderTable = (
    container: HTMLElement,
    props: Partial<WorkingListTableScenario>
) => {
    const scenario: WorkingListTableScenario = {
        rows: [],
        dataQualityMode: 'hidden',
        sort: { fieldId: 'lastName', direction: 'desc' },
        page: 1,
        pageSize: 15,
        hasNextPage: false,
        isInitialLoading: false,
        isUpdating: false,
        onPageChange: () => undefined,
        onPageSizeChange: () => undefined,
        onRowOpen: () => undefined,
        onSortChange: () => undefined,
        ...props,
    }
    const root = createRoot(container)
    act(() => {
        root.render(
            <WorkingListTextProvider translate={translate}>
                <WorkingListTableView
                    model={createViewModel(scenario)}
                    visibleColumnCount={fields.length}
                    dataQualityMode={scenario.dataQualityMode}
                    page={scenario.page}
                    pageSize={scenario.pageSize}
                    hasNextPage={scenario.hasNextPage}
                    isInitialLoading={scenario.isInitialLoading}
                    isUpdating={scenario.isUpdating}
                    onPageChange={scenario.onPageChange}
                    onPageSizeChange={scenario.onPageSizeChange}
                    onRowOpen={scenario.onRowOpen}
                />
            </WorkingListTextProvider>
        )
    })
    return root
}

const withActEnvironment = (run: () => void) => {
    const actEnvironment = globalThis
    const originalActEnvironment = actEnvironment.IS_REACT_ACT_ENVIRONMENT
    actEnvironment.IS_REACT_ACT_ENVIRONMENT = true
    try {
        run()
    } finally {
        actEnvironment.IS_REACT_ACT_ENVIRONMENT = originalActEnvironment
    }
}

describe('WorkingListTable', () => {
    it('renders the ascending, descending, and default states across three clicks', () => {
        withActEnvironment(() => {
            const container = document.createElement('div')
            document.body.appendChild(container)
            const root = createRoot(container)
            const sortFields: WorkingListField[] = [
                ...fields,
                {
                    id: 'createdAt',
                    displayName: 'Registration date',
                    source: 'system',
                    scope: 'trackedEntity',
                    valueType: 'DATETIME',
                    filterable: true,
                },
            ]
            const SortingHarness = () => {
                const [sort, setSort] = useState<WorkingListSort>({
                    fieldId: 'createdAt',
                    direction: 'desc',
                })
                return (
                    <WorkingListTextProvider translate={translate}>
                        <WorkingListDataTable
                            allFields={sortFields}
                            visibleColumnIds={fields.map((field) => field.id)}
                            sort={sort}
                            page={1}
                            pageSize={15}
                            hasNextPage={false}
                            isInitialLoading={false}
                            isUpdating={false}
                            formattingContext={{}}
                            onColumnConfigurationChange={() => undefined}
                            onPageChange={() => undefined}
                            onPageSizeChange={() => undefined}
                            onSortChange={setSort}
                        />
                    </WorkingListTextProvider>
                )
            }

            try {
                act(() => root.render(<SortingHarness />))
                const sortButton = container.querySelector<HTMLButtonElement>(
                    '[data-testid="sort-firstName"]'
                )
                const header = sortButton?.closest('th')

                expect(sortButton?.textContent).toContain('↕')
                expect(header?.getAttribute('aria-sort')).toBe('none')

                act(() => sortButton?.click())
                expect(sortButton?.textContent).toContain('↑')
                expect(header?.getAttribute('aria-sort')).toBe('ascending')

                act(() => sortButton?.click())
                expect(sortButton?.textContent).toContain('↓')
                expect(header?.getAttribute('aria-sort')).toBe('descending')

                act(() => sortButton?.click())
                expect(sortButton?.textContent).toContain('↕')
                expect(header?.getAttribute('aria-sort')).toBe('none')
            } finally {
                act(() => root.unmount())
                container.remove()
            }
        })
    })

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
                    table?.querySelector(
                        'table[data-test="working-list-data-table"]'
                    )
                ).not.toBeNull()
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
                expect(onRowOpen).toHaveBeenLastCalledWith(
                    expect.objectContaining({
                        id: 'tei-1',
                        trackedEntityId: 'tei-1',
                    })
                )

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

    it('renders rows without pointer or keyboard affordances when no row callback is supplied', () => {
        withActEnvironment(() => {
            const container = document.createElement('div')
            document.body.appendChild(container)
            const root = renderTable(container, {
                rows: [
                    {
                        id: 'tei-static',
                        trackedEntityId: 'tei-static',
                        values: {
                            firstName: { valid: true, value: 'Static' },
                        },
                        issues: [],
                    },
                ],
                onRowOpen: undefined,
            })

            try {
                const row = container.querySelector<HTMLTableRowElement>(
                    '[data-testid="working-list-row-tei-static"]'
                )
                const firstCell = row?.querySelector<HTMLTableCellElement>('td')

                expect(row?.className).not.toContain('cursor-pointer')
                expect(row?.hasAttribute('role')).toBe(false)
                expect(row?.hasAttribute('tabindex')).toBe(false)
                expect(
                    row?.querySelector('[data-testid="row-open-tei-static"]')
                ).toBeNull()
                expect(firstCell?.onclick).toBeNull()
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
