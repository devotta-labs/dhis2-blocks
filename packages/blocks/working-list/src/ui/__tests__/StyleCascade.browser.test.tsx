import { CssReset } from '@dhis2/ui'
import React from 'react'
import { page } from 'vitest/browser'
import { render } from 'vitest-browser-react'
import { resolveWorkingListCapabilities } from '../../api/capabilities'
import { FilterButton, ProgramStageControl } from '../FilterControls'
import { SavedListBar } from '../SavedListBar'
import { WorkingListTableView } from '../WorkingListTable/WorkingListTableView'
import { WorkingListTextProvider } from '../WorkingListText'

describe('Working List CSS cascade with the DHIS2 reset', () => {
    it('keeps dirty status accessible but visually clipped, and renders one menu surface', async () => {
        const screen = await render(
            <WorkingListTextProvider translate={(message) => message}>
                <CssReset />
                <SavedListBar
                    lists={[
                        {
                            id: 'OwnedList01',
                            name: 'My working list',
                            compatible: true,
                            generated: false,
                            canUpdate: true,
                            canShare: true,
                            canDelete: true,
                        },
                    ]}
                    selectedId="OwnedList01"
                    dirty
                    online
                    busy={false}
                    onSelect={() => undefined}
                    onUpdate={() => undefined}
                    onShare={() => undefined}
                    onDelete={() => undefined}
                />
            </WorkingListTextProvider>
        )

        const label = screen.getByTestId('working-list-dirty-label').element()
        const hiddenStyle = getComputedStyle(label)

        expect(label.textContent).toBe('Unsaved changes')
        expect(label.getAttribute('aria-hidden')).toBeNull()
        expect(hiddenStyle.position).toBe('absolute')
        expect(hiddenStyle.width).toBe('1px')
        expect(hiddenStyle.height).toBe('1px')
        expect(hiddenStyle.overflow).toBe('hidden')
        expect(hiddenStyle.clipPath).toBe('inset(50%)')

        await screen
            .getByRole('button', { name: 'Actions for {{name}}' })
            .click()
        await expect
            .element(page.getByRole('menuitem', { name: 'Manage sharing' }))
            .toBeVisible()

        const popper = document.querySelector<HTMLElement>(
            '[data-test="dhis2-uicore-popper"]'
        )

        expect(popper).not.toBeNull()
        expect(getComputedStyle(popper!).backgroundColor).toBe(
            'rgba(0, 0, 0, 0)'
        )
        expect(getComputedStyle(popper!).boxShadow).toBe('none')
        expect(getComputedStyle(popper!).borderRadius).toBe('0px')
    })

    it('gives the empty-state content room without overriding DHIS2 table-cell padding', async () => {
        const screen = await render(
            <WorkingListTextProvider translate={(message) => message}>
                <CssReset />
                <WorkingListTableView
                    model={{ headerGroups: [], rows: [] }}
                    visibleColumnCount={1}
                    dataQualityMode="hidden"
                    page={1}
                    pageSize={15}
                    hasNextPage={false}
                    isInitialLoading={false}
                    isUpdating={false}
                    onPageChange={() => undefined}
                    onPageSizeChange={() => undefined}
                />
            </WorkingListTextProvider>
        )

        const content = screen.getByTestId('working-list-empty-state').element()

        expect(getComputedStyle(content).paddingTop).toBe('26px')
        expect(getComputedStyle(content).paddingBottom).toBe('26px')
        expect(getComputedStyle(content.parentElement!).paddingTop).toBe('14px')
        await expect
            .element(screen.getByText('No items to display'))
            .toBeVisible()
    })

    it('styles both filter headings locally despite the injected heading reset', async () => {
        await render(
            <WorkingListTextProvider translate={(message) => message}>
                <CssReset />
                <FilterButton
                    defaultOpen
                    field={{
                        id: 'followUp',
                        displayName: 'Follow up',
                        source: 'system',
                        scope: 'trackedEntity',
                        valueType: 'BOOLEAN',
                        filterable: true,
                    }}
                    client={{
                        query: () =>
                            Promise.reject(new Error('Unexpected query')),
                        mutate: () =>
                            Promise.reject(new Error('Unexpected mutation')),
                    }}
                    capabilities={resolveWorkingListCapabilities({
                        apiVersion: 43,
                    })}
                    calendarContext={{
                        calendar: 'gregorian',
                        dateFormat: 'YYYY-MM-DD',
                        locale: 'en',
                        timeZone: 'Etc/UTC',
                    }}
                    onApply={() => undefined}
                    onReset={() => undefined}
                />
                <ProgramStageControl
                    defaultOpen
                    program={{
                        id: 'Program0001',
                        displayName: 'Program',
                        programType: 'WITH_REGISTRATION',
                        programTrackedEntityAttributes: [],
                        programStages: [
                            {
                                id: 'Stage000001',
                                displayName: 'Visit',
                                programStageDataElements: [],
                            },
                        ],
                    }}
                    onChange={() => undefined}
                    onRemove={() => undefined}
                />
            </WorkingListTextProvider>
        )

        for (const title of ['Follow up', 'Program stage']) {
            const heading = page.getByRole('heading', { name: title })

            await expect.element(heading).toBeVisible()

            const style = getComputedStyle(heading.element())

            expect(style.fontSize).toBe('16px')
            expect(style.fontWeight).toBe('500')
            expect(style.marginTop).toBe('0px')
            expect(style.marginBottom).toBe('12px')
        }
    })
})
