import React, { useState } from 'react'
import { page } from 'vitest/browser'
import { render } from 'vitest-browser-react'
import {
    ContextDisplayItem,
    ContextOrganisationUnitSelector,
    ContextProgramSelector,
    ContextSelector,
    ContextStageSelector,
} from '../index'
import type { ContextOption } from '../types'

const programs: ContextOption[] = Array.from({ length: 11 }, (_, index) => ({
    value: `program-${index + 1}`,
    label:
        index === 10 ? 'Tuberculosis program' : `Malaria program ${index + 1}`,
}))

describe('ContextSelector', () => {
    it('owns Capture sticky toolbar semantics and delegates clear-all', async () => {
        const onClear = vi.fn()
        const screen = await render(
            <ContextSelector
                ariaLabel="Registration context"
                clearAction={{ onClick: onClear }}
            >
                <ContextDisplayItem label="Program" value="Malaria" />
            </ContextSelector>
        )

        const navigation = screen.getByRole('navigation', {
            name: 'Registration context',
        })
        await expect.element(navigation).toBeVisible()
        await expect
            .element(
                screen.getByRole('toolbar', { name: 'Registration context' })
            )
            .toBeVisible()
        expect(navigation.element().className).toContain('sticky')
        expect(navigation.element().className).toContain('top-0')
        expect(navigation.element().className).toContain('z-[1000]')
        expect(navigation.element().className).toContain('w-full')
        const navigationStyle = getComputedStyle(navigation.element())
        const toolbar = screen
            .getByRole('toolbar', {
                name: 'Registration context',
            })
            .element()
        const controls = toolbar.querySelector<HTMLElement>('.controls')
        const selectorItem =
            screen.container.querySelector<HTMLElement>('.selector-bar-item')
        expect(navigationStyle.position).toBe('sticky')
        expect(navigationStyle.top).toBe('0px')
        expect(navigationStyle.zIndex).toBe('1000')
        expect(navigationStyle.width).toBe(`${window.innerWidth}px`)
        expect(getComputedStyle(toolbar).backgroundColor).toBe(
            'rgb(255, 255, 255)'
        )
        expect(getComputedStyle(toolbar).boxShadow).toBe(
            'rgb(213, 221, 229) 0px -1px 0px 0px inset'
        )
        expect(getComputedStyle(toolbar).paddingBottom).toBe('1px')
        expect(getComputedStyle(controls!).display).toBe('flex')
        expect(getComputedStyle(controls!).flexWrap).toBe('wrap')
        expect(getComputedStyle(controls!).gap).toBe('1px')
        expect(getComputedStyle(selectorItem!).height).toBe('40px')
        expect(getComputedStyle(selectorItem!).fontSize).toBe('14px')
        expect(getComputedStyle(selectorItem!).lineHeight).toBe('16px')
        expect(getComputedStyle(selectorItem!).paddingInlineStart).toBe('8px')
        expect(getComputedStyle(selectorItem!).paddingInlineEnd).toBe('12px')
        expect(getComputedStyle(selectorItem!).borderWidth).toBe('0px')
        expect(getComputedStyle(selectorItem!).boxShadow).toBe(
            'rgb(213, 221, 229) 0px 0px 0px 1px'
        )

        await screen.getByRole('button', { name: 'Clear selections' }).click()
        expect(onClear).toHaveBeenCalledOnce()
    })

    it('omits clear-all when the host does not provide an action', async () => {
        const screen = await render(
            <ContextSelector>
                <ContextDisplayItem label="Program" value="Malaria" />
            </ContextSelector>
        )

        expect(screen.container.textContent).not.toContain('Clear selections')
    })

    it('filters more than ten options and emits controlled selection intent', async () => {
        const onOpenChange = vi.fn()
        const onSelect = vi.fn()
        await render(
            <ContextSelector>
                <ContextProgramSelector
                    options={programs}
                    control={{
                        mode: 'interactive',
                        open: true,
                        onOpenChange,
                        onSelect,
                    }}
                />
            </ContextSelector>
        )

        const input = page.getByPlaceholder('Search for a program')
        await expect.element(input).toBeVisible()
        expect(
            document.querySelector('[data-test="program-filterinput"]')
        ).not.toBeNull()
        await input.fill('tuberculosis')
        await expect
            .element(page.getByText('Tuberculosis program'))
            .toBeVisible()
        expect(page.getByText('Malaria program 1').query()).toBeNull()

        await page.getByText('Tuberculosis program').click()
        expect(onSelect).toHaveBeenCalledWith('program-11')
        expect(onOpenChange).toHaveBeenCalledWith(false)
    })

    it('resets the Capture program filter whenever the controlled popup closes', async () => {
        const Harness = () => {
            const [open, setOpen] = useState(true)
            return (
                <>
                    <button type="button" onClick={() => setOpen(false)}>
                        Close popup
                    </button>
                    <button type="button" onClick={() => setOpen(true)}>
                        Open popup
                    </button>
                    <ContextSelector>
                        <ContextProgramSelector
                            options={programs}
                            control={{
                                mode: 'interactive',
                                open,
                                onOpenChange: setOpen,
                                onSelect: () => undefined,
                            }}
                        />
                    </ContextSelector>
                </>
            )
        }
        await render(<Harness />)

        const input = page.getByPlaceholder('Search for a program')
        await input.fill('tuberculosis')
        const backdrop = document.querySelector<HTMLElement>('.backdrop')
        expect(backdrop).not.toBeNull()
        backdrop?.click()
        await page.getByRole('button', { name: /Program/ }).click()
        await expect.element(input).toHaveValue('')
    })

    it('keeps Program as a direct SelectorBar child for arrow-key focus', async () => {
        const screen = await render(
            <ContextSelector>
                <ContextProgramSelector
                    options={programs.slice(0, 2)}
                    control={{
                        mode: 'interactive',
                        open: false,
                        onOpenChange: () => undefined,
                        onSelect: () => undefined,
                    }}
                />
            </ContextSelector>
        )

        const controls = screen.container.querySelector('.controls')
        const program = screen.container.querySelector(
            '[data-test="program-selector-container"]'
        )
        expect(controls?.firstElementChild).toBe(program)
    })

    it('renders Capture icon and menu filter geometry from computed styles', async () => {
        await render(
            <ContextSelector>
                <ContextProgramSelector
                    options={programs.map((program, index) =>
                        index === 0
                            ? {
                                  ...program,
                                  icon: {
                                      source: '/icon.svg',
                                      color: '#0f6cbd',
                                      alternativeText: 'Malaria icon',
                                  },
                              }
                            : program
                    )}
                    selectedValue="program-1"
                    control={{
                        mode: 'interactive',
                        open: true,
                        onOpenChange: () => undefined,
                        onSelect: () => undefined,
                    }}
                />
            </ContextSelector>
        )

        const icon = document.querySelector<HTMLDivElement>(
            '[data-test="program-selector-container"] [title="Malaria icon"]'
        )
        const menu = page.getByRole('menu').element().parentElement
        const filter = page.getByPlaceholder('Search for a program').element()
        expect(icon).not.toBeNull()
        expect(getComputedStyle(icon!).width).toBe('22px')
        expect(getComputedStyle(icon!).height).toBe('22px')
        expect(getComputedStyle(icon!).borderRadius).toBe('2px')
        expect(parseFloat(getComputedStyle(menu!).maxHeight)).toBeCloseTo(
            window.innerHeight * 0.8,
            1
        )
        expect(getComputedStyle(menu!).paddingBottom).toBe('4px')
        const filterContainer = filter.closest('.sticky\\!')
        expect(getComputedStyle(filterContainer!).position).toBe('sticky')
        expect(getComputedStyle(filterContainer!).paddingTop).toBe('8px')
        expect(getComputedStyle(filterContainer!).paddingRight).toBe('8px')
        expect(getComputedStyle(filterContainer!).paddingBottom).toBe('4px')
        expect(getComputedStyle(filterContainer!).paddingLeft).toBe('8px')
    })

    it('keeps display-only values clearable without opening a menu', async () => {
        const onClear = vi.fn()
        const screen = await render(
            <ContextSelector>
                <ContextProgramSelector
                    options={programs}
                    selectedValue="program-1"
                    control={{ mode: 'display', onClear }}
                />
            </ContextSelector>
        )

        const item = screen.container.querySelector(
            '[data-test="program-selector-container"]'
        )
        expect(item?.className).not.toContain('openable')
        const clear = screen.container.querySelector<HTMLElement>(
            '[data-test="program-selector-container-clear-icon"]'
        )
        expect(clear).not.toBeNull()
        clear?.click()
        expect(onClear).toHaveBeenCalledOnce()
        expect(page.getByRole('menu').query()).toBeNull()
    })

    it('matches Capture disabled and loading selector states', async () => {
        const screen = await render(
            <ContextSelector>
                <ContextProgramSelector
                    options={programs}
                    control={{ mode: 'disabled' }}
                />
                <ContextStageSelector
                    options={programs}
                    control={{
                        mode: 'loading',
                        loadingLabel: 'Loading stages',
                    }}
                />
            </ContextSelector>
        )

        const disabled = screen.container.querySelector<HTMLButtonElement>(
            '[data-test="program-selector-container"]'
        )
        const loading = screen.getByLabelText('Loading stages').element()
        expect(disabled?.disabled).toBe(true)
        expect(getComputedStyle(disabled!).height).toBe('40px')
        expect(getComputedStyle(disabled!).cursor).toBe('not-allowed')
        expect(getComputedStyle(loading).display).toBe('flex')
        expect(getComputedStyle(loading).alignItems).toBe('center')
        expect(getComputedStyle(loading).justifyContent).toBe('center')
    })

    it('keeps locked selector menus unpadded and shows Capture read-only OU text', async () => {
        await render(
            <ContextSelector>
                <ContextStageSelector
                    options={programs}
                    control={{
                        mode: 'interactive',
                        open: true,
                        onOpenChange: () => undefined,
                        onSelect: () => undefined,
                    }}
                />
                <ContextOrganisationUnitSelector
                    control={{ mode: 'display' }}
                />
            </ContextSelector>
        )

        const menuShell = page.getByRole('menu').element().parentElement
        expect(getComputedStyle(menuShell!).paddingBottom).toBe('0px')
        await expect.element(page.getByText('None selected')).toBeVisible()
    })

    it('provides the Capture organisation-unit popup geometry to host children', async () => {
        await render(
            <ContextSelector>
                <ContextOrganisationUnitSelector
                    control={{
                        mode: 'interactive',
                        open: true,
                        onOpenChange: () => undefined,
                    }}
                >
                    <div data-testid="host-picker">Host tree</div>
                </ContextOrganisationUnitSelector>
            </ContextSelector>
        )

        const picker = page.getByTestId('host-picker')
        await expect.element(picker).toBeVisible()
        const shell = picker.element().parentElement
        expect(shell?.className).toContain('min-w-[640px]')
        expect(shell?.className).toContain('min-h-[96px]')
        expect(shell?.className).toContain('max-h-[80vh]')
        expect(shell?.className).toContain('overflow-auto')
        const style = getComputedStyle(shell!)
        expect(style.minWidth).toBe('640px')
        expect(style.minHeight).toBe('96px')
        expect(parseFloat(style.maxHeight)).toBeCloseTo(
            window.innerHeight * 0.8,
            1
        )
        expect(style.overflow).toBe('auto')
    })
})
