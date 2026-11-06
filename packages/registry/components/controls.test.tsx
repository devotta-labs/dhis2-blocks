import React from 'react'
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
})
