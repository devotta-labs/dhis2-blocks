import React from 'react'
import { page } from 'vitest/browser'
import { render } from 'vitest-browser-react'
import { TwoOptions } from './optionList.fixture'

describe('option list in forced colours', () => {
    it('outlines the highlighted row', async () => {
        await render(<TwoOptions />)
        const option = page.getByRole('option', { name: 'Alpha' }).element()
        expect(getComputedStyle(option).outlineStyle).toBe('solid')
    })
})
