import React from 'react'
import { page, userEvent } from 'vitest/browser'
import { render } from 'vitest-browser-react'
import type { WorkingListField } from '../../domain/model'
import { MoreFilters } from '../FilterControls'
import { WorkingListTextProvider } from '../WorkingListText'

const field: WorkingListField = {
    id: 'followUp',
    displayName: 'Follow up',
    source: 'system',
    scope: 'trackedEntity',
    valueType: 'BOOLEAN',
    filterable: true,
}

describe('MoreFilters real-browser keyboard focus', () => {
    it('activates a menu item and restores its trigger after Enter and Escape', async () => {
        const onAdd = vi.fn()
        const screen = await render(
            <WorkingListTextProvider translate={(message) => message}>
                <MoreFilters
                    fields={[field]}
                    visibleFilterIds={[]}
                    scope="tracked-entity"
                    onAdd={onAdd}
                />
            </WorkingListTextProvider>
        )
        const trigger = screen.getByRole('button', { name: 'Filter' })

        await trigger.click()
        const firstItem = page.getByRole('menuitem', { name: 'Follow up' })
        await expect.element(firstItem).toBeVisible()
        const focusTarget = document.querySelector<HTMLElement>(
            '[data-test="add-filter-followUp"]'
        )
        expect(focusTarget?.hasAttribute('tabindex')).toBe(true)
        expect(document.activeElement).toBe(focusTarget)

        await userEvent.keyboard('{Enter}')
        expect(onAdd).toHaveBeenCalledWith('followUp')
        await expect.element(trigger).toHaveFocus()

        await trigger.click()
        expect(document.activeElement).toBe(
            document.querySelector('[data-test="add-filter-followUp"]')
        )

        await userEvent.keyboard('{Escape}')
        await expect.element(trigger).toHaveFocus()
    })
})
