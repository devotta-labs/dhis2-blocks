import React from 'react'
import { render } from 'vitest-browser-react'
import { Badge } from './badge'
import { roleColour } from '../test/roleColour'

describe('Badge', () => {
    it('fills the secondary variant with the accent colour', async () => {
        const screen = await render(<Badge variant="secondary">Active</Badge>)
        const badge = screen.getByText('Active').element()
        expect(getComputedStyle(badge).backgroundColor).toBe(
            roleColour('accent')
        )
        expect(getComputedStyle(badge).color).toBe(
            roleColour('accent-foreground')
        )
    })
})
