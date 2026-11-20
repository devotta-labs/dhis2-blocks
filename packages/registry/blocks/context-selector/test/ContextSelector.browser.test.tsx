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
    it('exposes Capture toolbar semantics and composes clear-all', async () => {
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

    it('disables and marks loading selectors', async () => {
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
        expect(disabled?.disabled).toBe(true)
        await expect
            .element(screen.getByLabelText('Loading stages'))
            .toBeVisible()
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

    it('renders ContextValue as a non-selectable, optionally clearable value', async () => {
        const onClear = vi.fn()
        const screen = await render(
            <ContextSelector>
                <ContextValue
                    label="Tracked entity"
                    value="Person"
                    onClear={onClear}
                />
            </ContextSelector>
        )

        const item = screen.container.querySelector('.selector-bar-item')
        expect(item?.className).not.toContain('openable')
        await expect.element(page.getByText('Person')).toBeVisible()
        const clear = screen.container.querySelector<HTMLElement>(
            '[data-test$="-clear-icon"]'
        )
        expect(clear).not.toBeNull()
        clear?.click()
        expect(onClear).toHaveBeenCalledOnce()
    })

    it('shows Capture read-only OU text without a clear action', async () => {
        const onClear = vi.fn()
        await render(
            <ContextSelector>
                <OrganisationUnitSelector
                    value="Ngelehun CHC"
                    readOnly
                    onClear={onClear}
                />
            </ContextSelector>
        )

        await expect.element(page.getByText('Ngelehun CHC')).toBeVisible()
        expect(
            document.querySelector(
                '[data-test="org-unit-selector-container-clear-icon"]'
            )
        ).toBeNull()
        expect(onClear).not.toHaveBeenCalled()
    })

    it('renders host children in the organisation-unit popup', async () => {
        await render(
            <ContextSelector>
                <OrganisationUnitSelector open onOpenChange={() => undefined}>
                    <div data-testid="host-picker">Host tree</div>
                </OrganisationUnitSelector>
            </ContextSelector>
        )

        const picker = page.getByTestId('host-picker')
        await expect.element(picker).toBeVisible()
    })
})
