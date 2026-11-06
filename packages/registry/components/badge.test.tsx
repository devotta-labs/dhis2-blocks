import React from 'react'
import { render } from 'vitest-browser-react'
import { Badge } from './badge'

describe('Badge', () => {
    it('fills the secondary variant with the accent colour', async () => {
        const screen = await render(<Badge variant="secondary">Active</Badge>)
        const badge = screen.getByText('Active').element()
        expect(getComputedStyle(badge).backgroundColor).toBe(
            'rgb(243, 245, 247)'
        )
        expect(getComputedStyle(badge).color).toBe('rgb(33, 41, 52)')
    })
})
