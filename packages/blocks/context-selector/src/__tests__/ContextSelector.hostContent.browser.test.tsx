import React from 'react'
import { page } from 'vitest/browser'
import { render } from 'vitest-browser-react'
import {
    ContextSelector,
    ContextValue,
    OrganisationUnitSelector,
} from '../index'

describe('ContextSelector host content', () => {
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

    it('provides the Capture organisation-unit popup geometry to host children', async () => {
        await render(
            <ContextSelector>
                <OrganisationUnitSelector open onOpenChange={() => undefined}>
                    <div data-testid="host-picker">Host tree</div>
                </OrganisationUnitSelector>
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
