import React from 'react'
import { page, userEvent } from 'vitest/browser'
import { render } from 'vitest-browser-react'
import { CONTROL_CLASS, HIDDEN_CLASS } from '../TextCell'

const style = (testId: string) =>
    getComputedStyle(page.getByTestId(testId).element())

describe('cells with more contrast', () => {
    it('rings a focused cell in the dark focus colour', async () => {
        await render(
            <input
                data-testid="cell"
                aria-label="Cell"
                className={CONTROL_CLASS}
            />
        )
        await userEvent.click(page.getByTestId('cell'))
        expect(style('cell').boxShadow).toContain('rgb(13, 71, 161)')
    })

    it('rings an invalid cell in the dark destructive indicator', async () => {
        await render(
            <input
                data-testid="cell"
                aria-label="Cell"
                aria-invalid="true"
                className={CONTROL_CLASS}
            />
        )
        expect(style('cell').boxShadow).toContain('rgb(137, 21, 21)')
    })

    it('fills a hidden cell a step darker', async () => {
        await render(
            <div data-testid="cell" className={HIDDEN_CLASS}>
                Hidden
            </div>
        )
        expect(style('cell').backgroundColor).toBe('rgb(232, 237, 242)')
    })
})
