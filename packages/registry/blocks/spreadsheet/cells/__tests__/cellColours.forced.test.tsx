import React from 'react'
import { page, userEvent } from 'vitest/browser'
import { render } from 'vitest-browser-react'
import { CONTROL_CLASS } from '../TextCell'

const outlineOf = () =>
    getComputedStyle(page.getByTestId('cell').element()).outlineStyle

describe('cells in forced colours', () => {
    it('outlines a focused cell', async () => {
        await render(
            <input
                data-testid="cell"
                aria-label="Cell"
                className={CONTROL_CLASS}
            />
        )
        await userEvent.click(page.getByTestId('cell'))
        expect(outlineOf()).toBe('solid')
    })

    it('marks an invalid cell with a dashed outline', async () => {
        await render(
            <input
                data-testid="cell"
                aria-label="Cell"
                aria-invalid="true"
                className={CONTROL_CLASS}
            />
        )
        expect(outlineOf()).toBe('dashed')
    })
})
