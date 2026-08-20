import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import type { NormalizedSavedWorkingList } from '../api/savedLists'
import { SavedListBar } from './SavedListBar'
import { WorkingListTextProvider } from './text'

const generatedList: NormalizedSavedWorkingList = {
    id: 'active',
    name: 'Active enrollments',
    resource: 'trackedEntityInstanceFilters',
    sharing: {},
    compatibility: 'compatible',
    configuration: {
        mode: 'trackedEntity',
        programId: 'Program0001',
        filters: [],
        columns: ['createdAt'],
        sort: { fieldId: 'createdAt', direction: 'desc' },
    },
}

describe('SavedListBar', () => {
    const actEnvironment = globalThis as typeof globalThis & {
        IS_REACT_ACT_ENVIRONMENT?: boolean
    }
    let originalActEnvironment: boolean | undefined

    beforeEach(() => {
        originalActEnvironment = actEnvironment.IS_REACT_ACT_ENVIRONMENT
        actEnvironment.IS_REACT_ACT_ENVIRONMENT = true
    })

    afterEach(() => {
        actEnvironment.IS_REACT_ACT_ENVIRONMENT = originalActEnvironment
    })

    const renderBar = (dirty: boolean) => {
        const container = document.createElement('div')
        document.body.appendChild(container)
        const root = createRoot(container)

        act(() => {
            root.render(
                <WorkingListTextProvider translate={(message) => message}>
                    <SavedListBar
                        lists={[generatedList]}
                        selectedId={generatedList.id}
                        listsAreGenerated
                        dirty={dirty}
                        onSelect={() => undefined}
                    />
                </WorkingListTextProvider>
            )
        })

        return {
            container,
            cleanup: () => {
                act(() => root.unmount())
                container.remove()
            },
        }
    }

    it('uses a labelled section and marks the selected view', () => {
        const { container, cleanup } = renderBar(false)

        try {
            const section = container.querySelector<HTMLElement>(
                'section.saved-list-bar[aria-label="Working list views"]'
            )
            const activeView = container.querySelector<HTMLButtonElement>(
                '[data-testid="working-list-view-active"]'
            )

            expect(section).not.toBeNull()
            expect(activeView?.getAttribute('aria-current')).toBe('true')
            expect(section?.querySelector('[role="list"]')).toBeNull()
            expect(
                container.querySelector(
                    '[data-testid="working-list-dirty-indicator"]'
                )
            ).toBeNull()
        } finally {
            cleanup()
        }
    })

    it('stars the active view while it has unsaved changes', () => {
        const { container, cleanup } = renderBar(true)

        try {
            const indicator = container.querySelector<HTMLElement>(
                '[data-testid="working-list-view-active"] [data-testid="working-list-dirty-indicator"]'
            )
            expect(indicator?.textContent).toBe('*')
            expect(indicator?.getAttribute('aria-hidden')).toBe('true')
            expect(
                container.querySelector(
                    '[data-testid="working-list-view-active"] .visually-hidden'
                )?.textContent
            ).toBe('Unsaved changes')
        } finally {
            cleanup()
        }
    })
})
