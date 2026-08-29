import React, { act, useId, type ReactNode } from 'react'
import { createRoot } from 'react-dom/client'
import { resolveWorkingListCapabilities } from '../../api/capabilities'
import type { WorkingListClient } from '../../api/client'
import type { WorkingListField } from '../../domain/model'
import type { WorkingListSavedView } from '../../provider/contracts'
import { FilterButton } from '../FilterControls'
import { SavedListBar } from '../SavedListBar'
import { WorkingListToolbar } from '../Toolbar'
import {
    WorkingListTableView,
    type WorkingListTableViewModel,
} from '../WorkingListTable/WorkingListTableView'
import { WorkingListTextProvider } from '../WorkingListText'

const client: WorkingListClient = {
    query: () => Promise.reject(new Error('Unexpected query')),
    mutate: () => Promise.reject(new Error('Unexpected mutation')),
}

const field: WorkingListField = {
    id: 'followUp',
    displayName: 'Follow up',
    source: 'system',
    scope: 'trackedEntity',
    valueType: 'BOOLEAN',
    filterable: true,
}

const savedView: WorkingListSavedView = {
    id: 'saved-view',
    name: 'Saved view',
    generated: false,
    compatible: true,
    canUpdate: false,
    canDelete: false,
    canShare: true,
}

const emptyModel: WorkingListTableViewModel = {
    headerGroups: [],
    rows: [],
}

const TestSection = ({
    title,
    ariaLabel,
    children,
}: {
    title?: string
    ariaLabel?: string
    children: ReactNode
}) => {
    const headingId = useId()
    return (
        <section
            data-testid="working-list-section"
            aria-label={ariaLabel}
            aria-labelledby={title ? headingId : undefined}
        >
            {title && <h2 id={headingId}>{title}</h2>}
            {children}
        </section>
    )
}

const RelationshipSet = () => (
    <>
        <TestSection title="Saved views in this program">
            <SavedListBar
                lists={[savedView]}
                dirty={false}
                online
                busy={false}
                onSelect={() => undefined}
                onUpdate={() => undefined}
                onShare={() => undefined}
                onDelete={() => undefined}
            />
        </TestSection>
        <TestSection ariaLabel="Tracked entity filters">
            <WorkingListToolbar>
                <span>Controls</span>
            </WorkingListToolbar>
        </TestSection>
        <TestSection ariaLabel="Working list results">
            <WorkingListTableView
                model={emptyModel}
                visibleColumnCount={0}
                dataQualityMode="hidden"
                page={1}
                pageSize={10}
                hasNextPage={false}
                isInitialLoading={false}
                isUpdating={false}
                onPageChange={() => undefined}
                onPageSizeChange={() => undefined}
                onRowOpen={() => undefined}
            />
        </TestSection>
        <FilterButton
            defaultOpen
            client={client}
            field={field}
            capabilities={resolveWorkingListCapabilities({ apiVersion: 43 })}
            calendarContext={{
                calendar: 'gregorian',
                dateFormat: 'YYYY-MM-DD',
                locale: 'en',
                timeZone: 'Etc/UTC',
            }}
            onApply={() => undefined}
            onReset={() => undefined}
        />
    </>
)

describe('multiple working list instances', () => {
    it('uses unique IDs and resolves each accessible DOM relationship locally', () => {
        const actEnvironment = globalThis
        const originalActEnvironment = actEnvironment.IS_REACT_ACT_ENVIRONMENT
        const originalRequestAnimationFrame = window.requestAnimationFrame
        const originalCancelAnimationFrame = window.cancelAnimationFrame
        actEnvironment.IS_REACT_ACT_ENVIRONMENT = true
        window.requestAnimationFrame = (callback) => {
            callback(0)
            return 1
        }
        window.cancelAnimationFrame = () => undefined

        const container = document.createElement('div')
        document.body.appendChild(container)
        const root = createRoot(container)

        try {
            act(() => {
                root.render(
                    <WorkingListTextProvider translate={(message) => message}>
                        <RelationshipSet />
                        <RelationshipSet />
                    </WorkingListTextProvider>
                )
            })

            const sections = [
                ...container.querySelectorAll<HTMLElement>(
                    '[data-testid="working-list-section"]'
                ),
            ]
            expect(sections).toHaveLength(6)
            expect(
                sections
                    .filter((section) => section.hasAttribute('aria-label'))
                    .map((section) => section.getAttribute('aria-label'))
            ).toEqual([
                'Tracked entity filters',
                'Working list results',
                'Tracked entity filters',
                'Working list results',
            ])

            const relationships = [
                ...container.querySelectorAll<HTMLElement>(
                    '[data-testid="working-list-section"][aria-labelledby]'
                ),
                ...container.querySelectorAll<HTMLElement>(
                    '[data-test="filter-followUp-select"] [role="combobox"][aria-controls]'
                ),
            ].map((element) =>
                element.getAttribute(
                    element.hasAttribute('aria-labelledby')
                        ? 'aria-labelledby'
                        : 'aria-controls'
                )
            )

            expect(relationships).toHaveLength(4)
            expect(new Set(relationships).size).toBe(relationships.length)
            relationships.forEach((id) => {
                expect(id).not.toBeNull()
                expect(document.getElementById(id ?? '')).not.toBeNull()
            })
            const headings = [...container.querySelectorAll('h2')]
            expect(headings).toHaveLength(2)
            expect(headings.map((heading) => heading.textContent)).toEqual([
                'Saved views in this program',
                'Saved views in this program',
            ])
            const resultViews = [
                ...container.querySelectorAll<HTMLElement>(
                    '[data-testid="working-list-results"]'
                ),
            ]
            expect(resultViews).toHaveLength(2)
            resultViews.forEach((results) => {
                expect(results.tagName).toBe('DIV')
                expect(results.hasAttribute('aria-label')).toBe(false)
                expect(results.hasAttribute('aria-labelledby')).toBe(false)
            })

            const menuButtons = container.querySelectorAll<HTMLButtonElement>(
                '[data-testid="working-list-view-saved-view-menu"]'
            )
            expect(menuButtons).toHaveLength(2)
            const menuIds: string[] = []
            menuButtons.forEach((button) => {
                act(() => button.click())
                const menuId = button.getAttribute('aria-controls')
                expect(menuId).not.toBeNull()
                menuIds.push(menuId ?? '')
                expect(document.getElementById(menuId ?? '')).not.toBeNull()
            })
            expect(new Set(menuIds).size).toBe(menuIds.length)
        } finally {
            act(() => root.unmount())
            container.remove()
            window.requestAnimationFrame = originalRequestAnimationFrame
            window.cancelAnimationFrame = originalCancelAnimationFrame
            actEnvironment.IS_REACT_ACT_ENVIRONMENT = originalActEnvironment
        }
    })
})
