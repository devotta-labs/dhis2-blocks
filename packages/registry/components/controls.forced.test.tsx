import React from 'react'
import { render } from 'vitest-browser-react'
import { Spinner } from './spinner'

const style = (element: Element) => getComputedStyle(element)

describe('form controls in forced colours', () => {
    it('keep the spinner arc apart from its track', async () => {
        const screen = await render(<Spinner data-testid="spinner" />)
        const spinner = style(screen.getByTestId('spinner').element())
        expect(spinner.borderBottomColor).not.toBe(spinner.borderTopColor)
    })
})
