import React from 'react'
import { page, userEvent } from 'vitest/browser'
import { render } from 'vitest-browser-react'
import { OpenSelect, style } from './surfaces.fixtures'

describe('select in forced colours', () => {
    it('outlines the highlighted option', async () => {
        await render(<OpenSelect />)
        const option = page.getByRole('option', { name: 'Beta' })
        await userEvent.hover(option)
        expect(style(option.element()).outlineStyle).toBe('solid')
    })
})
