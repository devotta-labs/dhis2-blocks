import React from 'react'
import { userEvent } from 'vitest/browser'
import { render } from 'vitest-browser-react'
import { Button } from './button'
import { Checkbox } from './checkbox'
import { Input } from './input'
import { roleColour } from '../test/roleColour'

const style = (element: Element) => getComputedStyle(element)

describe('form controls with more contrast', () => {
    it('frame an input in a dark border', async () => {
        const screen = await render(<Input aria-label="Name" />)
        expect(
            style(screen.getByRole('textbox').element()).borderTopColor
        ).toBe(roleColour('input'))
    })

    it('ring a checkbox in the darkest grey', async () => {
        const screen = await render(<Checkbox aria-label="Off" />)
        expect(
            style(screen.getByLabelText('Off').element()).borderTopColor
        ).toBe(roleColour('control'))
    })

    it('fill a primary button solid, without the gradient', async () => {
        const screen = await render(<Button>Save</Button>)
        const button = style(screen.getByRole('button').element())
        expect(button.backgroundImage).toBe('none')
        expect(button.backgroundColor).toBe(roleColour('primary'))
    })

    it('fill a destructive button solid, without the gradient', async () => {
        const screen = await render(
            <Button variant="destructive">Delete</Button>
        )
        const button = style(screen.getByRole('button').element())
        expect(button.backgroundImage).toBe('none')
        expect(button.backgroundColor).toBe(roleColour('destructive'))
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
            expect(button.backgroundColor).toBe(roleColour('accent-strong'))
            expect(button.color).toBe(roleColour('disabled-foreground'))
        }
    )

    it.each(['default', 'destructive'] as const)(
        'outline a focused %s button in white over its fill',
        async (variant) => {
            const screen = await render(<Button variant={variant}>Go</Button>)
            await userEvent.tab()
            const button = screen.getByRole('button').element()
            expect(document.activeElement).toBe(button)
            expect(style(button).outlineColor).toBe(
                roleColour('primary-foreground')
            )
        }
    )
})
