import React, { useState } from 'react'
import { vi } from 'vitest'
import { page } from 'vitest/browser'
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
        await render(
            <DiscardChangesDialog
                open={false}
                onCancel={() => undefined}
                onDiscard={() => undefined}
            />
        )

        await expect
            .element(page.getByRole('alertdialog'))
            .not.toBeInTheDocument()
        await expect
            .element(
                page.getByRole('heading', { name: 'Discard unsaved changes?' })
            )
            .not.toBeInTheDocument()
    })

    it.each(['No, cancel', 'Yes, discard changes'])(
        'dismisses the portal and restores focus after %s',
        async (action) => {
            const Harness = () => {
                const [open, setOpen] = useState(false)
                return (
                    <>
                        <button onClick={() => setOpen(true)}>
                            Change context
                        </button>
                        <DiscardChangesDialog
                            open={open}
                            onCancel={() => setOpen(false)}
                            onDiscard={() => setOpen(false)}
                        />
                    </>
                )
            }
            const screen = await render(<Harness />)
            const trigger = screen.getByRole('button', {
                name: 'Change context',
            })
            await trigger.click()
            const dialog = page.getByRole('alertdialog')
            await expect.element(dialog).toBeVisible()
            await expect
                .element(page.getByRole('button', { name: 'No, cancel' }))
                .toHaveFocus()
            await page.getByRole('button', { name: action }).click()
            await expect.element(dialog).not.toBeInTheDocument()
            await expect
                .element(
                    page.getByRole('heading', {
                        name: 'Discard unsaved changes?',
                    })
                )
                .not.toBeInTheDocument()
            await expect.element(trigger).toHaveFocus()
        }
    )
})
