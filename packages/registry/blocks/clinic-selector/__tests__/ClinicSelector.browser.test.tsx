import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import React from 'react'
import { page, userEvent } from 'vitest/browser'
import { render } from 'vitest-browser-react'
import {
    ClinicProvider,
    ClinicSelector,
    type ClinicProviderProps,
    type ClinicSelectorProps,
} from '..'
import {
    createServer,
    district,
    facility,
    unit,
    type ClinicServer,
} from './clinicServerSupport'

const OCEAN = facility('Ocean Beach Clinic')
const BRISTOL = facility('Bristol Clinic')
const HARBOUR = facility('Harbour Clinic')
const BO = district('Bo District')
const NGELEHUN = unit('Ngelehun CHC', BO.path)

/** The top of an app's navigation: 240px wide expanded, 52px collapsed, with `px-3`. */
const renderSelector = async (
    server: ClinicServer,
    props: ClinicSelectorProps = {},
    width: 'w-60' | 'w-13' = 'w-60',
    provider: Omit<ClinicProviderProps, 'client' | 'children'> = {}
) => {
    // Delays off so the block's own retries finish quickly.
    const queryClient = new QueryClient({
        defaultOptions: { queries: { retryDelay: 0 } },
    })
    return render(
        <QueryClientProvider client={queryClient}>
            <ClinicProvider client={server.client} {...provider}>
                <div
                    data-testid="header"
                    className={`${width} bg-dhis2-background px-3 py-4 text-dhis2-foreground`}
                >
                    <ClinicSelector {...props} />
                </div>
            </ClinicProvider>
        </QueryClientProvider>
    )
}

const atDesktopWidth = async () => {
    await page.viewport(1280, 720)
    onTestFinished(() => page.viewport(414, 896))
}

const searchBox = () => page.getByPlaceholder('Search clinics')
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

describe('ClinicSelector', () => {
    it('one clinic renders no button', async () => {
        const screen = await renderSelector(
            createServer({ assigned: [BRISTOL] })
        )

        await expect.element(screen.getByText('Bristol Clinic')).toBeVisible()
        expect(screen.getByRole('button').elements()).toHaveLength(0)
        expect(screen.getByRole('combobox').elements()).toHaveLength(0)
    })

    it('three clinics open a menu without search', async () => {
        const screen = await renderSelector(
            createServer({ assigned: [OCEAN, BRISTOL, HARBOUR] })
        )

        await screen
            .getByRole('button', { name: 'Clinic: Bristol Clinic' })
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

    it('picking a clinic switches', async () => {
        const screen = await renderSelector(
            createServer({ assigned: [OCEAN, BRISTOL, HARBOUR] })
        )

        await screen
            .getByRole('button', { name: 'Clinic: Bristol Clinic' })
            .click()
        await page
            .getByRole('menuitemradio', { name: 'Ocean Beach Clinic' })
            .click()

        await expect
            .element(
                screen.getByRole('button', {
                    name: 'Clinic: Ocean Beach Clinic',
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
            .getByRole('combobox', { name: 'Clinic: Bo District' })
            .click()
        await expect.element(searchBox()).toBeVisible()
        await expect
            .element(page.getByRole('option', { name: 'Bo District' }))
            .toHaveAttribute('aria-selected', 'true')

        await searchBox().fill('ngel')
        await page.getByRole('option', { name: 'Ngelehun CHC' }).click()
        await expect
            .element(
                screen.getByRole('combobox', { name: 'Clinic: Ngelehun CHC' })
            )
            .toBeVisible()

        await screen
            .getByRole('combobox', { name: 'Clinic: Ngelehun CHC' })
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

    it('browses every clinic a page at a time, from the keyboard', async () => {
        const all = Array.from({ length: 21 }, (_, i) =>
            unit(`Unit${String(i).padStart(2, '0')}`, BO.path)
        )
        const screen = await renderSelector(
            createServer({ assigned: [BO], all })
        )
        await screen
            .getByRole('combobox', { name: 'Clinic: Bo District' })
            .click()
        const rows = () =>
            page
                .getByRole('group', { name: 'All clinics' })
                .getByRole('option')
                .elements()
        await expect.poll(() => rows()).toHaveLength(20)

        // The district is highlighted on opening; past the twenty clinics is the row that loads the next page.
        await userEvent.keyboard('{ArrowDown>21/}{Enter}')

        await expect.poll(() => rows()).toHaveLength(21)
        await expect.element(searchBox()).toBeVisible()
        expect(
            page.getByRole('option', { name: 'Show more' }).elements()
        ).toHaveLength(0)
    })

    it('says when nothing matches', async () => {
        const screen = await renderSelector(createServer({ assigned: [BO] }))

        await screen
            .getByRole('combobox', { name: 'Clinic: Bo District' })
            .click()
        await searchBox().fill('zzz')

        await expect.element(page.getByText('No clinics found')).toBeVisible()
    })

    it('search failure keeps the list usable', async () => {
        const server = createServer({ assigned: [BO] })
        server.fail.search = 400
        const screen = await renderSelector(server)

        await screen
            .getByRole('combobox', { name: 'Clinic: Bo District' })
            .click()
        await searchBox().fill('ngel')
        await expect
            .element(page.getByText('Clinics could not be loaded'))
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

    it('shows no heading with only assigned clinics', async () => {
        const screen = await renderSelector(
            createServer({ assigned: [BO, OCEAN] })
        )

        await screen
            .getByRole('combobox', { name: 'Clinic: Bo District' })
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
            .getByRole('combobox', { name: 'Clinic: Bo District' })
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
                .getByRole('button', { name: 'Clinic: Bristol Clinic' })
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
                .getByRole('combobox', { name: 'Clinic: Bo District' })
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

    it('shows Choose a clinic when the controlled value is out of scope', async () => {
        const onValueChange = vi.fn()
        const screen = await renderSelector(
            createServer({ assigned: [OCEAN, BRISTOL, HARBOUR] }),
            {},
            'w-60',
            { value: unit('Xclinic').id, onValueChange }
        )

        await screen
            .getByRole('button', { name: 'Clinic: Choose a clinic' })
            .click()
        await page
            .getByRole('menuitemradio', { name: 'Ocean Beach Clinic' })
            .click()

        expect(onValueChange).toHaveBeenCalledWith(OCEAN)
    })

    it('names the trigger with the clinic name as written', async () => {
        const screen = await renderSelector(
            createServer({
                assigned: [
                    facility('Smith & Sons <CHC>'),
                    facility('Zeta Clinic'),
                ],
            })
        )

        await expect
            .element(screen.getByRole('button', { name: /^Clinic: S/ }))
            .toHaveAccessibleName('Clinic: Smith & Sons <CHC>')
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
                name: `Clinic: ${name}`,
            })
            await expect.element(trigger).toBeVisible()
            await expect.element(screen.getByText(name)).not.toBeVisible()
            expect(trigger.element().getBoundingClientRect().width).toBe(24)
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
            .element(screen.getByRole('button', { name: 'Clinic: Bristol' }))
            .toBeVisible()
        await expect.element(screen.getByText('Bristol')).toBeVisible()
    })

    it('truncates a long name', async () => {
        const long = 'Ocean Beach Community Health Centre and Maternity Unit '
            .repeat(3)
            .slice(0, 120)
        const screen = await renderSelector(
            createServer({ assigned: [facility(long), BRISTOL] })
        )

        await screen
            .getByRole('button', { name: 'Clinic: Bristol Clinic' })
            .click()
        await page.getByRole('menuitemradio', { name: long }).click()
        const name = screen.getByText(long, { exact: true })
        await expect.element(name).toBeVisible()

        const header = screen.getByTestId('header').element()
        expect(header.getBoundingClientRect().width).toBe(240)
        expect(name.element().scrollWidth).toBeGreaterThan(
            name.element().clientWidth
        )
        expect(name.element().getAttribute('title')).toBe(long)
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
            .element(screen.getByText('Clinics could not be loaded'))
            .toBeVisible()
        server.fail.me = undefined
        await screen.getByRole('button', { name: 'Retry' }).click()

        await expect
            .element(screen.getByRole('button', { name: 'Clinic: Bristol' }))
            .toBeVisible()
    })

    it('none shows that no clinic is assigned', async () => {
        const screen = await renderSelector(createServer({ assigned: [] }))

        await expect
            .element(screen.getByText('No clinic assigned'))
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
            .toBe('Clinics could not be loaded')

        server.fail.me = undefined
        await retry.click()
        await expect
            .element(screen.getByRole('button', { name: 'Clinic: Bristol' }))
            .toBeInTheDocument()
    })

    it('collapsed none shows a placeholder tile', async () => {
        await atDesktopWidth()
        const screen = await renderSelector(
            createServer({ assigned: [] }),
            { collapsed: true },
            'w-13'
        )

        const tile = screen.getByRole('img', { name: 'No clinic assigned' })
        await expect.element(tile).toBeVisible()
        expect(tile.element().getBoundingClientRect().width).toBe(24)
        await tile.hover()
        await expect
            .poll(tooltipText, { timeout: 2000 })
            .toBe('No clinic assigned')
    })

    it('collapsed single clinic shows the tile with its name', async () => {
        await atDesktopWidth()
        const screen = await renderSelector(
            createServer({ assigned: [BRISTOL] }),
            { collapsed: true },
            'w-13'
        )

        const row = screen.getByText('Bristol Clinic')
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
            name: 'Clinic: Bristol Clinic',
        })
        await expect.element(trigger).toBeVisible()
        trigger.element().focus()

        await userEvent.keyboard('{Enter}')
        await expect.element(page.getByRole('menu')).toBeVisible()
        await userEvent.keyboard('{ArrowDown}')
        await userEvent.keyboard('{Enter}')
        await expect
            .element(
                screen.getByRole('button', { name: 'Clinic: Harbour Clinic' })
            )
            .toBeVisible()

        await userEvent.keyboard('{Enter}')
        await expect.element(page.getByRole('menu')).toBeVisible()
        await userEvent.keyboard('{Escape}')
        await expect.element(page.getByRole('menu')).not.toBeInTheDocument()
        expect(document.activeElement).toBe(
            screen
                .getByRole('button', { name: 'Clinic: Harbour Clinic' })
                .element()
        )
    })

    it('keyboard: search', async () => {
        const screen = await renderSelector(
            createServer({ assigned: [BO, OCEAN] })
        )
        const trigger = screen.getByRole('combobox', {
            name: 'Clinic: Bo District',
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
                    name: 'Clinic: Ocean Beach Clinic',
                })
            )
            .toBeVisible()

        await userEvent.keyboard('{Enter}')
        await expect.element(searchBox()).toHaveFocus()
        await userEvent.keyboard('{Escape}')
        await expect.element(searchBox()).not.toBeInTheDocument()
        expect(document.activeElement).toBe(
            screen
                .getByRole('combobox', { name: 'Clinic: Ocean Beach Clinic' })
                .element()
        )
    })
})
