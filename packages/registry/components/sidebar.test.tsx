import React from 'react'
import { page, userEvent } from 'vitest/browser'
import { render } from 'vitest-browser-react'
import { AppNavigation, ControlledNavigation } from './sidebar.fixtures'
import { roleColour } from '../test/roleColour'

const sidebar = () => {
    const element = document.querySelector('[data-slot="sidebar"]')
    if (element === null) {
        throw new Error('No sidebar')
    }
    return element
}
// The rail carries the same name for the mouse; the trigger is the control.
const trigger = () =>
    page
        .getByRole('button', { name: 'Toggle sidebar' })
        .and(page.getByTestId('trigger'))

describe('sidebar', () => {
    beforeEach(async () => {
        await page.viewport(1280, 720)
    })

    it('collapses to icons from its trigger and expands again', async () => {
        await render(<AppNavigation />)
        expect(sidebar().getAttribute('data-state')).toBe('expanded')
        await expect.element(trigger()).toHaveAttribute('aria-expanded', 'true')

        await trigger().click()
        expect(sidebar().getAttribute('data-state')).toBe('collapsed')
        expect(sidebar().getAttribute('data-collapsible')).toBe('icon')
        await expect
            .element(trigger())
            .toHaveAttribute('aria-expanded', 'false')

        await trigger().click()
        expect(sidebar().getAttribute('data-state')).toBe('expanded')
    })

    it('toggles with Ctrl+B', async () => {
        await render(<AppNavigation />)
        await userEvent.keyboard('{Control>}b{/Control}')
        expect(sidebar().getAttribute('data-state')).toBe('collapsed')
    })

    it('reports a controlled toggle and follows the open prop', async () => {
        const changes: boolean[] = []
        const screen = await render(
            <ControlledNavigation onOpenChange={(open) => changes.push(open)} />
        )
        await trigger().click()
        expect(changes).toEqual([false])
        await expect
            .element(screen.getByTestId('state'))
            .toHaveTextContent('closed')
        expect(sidebar().getAttribute('data-state')).toBe('collapsed')
    })

    it('folds when the app only listens for changes', async () => {
        const changes: boolean[] = []
        await render(
            <AppNavigation onOpenChange={(open) => changes.push(open)} />
        )
        await trigger().click()
        expect(changes).toEqual([false])
        expect(sidebar().getAttribute('data-state')).toBe('collapsed')
    })

    it('marks the current page with the accent fill', async () => {
        await render(<AppNavigation />)
        const today = page.getByRole('link', { name: 'Today' }).element()
        expect(getComputedStyle(today).backgroundColor).toBe(
            roleColour('accent')
        )
        const find = page.getByRole('button', { name: 'Find patient' })
        expect(getComputedStyle(find.element()).backgroundColor).toBe(
            'rgba(0, 0, 0, 0)'
        )
    })

    it('opens and closes a group of pages', async () => {
        await render(<AppNavigation />)
        const reports = page.getByRole('button', { name: 'Reports' })
        await expect
            .element(page.getByRole('link', { name: 'Stock' }))
            .toBeVisible()
        await reports.click()
        await expect.element(reports).toHaveAttribute('aria-expanded', 'false')
        await expect
            .element(page.getByRole('link', { name: 'Stock' }))
            .not.toBeInTheDocument()
    })

    it('names a collapsed icon in a tooltip, and only then', async () => {
        await render(<AppNavigation />)
        const find = page.getByRole('button', { name: 'Find patient' })
        await userEvent.hover(find)
        await expect.element(page.getByRole('tooltip')).not.toBeInTheDocument()

        await trigger().click()
        await userEvent.hover(find)
        const tooltip = document.querySelector('[data-slot="tooltip-content"]')
        await expect
            .poll(() =>
                document
                    .querySelector('[data-slot="tooltip-content"]')
                    ?.textContent?.trim()
            )
            .toBe('Find patient')
        expect(tooltip?.hasAttribute('hidden')).not.toBe(true)
    })

    it.each([
        ['ltr', 'w-resize', 'e-resize'],
        ['rtl', 'e-resize', 'w-resize'],
    ] as const)(
        'points its %s edge the way the sidebar will move',
        async (dir, open, folded) => {
            await render(<AppNavigation dir={dir} />)
            const rail = document.querySelector('[data-slot="sidebar-rail"]')
            if (rail === null) {
                throw new Error('No rail')
            }
            expect(getComputedStyle(rail).cursor).toBe(open)
            await trigger().click()
            expect(getComputedStyle(rail).cursor).toBe(folded)
        }
    )

    it('docks at the start of a right-to-left page', async () => {
        await render(<AppNavigation dir="rtl" />)
        const container = document.querySelector(
            '[data-slot="sidebar-container"]'
        )
        const pageArea = page.getByTestId('page').element()
        if (container === null) {
            throw new Error('No sidebar container')
        }
        expect(container.getBoundingClientRect().left).toBeGreaterThan(
            pageArea.getBoundingClientRect().left
        )
    })

    it('becomes a sheet on a narrow window', async () => {
        await page.viewport(375, 700)
        await render(<AppNavigation />)
        await expect
            .element(page.getByRole('link', { name: 'Today' }))
            .not.toBeInTheDocument()

        await trigger().click()
        const sheet = page.getByRole('dialog', { name: 'Navigation' })
        await expect.element(sheet).toBeVisible()
        await expect
            .element(sheet.getByRole('link', { name: 'Today' }))
            .toBeVisible()

        await userEvent.keyboard('{Escape}')
        await expect.element(sheet).not.toBeInTheDocument()
    })

    it('slides the sheet in from the start of a right-to-left page', async () => {
        await page.viewport(375, 700)
        await render(<AppNavigation dir="rtl" />)
        await trigger().click()
        const sheet = page.getByRole('dialog', { name: 'Navigation' })
        await expect.element(sheet).toBeVisible()
        expect(sheet.element().getAttribute('dir')).toBe('rtl')
        await expect
            .poll(() =>
                Math.round(sheet.element().getBoundingClientRect().right)
            )
            .toBe(375)
    })

    it('closes the sheet when a link is followed, not for a group or a new tab', async () => {
        await page.viewport(375, 700)
        await render(<AppNavigation />)
        await trigger().click()
        const sheet = page.getByRole('dialog', { name: 'Navigation' })

        // Stop the new tab itself; the sheet still sees the click.
        const stay = (event: Event) => event.preventDefault()
        window.addEventListener('click', stay, { capture: true })
        sheet
            .getByRole('link', { name: 'Help' })
            .element()
            .dispatchEvent(
                new MouseEvent('click', { bubbles: true, cancelable: true })
            )
        window.removeEventListener('click', stay, { capture: true })
        await expect.element(sheet).toBeVisible()

        await sheet.getByRole('button', { name: 'Reports' }).click()
        await expect.element(sheet).toBeVisible()

        await sheet.getByRole('link', { name: 'Today' }).click()
        await expect.element(sheet).not.toBeInTheDocument()
    })
})
