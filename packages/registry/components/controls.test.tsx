import React from 'react'
import { userEvent } from 'vitest/browser'
import { render } from 'vitest-browser-react'
import { Button } from './button'
import { Checkbox } from './checkbox'
import { Input } from './input'
import { RadioGroup, RadioGroupItem } from './radio-group'
import { roleColour } from '../test/roleColour'

const style = (element: Element) => getComputedStyle(element)

describe('form controls in the default theme', () => {
    it('frame an input like @dhis2/ui', async () => {
        const screen = await render(
            <Input aria-label="Name" placeholder="Name" />
        )
        const input = screen.getByRole('textbox').element()
        expect(style(input).borderTopColor).toBe(roleColour('input'))
        expect(getComputedStyle(input, '::placeholder').color).toBe(
            roleColour('subtle-foreground')
        )
    })

    it('ring a checkbox in the control colour, and fill it teal once checked', async () => {
        const screen = await render(
            <>
                <Checkbox aria-label="Off" />
                <Checkbox aria-label="On" defaultChecked />
            </>
        )
        expect(
            style(screen.getByLabelText('Off').element()).borderTopColor
        ).toBe(roleColour('control'))
        expect(
            style(screen.getByLabelText('On').element()).backgroundColor
        ).toBe(roleColour('selected-strong'))
    })

    it('ring a radio like a checkbox', async () => {
        const screen = await render(
            <RadioGroup aria-label="Choice">
                <RadioGroupItem value="a" aria-label="A" />
            </RadioGroup>
        )
        expect(style(screen.getByLabelText('A').element()).borderTopColor).toBe(
            roleColour('control')
        )
    })

    it('grey out a disabled button', async () => {
        const screen = await render(
            <Button variant="secondary" disabled>
                Save
            </Button>
        )
        expect(style(screen.getByRole('button').element()).color).toBe(
            roleColour('disabled-foreground')
        )
    })

    it('write a destructive button in the destructive foreground', async () => {
        const screen = await render(
            <div className="[--dhis2-destructive-foreground:rgb(1,2,3)]">
                <Button variant="destructive">Delete</Button>
            </div>
        )
        expect(style(screen.getByRole('button').element()).color).toBe(
            'rgb(1, 2, 3)'
        )
    })

    it.each([
        ['default', 'primary', 'primary-foreground'],
        ['destructive', 'destructive', 'destructive-foreground'],
    ] as const)(
        'fill a %s button with its role, with no gradient',
        async (variant, fill, text) => {
            const screen = await render(<Button variant={variant}>Go</Button>)
            const button = style(screen.getByRole('button').element())
            expect(button.backgroundImage).toBe('none')
            expect(button.backgroundColor).toBe(roleColour(fill))
            expect(button.color).toBe(roleColour(text))
        }
    )

    it.each(['default', 'destructive'] as const)(
        'grey out a disabled %s button like the others',
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

    it.each([
        ['default', 'primary-foreground'],
        ['destructive', 'destructive-foreground'],
    ] as const)(
        'outline a focused %s button in its text colour over its fill',
        async (variant, role) => {
            const screen = await render(<Button variant={variant}>Go</Button>)
            await userEvent.tab()
            const button = screen.getByRole('button').element()
            expect(document.activeElement).toBe(button)
            expect(style(button).outlineColor).toBe(roleColour(role))
        }
    )
})
