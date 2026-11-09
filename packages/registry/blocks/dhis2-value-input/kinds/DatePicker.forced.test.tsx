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

    it('keeps an edge around today', async () => {
        await open()
        await expect
            .poll(() => document.activeElement?.getAttribute('aria-current'))
            .toBe('date')
        const focused = document.activeElement
        if (focused === null) {
            throw new Error('Expected a day to have focus')
        }
        const today = getComputedStyle(focused)
        expect(today.borderTopStyle).toBe('solid')
        expect(today.borderTopWidth).toBe('1px')
    })

    it('outlines the focused day', async () => {
        await open('2026-10-14')
        await userEvent.keyboard('{ArrowRight}')
        const focused = page.getByRole('button', { name: '15 October 2026' })
        await expect.element(focused).toHaveFocus()
        expect(getComputedStyle(focused.element()).outlineStyle).toBe('solid')
    })
})
