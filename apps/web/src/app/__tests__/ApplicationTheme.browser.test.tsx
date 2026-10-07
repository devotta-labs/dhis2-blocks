import { CircularLoader, CssReset } from '@dhis2/ui'
import React from 'react'
import { commands } from 'vitest/browser'
import { render } from 'vitest-browser-react'

declare module 'vitest/browser' {
    interface BrowserCommands {
        setReducedMotion(preference: 'reduce' | 'no-preference'): Promise<void>
    }
}

describe('Tailwind document defaults', () => {
    afterEach(async () => {
        await commands.setReducedMotion('no-preference')
    })

    it('preserves the page theme and form overrides after the DHIS2 reset', async () => {
        const screen = await render(
            <>
                <CssReset />
                <input aria-label="Default font" />
                <input aria-label="Explicit font" className="text-[14px]" />
            </>
        )

        expect(getComputedStyle(document.body).margin).toBe('0px')
        expect(getComputedStyle(document.body).backgroundColor).toBe(
            'rgb(243, 245, 247)'
        )
        expect(getComputedStyle(document.documentElement).color).toBe(
            'rgb(33, 41, 52)'
        )
        expect(getComputedStyle(document.documentElement).fontFamily).toBe(
            'Roboto, Helvetica, Arial, sans-serif'
        )
        expect(
            getComputedStyle(
                screen.getByRole('textbox', { name: 'Default font' }).element()
            ).fontFamily
        ).toBe(getComputedStyle(document.body).fontFamily)
        expect(
            getComputedStyle(
                screen.getByRole('textbox', { name: 'Explicit font' }).element()
            ).fontSize
        ).toBe('14px')
    })

    it('reduces transitions and animations including pseudo-elements and DHIS2 loaders', async () => {
        const screen = await render(
            <>
                <CssReset />
                <div
                    data-testid="animated"
                    className="animate-spin transition-all duration-300 before:animate-spin before:content-['']"
                />
                <CircularLoader />
            </>
        )

        const animated = screen.getByTestId('animated').element()
        expect(getComputedStyle(animated).transitionDuration).toBe('0.3s')
        await commands.setReducedMotion('reduce')
        expect(
            window.matchMedia('(prefers-reduced-motion: reduce)').matches
        ).toBe(true)
        expect(getComputedStyle(animated).transitionDuration).toBe('1e-05s')
        expect(getComputedStyle(animated).animationDuration).toBe('1e-05s')
        expect(getComputedStyle(animated).animationIterationCount).toBe('1')
        expect(getComputedStyle(animated, '::before').animationDuration).toBe(
            '1e-05s'
        )
        expect(
            getComputedStyle(animated, '::before').animationIterationCount
        ).toBe('1')

        const loader = document.querySelector<HTMLElement>(
            '[data-test="dhis2-uicore-circularloader"]'
        )!

        expect(getComputedStyle(loader).animationDuration).toBe('1e-05s')
        expect(getComputedStyle(document.documentElement).scrollBehavior).toBe(
            'auto'
        )
    })
})
