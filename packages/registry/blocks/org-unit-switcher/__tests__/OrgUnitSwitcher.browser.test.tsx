import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import React from 'react'
import { page, userEvent } from 'vitest/browser'
import { render } from 'vitest-browser-react'
import {
    OrgUnitProvider,
    OrgUnitSwitcher,
    type OrgUnitProviderProps,
    type OrgUnitSwitcherProps,
} from '..'
import {
    createServer,
    district,
    facility,
    unit,
    type OrgUnitServer,
} from './orgUnitServerSupport'

const OCEAN = facility('Ocean Beach Clinic')
const BRISTOL = facility('Bristol Clinic')
const HARBOUR = facility('Harbour Clinic')
const BO = district('Bo District')
const NGELEHUN = unit('Ngelehun CHC', BO.path)

/** The top of an app's navigation: 240px wide expanded, 52px collapsed, with `px-3`. */
const renderSelector = async (
    server: OrgUnitServer,
    props: OrgUnitSwitcherProps = {},
    width: 'w-60' | 'w-13' = 'w-60',
    provider: Omit<OrgUnitProviderProps, 'client' | 'children'> = {}
) => {
    // Delays off so the block's own retries finish quickly.
    const queryClient = new QueryClient({
        defaultOptions: { queries: { retryDelay: 0 } },
    })
    return render(
        <QueryClientProvider client={queryClient}>
            <OrgUnitProvider client={server.client} {...provider}>
                <div
                    data-testid="header"
                    className={`${width} bg-dhis2-background px-3 py-4 text-dhis2-foreground`}
                >
                    <OrgUnitSwitcher {...props} />
                </div>
            </OrgUnitProvider>
        </QueryClientProvider>
    )
}

const atDesktopWidth = async () => {
    await page.viewport(1280, 720)
    onTestFinished(() => page.viewport(414, 896))
}

const searchBox = () => page.getByPlaceholder('Search organisation units')
const TILE = '.size-6'

const tooltipText = () =>
    document.querySelector('[data-slot="tooltip-content"]')?.textContent

/** The current row's background, its check's inset from the row's inline end, and whether the check overlaps the tile. */
const currentRowLook = (row: Element) => {
    const rowBox = row.getBoundingClientRect()
    const checkBox = [...row.querySelectorAll('svg')]
        .at(-1)
        ?.getBoundingClientRect()
    const tileBox = row.querySelector(TILE)?.getBoundingClientRect()
    if (!checkBox || !tileBox) {
        throw new Error('The row has no check or no tile')
    }
    const rtl = getComputedStyle(row).direction === 'rtl'
    return {
        background: getComputedStyle(row).backgroundColor,
        inset: rtl
            ? checkBox.left - rowBox.left
            : rowBox.right - checkBox.right,
        overlapsTile:
            checkBox.left < tileBox.right && tileBox.left < checkBox.right,
    }
}

afterEach(() => {
    localStorage.clear()
})

describe('OrgUnitSwitcher', () => {
    it('one unit renders no button', async () => {
        const screen = await renderSelector(
            createServer({ assigned: [BRISTOL] })
        )

        await expect
            .element(screen.getByText('Bristol Clinic', { exact: true }))
            .toBeVisible()
        expect(screen.getByRole('button').elements()).toHaveLength(0)
        expect(screen.getByRole('combobox').elements()).toHaveLength(0)
    })

    it('three units open a menu without search', async () => {
        const screen = await renderSelector(
            createServer({ assigned: [OCEAN, BRISTOL, HARBOUR] })
        )

        await screen
            .getByRole('button', { name: 'Organisation unit: Bristol Clinic' })
            .click()

        await expect
            .poll(() => page.getByRole('menuitemradio').elements())
            .toHaveLength(3)
        await expect
            .element(
                page.getByRole('menuitemradio', { name: 'Bristol Clinic' })
            )
            .toHaveAttribute('aria-checked', 'true')
        expect(page.getByRole('textbox').elements()).toHaveLength(0)
        expect(page.getByText('Assigned').elements()).toHaveLength(0)
        expect(page.getByText('Recent').elements()).toHaveLength(0)
    })

    it('picking a unit switches', async () => {
        const screen = await renderSelector(
            createServer({ assigned: [OCEAN, BRISTOL, HARBOUR] })
        )

        await screen
            .getByRole('button', { name: 'Organisation unit: Bristol Clinic' })
            .click()
        await page
            .getByRole('menuitemradio', { name: 'Ocean Beach Clinic' })
            .click()

        await expect
            .element(
                screen.getByRole('button', {
                    name: 'Organisation unit: Ocean Beach Clinic',
                })
            )
            .toBeVisible()
        await expect.element(page.getByRole('menu')).not.toBeInTheDocument()
    })

    it('a unit with children shows search', async () => {
        const screen = await renderSelector(
            createServer({ assigned: [BO], found: [NGELEHUN] })
        )

        await screen
            .getByRole('combobox', { name: 'Organisation unit: Bo District' })
            .click()
        await expect.element(searchBox()).toBeVisible()
        await expect
            .element(page.getByRole('option', { name: 'Bo District' }))
            .toHaveAttribute('aria-selected', 'true')

        await searchBox().fill('ngel')
        await page.getByRole('option', { name: 'Ngelehun CHC' }).click()
        await expect
            .element(
                screen.getByRole('combobox', {
                    name: 'Organisation unit: Ngelehun CHC',
                })
            )
            .toBeVisible()

        await screen
            .getByRole('combobox', { name: 'Organisation unit: Ngelehun CHC' })
            .click()
        await expect
            .element(
                page
                    .getByRole('group', { name: 'Recent' })
                    .getByRole('option', { name: 'Ngelehun CHC' })
            )
            .toBeVisible()
        await expect
            .element(
                page
                    .getByRole('group', { name: 'Assigned' })
                    .getByRole('option', { name: 'Bo District' })
            )
            .toBeVisible()
    })

    it('says when nothing matches', async () => {
        const screen = await renderSelector(createServer({ assigned: [BO] }))

        await screen
            .getByRole('combobox', { name: 'Organisation unit: Bo District' })
            .click()
        await searchBox().fill('zzz')

        await expect
            .element(page.getByText('No organisation units found'))
            .toBeVisible()
    })

    it('search failure keeps the list usable', async () => {
        const server = createServer({ assigned: [BO] })
        server.fail.search = 400
        const screen = await renderSelector(server)

        await screen
            .getByRole('combobox', { name: 'Organisation unit: Bo District' })
            .click()
        await searchBox().fill('ngel')
        await expect
            .element(page.getByText('Organisation units could not be loaded'))
            .toBeVisible()
        await expect
            .element(page.getByRole('button', { name: 'Retry' }))
            .toBeVisible()

        await searchBox().clear()
        await expect
            .element(page.getByRole('option', { name: 'Bo District' }))
            .toBeVisible()
        expect(page.getByText('Assigned').elements()).toHaveLength(0)
    })

    it('shows no heading with only assigned units', async () => {
        const screen = await renderSelector(
            createServer({ assigned: [BO, OCEAN] })
        )

        await screen
            .getByRole('combobox', { name: 'Organisation unit: Bo District' })
            .click()

        await expect
            .poll(() => page.getByRole('option').elements())
            .toHaveLength(2)
        expect(page.getByText('Recent').elements()).toHaveLength(0)
        expect(page.getByText('Assigned').elements()).toHaveLength(0)
    })

    it('shows a pending indicator while searching', async () => {
        const server = createServer({ assigned: [BO], found: [NGELEHUN] })
        server.holdSearch()
        onTestFinished(() => server.releaseSearch())
        const screen = await renderSelector(server)

        await screen
            .getByRole('combobox', { name: 'Organisation unit: Bo District' })
            .click()
        await searchBox().fill('ngel')
        await expect.poll(() => server.searchRequests()).toHaveLength(1)

        await expect
            .element(page.getByRole('status', { name: 'Loading' }))
            .toBeVisible()
        expect(page.getByRole('option').elements()).toHaveLength(0)

        server.releaseSearch()
        await expect
            .element(page.getByRole('option', { name: 'Ngelehun CHC' }))
            .toBeVisible()
        expect(
            page.getByRole('status', { name: 'Loading' }).elements()
        ).toHaveLength(0)
    })

    it.each(['ltr', 'rtl'] as const)(
        'marks the current row the same way in both forms, %s',
        async (dir) => {
            // The menus portal to the body, so the direction goes on the document, as an RTL app sets it.
            document.documentElement.dir = dir
            onTestFinished(() =>
                document.documentElement.removeAttribute('dir')
            )
            const menu = await renderSelector(
                createServer({ assigned: [OCEAN, BRISTOL, HARBOUR] })
            )
            await menu
                .getByRole('button', {
                    name: 'Organisation unit: Bristol Clinic',
                })
                .click()
            const radio = page.getByRole('menuitemradio', {
                name: 'Bristol Clinic',
            })
            await expect.element(radio).toHaveAttribute('aria-checked', 'true')
            // Another row takes the highlight, so only the current-row styling is compared.
            await page
                .getByRole('menuitemradio', { name: 'Ocean Beach Clinic' })
                .hover()
            const menuLook = currentRowLook(radio.element())
            await userEvent.keyboard('{Escape}')
            await menu.unmount()

            const search = await renderSelector(
                createServer({ assigned: [BO, OCEAN] })
            )
            await search
                .getByRole('combobox', {
                    name: 'Organisation unit: Bo District',
                })
                .click()
            const option = page.getByRole('option', { name: 'Bo District' })
            await expect
                .element(option)
                .toHaveAttribute('aria-selected', 'true')
            await page
                .getByRole('option', { name: 'Ocean Beach Clinic' })
                .hover()
            const searchLook = currentRowLook(option.element())

            expect(searchLook.background).toBe(menuLook.background)
            expect(menuLook.inset).toBeGreaterThanOrEqual(0)
            expect(menuLook.inset).toBeLessThan(24)
            expect(
                Math.abs(searchLook.inset - menuLook.inset)
            ).toBeLessThanOrEqual(1)
            expect(menuLook.overlapsTile).toBe(false)
            expect(searchLook.overlapsTile).toBe(false)
        }
    )

    it('shows Choose an organisation unit when the controlled value is out of scope', async () => {
        const onValueChange = vi.fn()
        const screen = await renderSelector(
            createServer({ assigned: [OCEAN, BRISTOL, HARBOUR] }),
            {},
            'w-60',
            { value: unit('Xclinic').id, onValueChange }
        )

        await screen
            .getByRole('button', {
                name: 'Organisation unit: Choose an organisation unit',
            })
            .click()
        await page
            .getByRole('menuitemradio', { name: 'Ocean Beach Clinic' })
            .click()

        expect(onValueChange).toHaveBeenCalledWith(OCEAN)
    })

    it('names the trigger with the unit name as written', async () => {
        const screen = await renderSelector(
            createServer({
                assigned: [
                    facility('Smith & Sons <CHC>'),
                    facility('Zeta Clinic'),
                ],
            })
        )

        await expect
            .element(
                screen.getByRole('button', { name: /^Organisation unit: S/ })
            )
            .toHaveAccessibleName('Organisation unit: Smith & Sons <CHC>')
    })

    it.each([
        ['button', [OCEAN, BRISTOL, HARBOUR], 'Bristol Clinic'],
        ['combobox', [BO], 'Bo District'],
    ] as const)(
        'collapsed shows the tile with its name (%s)',
        async (role, assigned, name) => {
            await atDesktopWidth()
            const screen = await renderSelector(
                createServer({ assigned: [...assigned] }),
                { collapsed: true },
                'w-13'
            )

            const trigger = screen.getByRole(role, {
                name: `Organisation unit: ${name}`,
            })
            await expect.element(trigger).toBeVisible()
            await expect.element(screen.getByText(name)).not.toBeVisible()
            // The tile sits in the middle of the column, in line with the navigation's icons.
            const column = screen
                .getByTestId('header')
                .element()
                .getBoundingClientRect()
            const tile = trigger
                .element()
                .querySelector(TILE)
                ?.getBoundingClientRect()
            expect(tile?.width).toBe(24)
            expect(tile && tile.left + tile.width / 2).toBe(
                column.left + column.width / 2
            )
            await trigger.hover()
            await expect.poll(tooltipText, { timeout: 2000 }).toBe(name)

            await trigger.click()
            await expect
                .poll(
                    () =>
                        document
                            .querySelector(
                                '[data-slot="dropdown-menu-content"], [data-slot="combobox-content"]'
                            )
                            ?.getBoundingClientRect().width
                )
                .toBe(360)
        }
    )

    it('collapsed below md shows the full trigger', async () => {
        await page.viewport(414, 896)
        const screen = await renderSelector(createServer(), { collapsed: true })

        await expect
            .element(
                screen.getByRole('button', {
                    name: 'Organisation unit: Bristol',
                })
            )
            .toBeVisible()
        await expect.element(screen.getByText('Bristol')).toBeVisible()
    })

    it('pending shows a skeleton and no button', async () => {
        const server = createServer()
        server.holdMe()
        onTestFinished(() => server.releaseMe())
        const screen = await renderSelector(server)

        expect(
            screen.container.querySelector('[data-slot="skeleton"]')
        ).not.toBeNull()
        expect(
            screen.container.querySelector('[aria-busy="true"]')
        ).not.toBeNull()
        expect(screen.getByText('Loading').element()).toBeTruthy()
        expect(screen.getByRole('button').elements()).toHaveLength(0)
    })

    it('failed shows the message and Retry retries', async () => {
        const server = createServer()
        server.fail.me = 400
        const screen = await renderSelector(server)

        await expect
            .element(screen.getByText('Organisation units could not be loaded'))
            .toBeVisible()
        server.fail.me = undefined
        await screen.getByRole('button', { name: 'Retry' }).click()

        await expect
            .element(
                screen.getByRole('button', {
                    name: 'Organisation unit: Bristol',
                })
            )
            .toBeVisible()
    })

    it('none shows that no unit is assigned', async () => {
        const screen = await renderSelector(createServer({ assigned: [] }))

        await expect
            .element(screen.getByText('No organisation unit assigned'))
            .toBeVisible()
    })

    it('collapsed failed state keeps Retry reachable', async () => {
        await atDesktopWidth()
        const server = createServer()
        server.fail.me = 400
        const screen = await renderSelector(server, { collapsed: true }, 'w-13')

        const retry = screen.getByRole('button', { name: 'Retry' })
        await expect.element(retry).toBeVisible()
        expect(retry.elements()).toHaveLength(1)
        expect(retry.element().getBoundingClientRect().width).toBe(24)
        await retry.hover()
        await expect
            .poll(tooltipText, { timeout: 2000 })
            .toBe('Organisation units could not be loaded')

        server.fail.me = undefined
        await retry.click()
        await expect
            .element(
                screen.getByRole('button', {
                    name: 'Organisation unit: Bristol',
                })
            )
            .toBeInTheDocument()
    })

    it('collapsed none shows a placeholder tile', async () => {
        await atDesktopWidth()
        const screen = await renderSelector(
            createServer({ assigned: [] }),
            { collapsed: true },
            'w-13'
        )

        const tile = screen.getByRole('img', {
            name: 'No organisation unit assigned',
        })
        await expect.element(tile).toBeVisible()
        expect(tile.element().getBoundingClientRect().width).toBe(24)
        await tile.hover()
        await expect
            .poll(tooltipText, { timeout: 2000 })
            .toBe('No organisation unit assigned')
    })

    it('collapsed single unit shows the tile with its name', async () => {
        await atDesktopWidth()
        const screen = await renderSelector(
            createServer({ assigned: [BRISTOL] }),
            { collapsed: true },
            'w-13'
        )

        const row = screen.getByText('Bristol Clinic', { exact: true })
        await expect.element(row).toBeInTheDocument()
        const tile = screen.getByTestId('header').element().querySelector(TILE)
        if (!tile) {
            throw new Error('The selector rendered nothing')
        }
        expect(tile.getBoundingClientRect().width).toBe(24)
        await userEvent.hover(tile)
        await expect.poll(tooltipText, { timeout: 2000 }).toBe('Bristol Clinic')
    })

    it('keyboard: menu', async () => {
        const screen = await renderSelector(
            createServer({ assigned: [OCEAN, BRISTOL, HARBOUR] })
        )
        const trigger = screen.getByRole('button', {
            name: 'Organisation unit: Bristol Clinic',
        })
        await expect.element(trigger).toBeVisible()
        trigger.element().focus()

        await userEvent.keyboard('{Enter}')
        await expect.element(page.getByRole('menu')).toBeVisible()
        await userEvent.keyboard('{ArrowDown}')
        await userEvent.keyboard('{Enter}')
        await expect
            .element(
                screen.getByRole('button', {
                    name: 'Organisation unit: Harbour Clinic',
                })
            )
            .toBeVisible()

        await userEvent.keyboard('{Enter}')
        await expect.element(page.getByRole('menu')).toBeVisible()
        await userEvent.keyboard('{Escape}')
        await expect.element(page.getByRole('menu')).not.toBeInTheDocument()
        expect(document.activeElement).toBe(
            screen
                .getByRole('button', {
                    name: 'Organisation unit: Harbour Clinic',
                })
                .element()
        )
    })

    it('keyboard: search', async () => {
        const screen = await renderSelector(
            createServer({ assigned: [BO, OCEAN] })
        )
        const trigger = screen.getByRole('combobox', {
            name: 'Organisation unit: Bo District',
        })
        await expect.element(trigger).toBeVisible()
        trigger.element().focus()

        await userEvent.keyboard('{Enter}')
        await expect.element(searchBox()).toHaveFocus()
        await userEvent.keyboard('{ArrowDown}')
        await userEvent.keyboard('{Enter}')
        await expect
            .element(
                screen.getByRole('combobox', {
                    name: 'Organisation unit: Ocean Beach Clinic',
                })
            )
            .toBeVisible()

        await userEvent.keyboard('{Enter}')
        await expect.element(searchBox()).toHaveFocus()
        await userEvent.keyboard('{Escape}')
        await expect.element(searchBox()).not.toBeInTheDocument()
        expect(document.activeElement).toBe(
            screen
                .getByRole('combobox', {
                    name: 'Organisation unit: Ocean Beach Clinic',
                })
                .element()
        )
    })
})
