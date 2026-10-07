import React, { useState } from 'react'
import { page } from 'vitest/browser'
import { render } from 'vitest-browser-react'
import {
    ClearSelections,
    ContextSelector,
    ContextValue,
    EnrollmentSelector,
    EventSelector,
    OptionSelector,
    OrganisationUnitSelector,
    ProgramSelector,
    StageSelector,
} from '../index'
import type { Option } from '../types'

const programs: Option[] = Array.from({ length: 11 }, (_, index) => ({
    value: `program-${index + 1}`,
    label:
        index === 10 ? 'Tuberculosis program' : `Malaria program ${index + 1}`,
}))

describe('ContextSelector', () => {
    it('owns Capture sticky toolbar semantics and composes clear-all', async () => {
        const onClear = vi.fn()

        const screen = await render(
            <ContextSelector ariaLabel="Registration context">
                <ContextValue label="Program" value="Malaria" />
                <ClearSelections onClear={onClear} />
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
        expect(getComputedStyle(toolbar).width).toBe(
            getComputedStyle(navigation.element()).width
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

        const clearSelections = screen.container.querySelector<HTMLElement>(
            '[data-test="clear-selections"]'
        )

        expect(getComputedStyle(clearSelections!).display).toBe('flex')
        expect(getComputedStyle(clearSelections!).alignItems).toBe('center')
        expect(getComputedStyle(clearSelections!).height).toBe('40px')
        expect(getComputedStyle(clearSelections!).paddingLeft).toBe('8px')
        expect(getComputedStyle(clearSelections!).paddingRight).toBe('8px')

        await screen.getByRole('button', { name: 'Clear selections' }).click()
        expect(onClear).toHaveBeenCalledOnce()
    })

    it('omits clear-all when the host does not compose it', async () => {
        const screen = await render(
            <ContextSelector>
                <ContextValue label="Program" value="Malaria" />
            </ContextSelector>
        )

        expect(screen.container.textContent).not.toContain('Clear selections')
    })

    it('disables the composed clear-all action when requested by the host', async () => {
        const onClear = vi.fn()

        const screen = await render(
            <ContextSelector>
                <ContextValue label="Program" value="Malaria" />
                <ClearSelections onClear={onClear} disabled />
            </ContextSelector>
        )

        const clear = screen.getByRole('button', { name: 'Clear selections' })
        expect(clear.element().hasAttribute('disabled')).toBe(true)
        expect(onClear).not.toHaveBeenCalled()
    })

    it('filters more than ten options and emits controlled selection intent', async () => {
        const onOpenChange = vi.fn()
        const onSelect = vi.fn()
        await render(
            <ContextSelector>
                <ProgramSelector
                    options={programs}
                    open
                    onOpenChange={onOpenChange}
                    onChange={onSelect}
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

    it('resolves a committed option that is excluded from the open menu', async () => {
        const screen = await render(
            <ContextSelector>
                <ProgramSelector
                    options={[
                        {
                            value: 'incompatible',
                            label: 'Incompatible committed program',
                            excludeFromMenu: true,
                        },
                        { value: 'available', label: 'Available program' },
                    ]}
                    value="incompatible"
                    open
                    onOpenChange={() => undefined}
                    onChange={() => undefined}
                    onClear={() => undefined}
                />
            </ContextSelector>
        )

        await expect
            .element(
                screen.getByRole('button', {
                    name: /Program.*Incompatible committed program/,
                })
            )
            .toBeVisible()
        const menu = screen.getByRole('menu').element()
        expect(menu.textContent).toContain('Available program')
        expect(menu.textContent).not.toContain('Incompatible committed program')
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
                        <ProgramSelector
                            options={programs}
                            open={open}
                            onOpenChange={setOpen}
                            onChange={() => undefined}
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

    it('resets the search when the host closes the popup without a selector event', async () => {
        const view = (open: boolean) => (
            <ContextSelector>
                <ProgramSelector
                    options={programs}
                    open={open}
                    onOpenChange={() => undefined}
                />
            </ContextSelector>
        )

        const screen = await render(view(true))
        await page.getByPlaceholder('Search for a program').fill('tuberculosis')
        await screen.rerender(view(false))
        await screen.rerender(view(true))
        await expect
            .element(page.getByPlaceholder('Search for a program'))
            .toHaveValue('')
        await expect
            .element(page.getByRole('menu'))
            .toHaveTextContent('Malaria program 1')
    })

    it('keeps Program as a direct SelectorBar child for arrow-key focus', async () => {
        const screen = await render(
            <ContextSelector>
                <ProgramSelector
                    options={programs.slice(0, 2)}
                    open={false}
                    onOpenChange={() => undefined}
                    onChange={() => undefined}
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
                <ProgramSelector
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
                    value="program-1"
                    open
                    onOpenChange={() => undefined}
                    onChange={() => undefined}
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
        const filterContainer = filter.closest('.sticky')
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
                <ProgramSelector
                    options={programs}
                    value="program-1"
                    readOnly
                    onClear={onClear}
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

    it('keeps Capture program placeholder copy in an empty read-only state', async () => {
        await render(
            <ContextSelector>
                <ProgramSelector options={programs} readOnly />
            </ContextSelector>
        )

        await expect.element(page.getByText('Choose a program')).toBeVisible()
    })

    it('matches Capture disabled and loading selector states', async () => {
        const screen = await render(
            <ContextSelector>
                <ProgramSelector options={programs} disabled />
                <StageSelector
                    options={programs}
                    loading
                    loadingLabel="Loading stages"
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

    it('applies loading before disabled, read-only, open, and clear props', async () => {
        const onChange = vi.fn()
        const onClear = vi.fn()
        const onOpenChange = vi.fn()

        const screen = await render(
            <ContextSelector>
                <ProgramSelector
                    options={programs}
                    value="program-1"
                    loading
                    disabled
                    readOnly
                    open
                    onChange={onChange}
                    onClear={onClear}
                    onOpenChange={onOpenChange}
                    loadingLabel="Loading programs"
                />
            </ContextSelector>
        )

        await expect
            .element(screen.getByLabelText('Loading programs'))
            .toBeVisible()
        expect(
            screen.container.querySelector(
                '[data-test="program-selector-container"]'
            )
        ).toBeNull()
        expect(page.getByRole('menu').query()).toBeNull()
        expect(onChange).not.toHaveBeenCalled()
        expect(onClear).not.toHaveBeenCalled()
        expect(onOpenChange).not.toHaveBeenCalled()
    })

    it('applies disabled before read-only, open, and clear props', async () => {
        const onClear = vi.fn()
        const onOpenChange = vi.fn()

        const screen = await render(
            <ContextSelector>
                <ProgramSelector
                    options={programs}
                    value="program-1"
                    disabled
                    readOnly
                    open
                    onClear={onClear}
                    onOpenChange={onOpenChange}
                />
            </ContextSelector>
        )

        const item = screen.container.querySelector<HTMLButtonElement>(
            '[data-test="program-selector-container"]'
        )

        expect(item?.disabled).toBe(true)
        expect(
            screen.container.querySelector(
                '[data-test="program-selector-container-clear-icon"]'
            )
        ).toBeNull()
        expect(page.getByRole('menu').query()).toBeNull()
        expect(onClear).not.toHaveBeenCalled()
        expect(onOpenChange).not.toHaveBeenCalled()
    })

    it('uses a host-owned event label and emits interactive event intent', async () => {
        const onChange = vi.fn()
        const onOpenChange = vi.fn()
        await render(
            <ContextSelector>
                <EventSelector
                    label="Visit date"
                    options={programs.slice(0, 2)}
                    open
                    onChange={onChange}
                    onOpenChange={onOpenChange}
                />
            </ContextSelector>
        )

        await expect
            .element(page.getByText('Visit date', { exact: true }))
            .toBeVisible()
        await page.getByText('Malaria program 2').click()
        expect(onChange).toHaveBeenCalledWith('program-2')
        expect(onOpenChange).toHaveBeenCalledWith(false)
    })

    it('keeps a read-only event clearable without opening its menu', async () => {
        const onClear = vi.fn()

        const screen = await render(
            <ContextSelector>
                <EventSelector
                    label="Date of consultation"
                    options={programs.slice(0, 2)}
                    value="program-1"
                    readOnly
                    open
                    onClear={onClear}
                />
            </ContextSelector>
        )

        const item = screen.container.querySelector(
            '[data-test="event-selector-container"]'
        )

        expect(item?.className).not.toContain('openable')
        await expect
            .element(page.getByText('Date of consultation'))
            .toBeVisible()

        const clear = screen.container.querySelector<HTMLElement>(
            '[data-test="event-selector-container-clear-icon"]'
        )

        expect(clear).not.toBeNull()
        clear?.click()
        expect(onClear).toHaveBeenCalledOnce()
        expect(page.getByRole('menu').query()).toBeNull()
    })

    it('supports specialized label overrides and the generic option escape hatch', async () => {
        const onChange = vi.fn()
        await render(
            <ContextSelector>
                <EnrollmentSelector
                    label="Active enrollment"
                    options={programs.slice(0, 2)}
                    value="program-1"
                    readOnly
                />
                <OptionSelector
                    label="Category option"
                    options={programs.slice(0, 2)}
                    open
                    onChange={onChange}
                />
            </ContextSelector>
        )

        await expect.element(page.getByText('Active enrollment')).toBeVisible()
        await expect
            .element(page.getByText('Category option', { exact: true }))
            .toBeVisible()
        await page.getByText('Malaria program 2').click()
        expect(onChange).toHaveBeenCalledWith('program-2')
    })

    it('keeps an externally open popup safe when onOpenChange is omitted', async () => {
        await render(
            <ContextSelector>
                <OptionSelector
                    label="Category option"
                    options={programs.slice(0, 2)}
                    open
                />
            </ContextSelector>
        )

        const backdrop = document.querySelector<HTMLElement>('.backdrop')
        expect(backdrop).not.toBeNull()
        expect(() => backdrop?.click()).not.toThrow()
        await expect.element(page.getByRole('menu')).toBeVisible()
    })

    it('emits close intent independently when onChange is omitted', async () => {
        const onOpenChange = vi.fn()
        await render(
            <ContextSelector>
                <OptionSelector
                    label="Category option"
                    options={programs.slice(0, 2)}
                    open
                    onOpenChange={onOpenChange}
                />
            </ContextSelector>
        )

        await page.getByText('Malaria program 2').click()
        expect(onOpenChange).toHaveBeenCalledWith(false)
    })

    it('keeps locked selector menus unpadded and shows Capture read-only OU text', async () => {
        const onClear = vi.fn()
        await render(
            <ContextSelector>
                <StageSelector
                    options={programs}
                    open
                    onOpenChange={() => undefined}
                    onChange={() => undefined}
                />
                <OrganisationUnitSelector
                    value="Ngelehun CHC"
                    readOnly
                    onClear={onClear}
                />
            </ContextSelector>
        )

        const menuShell = page.getByRole('menu').element().parentElement
        expect(getComputedStyle(menuShell!).paddingBottom).toBe('0px')
        await expect.element(page.getByText('Ngelehun CHC')).toBeVisible()
        expect(
            document.querySelector(
                '[data-test="org-unit-selector-container-clear-icon"]'
            )
        ).toBeNull()
        expect(onClear).not.toHaveBeenCalled()
    })
})
