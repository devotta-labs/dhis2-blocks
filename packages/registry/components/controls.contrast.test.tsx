import React from 'react'
import { render } from 'vitest-browser-react'
import { Button } from './button'
import { Checkbox } from './checkbox'
import { Input } from './input'

const style = (element: Element) => getComputedStyle(element)

describe('form controls with more contrast', () => {
    it('frame an input in a dark border', async () => {
        const screen = await render(<Input aria-label="Name" />)
        expect(
            style(screen.getByRole('textbox').element()).borderTopColor
        ).toBe('rgb(64, 75, 90)')
    })

    it('ring a checkbox in the darkest grey', async () => {
        const screen = await render(<Checkbox aria-label="Off" />)
        expect(
            style(screen.getByLabelText('Off').element()).borderTopColor
        ).toBe('rgb(33, 41, 52)')
    })

    it('fill a primary button solid, without the gradient', async () => {
        const screen = await render(<Button>Save</Button>)
        const button = style(screen.getByRole('button').element())
        expect(button.backgroundImage).toBe('none')
        expect(button.backgroundColor).toBe('rgb(13, 71, 161)')
    })

    it('fill a destructive button solid, without the gradient', async () => {
        const screen = await render(
            <Button variant="destructive">Delete</Button>
        )
        const button = style(screen.getByRole('button').element())
        expect(button.backgroundImage).toBe('none')
        expect(button.backgroundColor).toBe('rgb(137, 21, 21)')
    })

    it.each(['default', 'destructive'] as const)(
        'grey out a disabled %s button',
        async (variant) => {
            const screen = await render(
                <Button variant={variant} disabled>
                    Go
                </Button>
            )
            const button = style(screen.getByRole('button').element())
            expect(button.backgroundColor).toBe('rgb(213, 221, 229)')
            expect(button.color).toBe('rgb(74, 87, 104)')
        }
    )
})
