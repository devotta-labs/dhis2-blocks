import React from 'react'
import { vi } from 'vitest'
import { render } from 'vitest-browser-react'
import { DiscardChangesDialog } from './DiscardChangesDialog'

describe('DiscardChangesDialog', () => {
    it('renders Capture copy and invokes the controlled actions', async () => {
        const onCancel = vi.fn()
        const onDiscard = vi.fn()
        const screen = await render(
            <DiscardChangesDialog
                open
                onCancel={onCancel}
                onDiscard={onDiscard}
            />
        )

        await expect
            .element(
                screen.getByRole('heading', {
                    name: 'Discard unsaved changes?',
                })
            )
            .toBeVisible()
        await expect
            .element(
                screen.getByText(
                    'This event has unsaved changes. Leaving this page without saving will lose these changes. Are you sure you want to discard unsaved changes?'
                )
            )
            .toBeVisible()

        await screen.getByRole('button', { name: 'No, cancel' }).click()
        expect(onCancel).toHaveBeenCalledOnce()

        await screen
            .getByRole('button', { name: 'Yes, discard changes' })
            .click()
        expect(onDiscard).toHaveBeenCalledOnce()
    })

    it('does not render when closed', async () => {
        const screen = await render(
            <DiscardChangesDialog
                open={false}
                onCancel={() => undefined}
                onDiscard={() => undefined}
            />
        )

        expect(screen.container.textContent).toBe('')
    })

    it('keeps the Capture message spacing and destructive action style', async () => {
        const screen = await render(
            <DiscardChangesDialog
                open
                onCancel={() => undefined}
                onDiscard={() => undefined}
            />
        )
        const message = screen.getByText(
            'This event has unsaved changes. Leaving this page without saving will lose these changes. Are you sure you want to discard unsaved changes?'
        )
        const destructiveButton = screen.getByRole('button', {
            name: 'Yes, discard changes',
        })

        expect(getComputedStyle(message.element()).marginTop).toBe('5px')
        expect(getComputedStyle(message.element()).marginBottom).toBe('5px')
        expect(
            getComputedStyle(destructiveButton.element()).backgroundColor
        ).not.toBe('rgba(0, 0, 0, 0)')
    })
})
