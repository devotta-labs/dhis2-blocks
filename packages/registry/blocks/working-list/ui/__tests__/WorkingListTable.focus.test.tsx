import React from 'react'
import { page, userEvent } from 'vitest/browser'
import { render } from 'vitest-browser-react'
import type { WorkingListField } from '../../domain/model'
import { WorkingListDataTable } from '../WorkingListTable/WorkingListTable'

const name: WorkingListField = {
    id: 'name',
    displayName: 'Name',
    source: 'trackedEntityAttribute',
    scope: 'trackedEntity',
    valueType: 'TEXT',
    filterable: true,
}

test('outlines the row when its open button has focus', async () => {
    await render(
        <WorkingListDataTable
            allFields={[name]}
            visibleColumnIds={[name.id]}
            rows={[
                {
                    id: 'r1',
                    values: { name: { valid: true, value: 'Amina' } },
                    issues: [],
                },
            ]}
            sort={{ fieldId: name.id, direction: 'asc' }}
            page={1}
            pageSize={15}
            hasNextPage={false}
            isInitialLoading={false}
            isUpdating={false}
            onColumnConfigurationChange={() => undefined}
            onPageChange={() => undefined}
            onPageSizeChange={() => undefined}
            onRowOpen={() => undefined}
            onSortChange={() => undefined}
        />
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
