import React from 'react'
import { page, userEvent } from 'vitest/browser'
import { render } from 'vitest-browser-react'
import { roleColour } from '../../../../test/roleColour'
import { TwoOptions } from './optionList.fixture'

const fill = (name: string) =>
    getComputedStyle(page.getByRole('option', { name }).element())
        .backgroundColor

describe('option list', () => {
    it('tells the hovered row from the highlighted one', async () => {
        await render(<TwoOptions />)
        await userEvent.hover(page.getByRole('option', { name: 'Beta' }))
        expect(fill('Alpha')).toBe(roleColour('accent'))
        expect(fill('Beta')).toBe(roleColour('muted'))
    })

    it('keeps the highlighted row its colour under the pointer', async () => {
        await render(<TwoOptions />)
        await userEvent.hover(page.getByRole('option', { name: 'Alpha' }))
        expect(fill('Alpha')).toBe(roleColour('accent'))
    })
})
