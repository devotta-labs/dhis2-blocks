import React from 'react'
import { page } from 'vitest/browser'
import { render } from 'vitest-browser-react'
import { ProfileWidgetMenu, ProfileWidgetMenuItem } from '../menu'

const renderMenu = async (label?: string) => {
    const onChangelog = vi.fn()
    const onDeactivate = vi.fn()
    const onDelete = vi.fn()
    const triggerRef = React.createRef<HTMLButtonElement>()
    const screen = await render(
        <ProfileWidgetMenu ref={triggerRef} label={label} data-test="menu">
            <ProfileWidgetMenuItem onClick={onChangelog}>
                View changelog
            </ProfileWidgetMenuItem>
            <ProfileWidgetMenuItem destructive onClick={onDeactivate}>
                Deactivate Person
            </ProfileWidgetMenuItem>
            <ProfileWidgetMenuItem
                destructive
                disabled
                disabledReason="You do not have access to delete this Person"
                onClick={onDelete}
            >
                Delete Person
            </ProfileWidgetMenuItem>
        </ProfileWidgetMenu>
    )

    return { screen, triggerRef, onChangelog, onDeactivate, onDelete }
}

describe('ProfileWidgetMenu', () => {
    it('renders an accessible icon trigger that opens a menu', async () => {
        const { screen, triggerRef, onChangelog } = await renderMenu()

        const trigger = screen.getByRole('button', { name: 'More actions' })
        await expect
            .element(trigger)
            .toHaveAttribute('data-slot', 'profile-widget-menu')
        await expect.element(trigger).toHaveAttribute('data-test', 'menu')
        expect(triggerRef.current).toBe(trigger.element())
        expect(trigger.element().querySelector('svg')).not.toBeNull()

        await trigger.click()

        await expect.element(page.getByRole('menu')).toBeVisible()
        expect(
            page
                .getByRole('menuitem')
                .elements()
                .map((item) => item.textContent)
        ).toEqual(['View changelog', 'Deactivate Person', 'Delete Person'])

        await page.getByRole('menuitem', { name: 'View changelog' }).click()
        expect(onChangelog).toHaveBeenCalledOnce()
        await expect.element(page.getByRole('menu')).not.toBeInTheDocument()
    })

    it('takes a custom trigger label', async () => {
        const { screen } = await renderMenu('Person actions')

        await expect
            .element(screen.getByRole('button', { name: 'Person actions' }))
            .toBeVisible()
    })

    it('marks destructive items and keeps them actionable', async () => {
        const { screen, onDeactivate } = await renderMenu()
        await screen.getByRole('button', { name: 'More actions' }).click()

        const deactivate = page.getByRole('menuitem', {
            name: 'Deactivate Person',
        })
        await expect
            .element(deactivate)
            .toHaveAttribute('data-variant', 'destructive')
        await expect
            .element(page.getByRole('menuitem', { name: 'View changelog' }))
            .toHaveAttribute('data-variant', 'default')
        await deactivate.click()
        expect(onDeactivate).toHaveBeenCalledOnce()
    })

    it('disables an item and explains why in a tooltip and its description', async () => {
        const { screen, onDelete } = await renderMenu()
        await screen.getByRole('button', { name: 'More actions' }).click()

        const remove = page.getByRole('menuitem', { name: 'Delete Person' })
        await expect.element(remove).toHaveAttribute('aria-disabled', 'true')
        // Disabled wins over destructive: grey like @dhis2/ui, not red.
        await expect.element(remove).toHaveAttribute('data-variant', 'default')
        await expect.element(remove).toHaveAttribute('data-destructive', 'true')
        await expect
            .element(remove)
            .toHaveAccessibleDescription(
                'You do not have access to delete this Person'
            )

        await remove.hover()
        await expect
            .element(
                page
                    .getByText('You do not have access to delete this Person')
                    .last()
            )
            .toBeVisible()

        await remove.click({ force: true })
        expect(onDelete).not.toHaveBeenCalled()
    })

    it('disables an item without a reason and adds no tooltip', async () => {
        const onSelect = vi.fn()
        const screen = await render(
            <ProfileWidgetMenu>
                <ProfileWidgetMenuItem disabled onClick={onSelect}>
                    Locked
                </ProfileWidgetMenuItem>
            </ProfileWidgetMenu>
        )
        await screen.getByRole('button', { name: 'More actions' }).click()

        const locked = page.getByRole('menuitem', { name: 'Locked' })
        await expect.element(locked).toHaveAttribute('aria-disabled', 'true')
        expect(locked.element().hasAttribute('aria-describedby')).toBe(false)
        await locked.click({ force: true })
        expect(onSelect).not.toHaveBeenCalled()
    })

    it('ignores disabledReason on an enabled item', async () => {
        const onSelect = vi.fn()
        const screen = await render(
            <ProfileWidgetMenu>
                <ProfileWidgetMenuItem
                    disabledReason="Not shown"
                    onClick={onSelect}
                >
                    Open
                </ProfileWidgetMenuItem>
            </ProfileWidgetMenu>
        )
        await screen.getByRole('button', { name: 'More actions' }).click()

        const open = page.getByRole('menuitem', { name: 'Open' })
        expect(open.element().hasAttribute('aria-describedby')).toBe(false)
        await open.click()
        expect(onSelect).toHaveBeenCalledOnce()
    })
})
