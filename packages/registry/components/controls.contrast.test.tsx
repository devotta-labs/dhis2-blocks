import React from 'react'
import { userEvent } from 'vitest/browser'
import { render } from 'vitest-browser-react'
import { Button } from './button'
import { Checkbox } from './checkbox'
import { Combobox, ComboboxChips, ComboboxChipsInput } from './combobox'
import { Input } from './input'
import { RadioGroup, RadioGroupItem } from './radio-group'
import { Switch } from './switch'
import { roleColour } from '../test/roleColour'

const style = (element: Element) => getComputedStyle(element)

describe('form controls with more contrast', () => {
    it('frame an input in a dark border', async () => {
        const screen = await render(<Input aria-label="Name" />)
        expect(
            style(screen.getByRole('textbox').element()).borderTopColor
        ).toBe(roleColour('input'))
    })

    it('frame a chips box like an input', async () => {
        const screen = await render(
            <Combobox items={['Bo']} multiple>
                <ComboboxChips data-testid="chips">
                    <ComboboxChipsInput aria-label="Facilities" />
                </ComboboxChips>
            </Combobox>
        )
        expect(
            style(screen.getByTestId('chips').element()).borderTopColor
        ).toBe(roleColour('input'))
    })

    it('ring a checkbox in the darkest grey', async () => {
        const screen = await render(<Checkbox aria-label="Off" />)
        expect(
            style(screen.getByLabelText('Off').element()).borderTopColor
        ).toBe(roleColour('control'))
    })

    it('fill a primary button with the darker primary', async () => {
        const screen = await render(<Button>Save</Button>)
        const button = style(screen.getByRole('button').element())
        expect(button.backgroundImage).toBe('none')
        expect(button.backgroundColor).toBe(roleColour('primary'))
    })

    it('fill a destructive button with the darker destructive', async () => {
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

    it('fill a switch off track in the darkest grey', async () => {
        const screen = await render(<Switch aria-label="Off" />)
        const track = style(screen.getByRole('switch').element())
        expect(track.backgroundColor).toBe(roleColour('control'))
        expect(track.borderTopColor).toBe(roleColour('control'))
    })

    it('ring a radio in the darkest grey and fill it when checked', async () => {
        const screen = await render(
            <RadioGroup defaultValue="b">
                <RadioGroupItem value="a" aria-label="A" />
                <RadioGroupItem value="b" aria-label="B" />
            </RadioGroup>
        )
        expect(style(screen.getByLabelText('A').element()).borderTopColor).toBe(
            roleColour('control')
        )
        expect(
            style(screen.getByLabelText('B').element()).backgroundColor
        ).toBe(roleColour('primary'))
    })

    it('outline a focused destructive button in the destructive foreground', async () => {
        const screen = await render(
            <div className="[--dhis2-destructive-foreground:rgb(1,2,3)]">
                <Button variant="destructive">Delete</Button>
            </div>
        )
        await userEvent.tab()
        expect(style(screen.getByRole('button').element()).outlineColor).toBe(
            'rgb(1, 2, 3)'
        )
    })
})
