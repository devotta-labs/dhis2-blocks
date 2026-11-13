import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import React from 'react'
import { page, userEvent } from 'vitest/browser'
import { render } from 'vitest-browser-react'
import { ClinicProvider, ClinicSelector, type ClinicSelectorProps } from '..'
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

/** The sidebar header: 240px wide expanded, 52px collapsed, with `px-3`. */
const renderSelector = async (
    server: ClinicServer,
    props: ClinicSelectorProps = {},
    width: 'w-60' | 'w-13' = 'w-60'
) => {
    // Delays off so the block's own retries finish quickly.
    const queryClient = new QueryClient({
        defaultOptions: { queries: { retryDelay: 0 } },
    })
    return render(
        <QueryClientProvider client={queryClient}>
            <ClinicProvider client={server.client}>
                <div
                    data-testid="header"
                    className={`${width} bg-dhis2-sidebar px-3 py-4 text-dhis2-sidebar-foreground`}
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

    it('says when more results exist', async () => {
        const screen = await renderSelector(
            createServer({ assigned: [BO], found: [NGELEHUN], total: 40 })
        )

        await screen
            .getByRole('combobox', { name: 'Clinic: Bo District' })
            .click()
        await searchBox().fill('ngel')

        await expect
            .element(page.getByText('Keep typing to narrow the results'))
            .toBeVisible()
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
            .element(
                page
                    .getByRole('group', { name: 'Assigned' })
                    .getByRole('option', { name: 'Bo District' })
            )
            .toBeVisible()
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
            expect(trigger.element().getBoundingClientRect().width).toBe(28)
            await trigger.hover()
            await expect
                .poll(
                    () =>
                        document.querySelector('[data-slot="tooltip-content"]')
                            ?.textContent,
                    { timeout: 2000 }
                )
                .toBe(name)

            await trigger.click()
            const popup = document.querySelector<HTMLElement>(
                '[data-slot="dropdown-menu-content"], [data-slot="combobox-content"]'
            )
            expect(popup?.getBoundingClientRect().width).toBe(240)
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
