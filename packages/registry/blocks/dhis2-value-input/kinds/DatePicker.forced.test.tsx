import { page, userEvent } from 'vitest/browser'
import { render } from 'vitest-browser-react'
import { ValueInput } from '../ValueInput'

const open = async (value?: string) => {
    await render(
        <>
            <ValueInput
                field={{ valueType: 'DATE' }}
                settings={{ calendar: 'gregorian', dateFormat: 'YYYY-MM-DD' }}
                label="Date of visit"
                value={value}
                onChange={() => {}}
            />
            <span data-testid="canvas" className="bg-[Canvas]" />
        </>
    )
    await userEvent.click(page.getByRole('button', { name: 'Choose date' }))
}

describe('the date picker in forced colours', () => {
    it('keeps the picked day filled apart from the page', async () => {
        await open('2026-10-14')
        const picked = getComputedStyle(
            page.getByRole('button', { name: '14 October 2026' }).element()
        )
        const canvas = getComputedStyle(
            page.getByTestId('canvas').element()
        ).backgroundColor
        expect(picked.backgroundColor).not.toBe(canvas)
        expect(picked.color).not.toBe(picked.backgroundColor)
    })

    it('marks today apart from the other days', async () => {
        await open()
        await expect
            .poll(() => document.activeElement?.getAttribute('aria-current'))
            .toBe('date')
        const today = document.activeElement
        const other = document.querySelector(
            '[role="grid"] button:not([aria-current])'
        )
        if (today === null || other === null) {
            throw new Error('Expected today and another day')
        }
        // Focus marks a day of its own: today is compared without it.
        await userEvent.keyboard('{Shift>}{Tab}{/Shift}')
        await expect
            .element(page.getByRole('button', { name: 'Next month' }))
            .toHaveFocus()
        const style = getComputedStyle(today)
        expect(style.borderTopStyle).toBe('solid')
        expect(style.borderTopWidth).toBe('1px')
        expect(style.borderTopColor).not.toBe(
            getComputedStyle(other).borderTopColor
        )
    })

    it('outlines the focused day', async () => {
        await open('2026-10-14')
        await userEvent.keyboard('{ArrowRight}')
        const focused = page.getByRole('button', { name: '15 October 2026' })
        await expect.element(focused).toHaveFocus()
        expect(getComputedStyle(focused.element()).outlineStyle).toBe('solid')
    })
})
