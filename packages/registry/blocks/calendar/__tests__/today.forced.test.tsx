import React from 'react'
import { page } from 'vitest/browser'
import { render } from 'vitest-browser-react'
import { TODAY_CLASS } from '../CalendarGrid'

describe('calendar in forced colours', () => {
    it('keeps today filled apart from the page', async () => {
        await render(
            <>
                <span data-testid="today" className={TODAY_CLASS}>
                    6
                </span>
                <span data-testid="canvas" className="bg-[Canvas]" />
            </>
        )
        const today = getComputedStyle(page.getByTestId('today').element())
        const canvas = getComputedStyle(
            page.getByTestId('canvas').element()
        ).backgroundColor
        expect(today.backgroundColor).not.toBe(canvas)
        expect(today.color).not.toBe(today.backgroundColor)
    })
})
