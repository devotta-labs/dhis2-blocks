import React from 'react'
import { page, userEvent } from 'vitest/browser'
import { render } from 'vitest-browser-react'
import { WorkingListTableView } from '../WorkingListTable/WorkingListTableView'
import { WorkingListTextProvider } from '../WorkingListText'

const row = { id: 'r1', values: {}, issues: [] }

test('outlines the row when its open button has focus', async () => {
    await render(
        <WorkingListTextProvider translate={(message) => message}>
            <WorkingListTableView
                model={{
                    headerGroups: [],
                    rows: [
                        {
                            id: 'r1',
                            displayIndex: 0,
                            original: row,
                            cells: [
                                {
                                    id: 'r1-name',
                                    fieldId: 'name',
                                    content: 'Amina',
                                    isDataQuality: false,
                                },
                            ],
                        },
                    ],
                }}
                visibleColumnCount={1}
                dataQualityMode="hidden"
                page={1}
                pageSize={15}
                hasNextPage={false}
                isInitialLoading={false}
                isUpdating={false}
                onPageChange={() => undefined}
                onPageSizeChange={() => undefined}
                onRowOpen={() => undefined}
            />
        </WorkingListTextProvider>
    )
    const tableRow = page.getByTestId('working-list-row-r1').element()
    const before = tableRow.getBoundingClientRect().height
    page.getByTestId('row-open-r1').element().focus()
    await userEvent.keyboard('{Shift>}{Tab}{/Shift}{Tab}')

    expect(document.activeElement).toBe(
        page.getByTestId('row-open-r1').element()
    )
    const style = getComputedStyle(tableRow)
    expect(style.outlineStyle).toBe('solid')
    expect(parseFloat(style.outlineWidth)).toBeGreaterThanOrEqual(2)
    expect(tableRow.getBoundingClientRect().height).toBe(before)
})
