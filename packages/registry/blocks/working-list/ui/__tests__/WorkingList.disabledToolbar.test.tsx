import React from 'react'
import { render } from 'vitest-browser-react'
import {
    createFakeServer,
    FakeServerRuntime,
    silent,
} from '../../__tests__/fakeServer'
import { WorkingListToolbarActions } from '../Actions'
import { WorkingListColumnSelector } from '../Columns'
import { WorkingListFilterControls } from '../Filters'
import { WorkingListToolbar } from '../Toolbar'
import { WorkingList } from '../WorkingList'

describe('working-list unavailable toolbar', () => {
    it('keeps familiar configuration controls visible and disabled', async () => {
        const server = createFakeServer({
            resources: { trackedEntityInstanceFilters: silent },
        })
        const screen = await render(
            <FakeServerRuntime server={server}>
                <WorkingList
                    programId="Program0001"
                    orgUnitId="OrgUnit0001"
                    defaultViewId="requested-view"
                >
                    <WorkingListToolbar>
                        <WorkingListColumnSelector
                            className="consumer-columns"
                            data-consumer="columns"
                        />
                        <WorkingListFilterControls
                            className="consumer-filters"
                            data-consumer="filters"
                        />
                        <WorkingListToolbarActions
                            className="consumer-actions"
                            data-consumer="actions"
                        />
                    </WorkingListToolbar>
                </WorkingList>
            </FakeServerRuntime>
        )
        const toolbar = screen.getByRole('toolbar', {
            name: 'Working list controls',
        })
        await expect.element(toolbar).toBeVisible()
        for (const name of ['Columns', 'Filter', 'Save view', 'More']) {
            await expect
                .element(screen.getByRole('button', { name }))
                .toBeDisabled()
        }
        expect(
            screen.container.querySelector('[data-consumer="columns"]')
                ?.className
        ).toBe('consumer-columns')
        expect(
            screen.container.querySelector('[data-consumer="filters"]')
                ?.className
        ).toContain('consumer-filters')
        expect(
            screen.container.querySelector('[data-consumer="actions"]')
                ?.className
        ).toContain('consumer-actions')
        expect(screen.container.textContent).not.toContain(
            'Tracked entity filters'
        )
    })
})
