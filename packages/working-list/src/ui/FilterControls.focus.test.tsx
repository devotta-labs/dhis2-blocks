import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import type { WorkingListField } from '../domain/model'
import { MoreFilters } from './FilterControls'
import { WorkingListTextProvider } from './text'

const field: WorkingListField = {
    id: 'followUp',
    displayName: 'Follow up',
    source: 'system',
    scope: 'trackedEntity',
    valueType: 'BOOLEAN',
    filterable: true,
}

describe('MoreFilters keyboard focus', () => {
    it('focuses and activates DHIS2 menu items, then restores the trigger', () => {
        const actEnvironment = globalThis as typeof globalThis & {
            IS_REACT_ACT_ENVIRONMENT?: boolean
        }
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
        const onAdd = jest.fn()

        try {
            act(() => {
                root.render(
                    <WorkingListTextProvider translate={(message) => message}>
                        <MoreFilters
                            fields={[field]}
                            visibleFilterIds={[]}
                            scope="tracked-entity"
                            includeProgramStage
                            onAdd={onAdd}
                        />
                    </WorkingListTextProvider>
                )
            })

            const trigger = container.querySelector<HTMLButtonElement>(
                '[data-testid="more-filters-tracked-entity"]'
            )
            expect(trigger).not.toBeNull()

            act(() => {
                trigger?.dispatchEvent(
                    new MouseEvent('click', { bubbles: true })
                )
            })

            const firstItem = document.querySelector<HTMLElement>(
                '[data-test="add-filter-followUp"]'
            )
            const programStageItem = document.querySelector<HTMLElement>(
                '[data-test="add-filter-programStage"]'
            )
            expect(firstItem).not.toBeNull()
            expect(firstItem?.hasAttribute('tabindex')).toBe(true)
            expect(programStageItem?.hasAttribute('tabindex')).toBe(true)
            expect(document.activeElement).toBe(firstItem)

            act(() => {
                firstItem?.dispatchEvent(
                    new KeyboardEvent('keydown', {
                        key: 'Enter',
                        bubbles: true,
                    })
                )
            })

            expect(onAdd).toHaveBeenCalledWith('followUp')
            expect(document.activeElement).toBe(trigger)

            act(() => {
                trigger?.dispatchEvent(
                    new MouseEvent('click', { bubbles: true })
                )
            })
            expect(document.activeElement).toBe(
                document.querySelector('[data-test="add-filter-followUp"]')
            )

            act(() => {
                document.dispatchEvent(
                    new KeyboardEvent('keydown', {
                        key: 'Escape',
                        bubbles: true,
                    })
                )
            })

            expect(document.activeElement).toBe(trigger)
        } finally {
            act(() => root.unmount())
            container.remove()
            window.requestAnimationFrame = originalRequestAnimationFrame
            window.cancelAnimationFrame = originalCancelAnimationFrame
            actEnvironment.IS_REACT_ACT_ENVIRONMENT = originalActEnvironment
        }
    })
})
