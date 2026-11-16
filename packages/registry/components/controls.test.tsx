import React from 'react'
import { userEvent } from 'vitest/browser'
import { render } from 'vitest-browser-react'
import { Button } from './button'
import { Checkbox } from './checkbox'
import {
    Combobox,
    ComboboxChips,
    ComboboxChipsInput,
    ComboboxContent,
    ComboboxInput,
    ComboboxItem,
    ComboboxList,
} from './combobox'
import { Input } from './input'
import { RadioGroup, RadioGroupItem } from './radio-group'
import { Toggle } from './toggle'
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

    it('ring a chips box like an input while its input has focus', async () => {
        const screen = await render(
            <Combobox items={['Bo']} multiple>
                <ComboboxChips data-testid="chips">
                    <ComboboxChipsInput aria-label="Facilities" />
                </ComboboxChips>
            </Combobox>
        )
        const chips = style(screen.getByTestId('chips').element())
        expect(chips.borderTopColor).toBe(roleColour('input'))
        await userEvent.tab()
        expect(chips.borderTopColor).toBe(roleColour('ring'))
        expect(chips.boxShadow).toContain(
            `${roleColour('ring')} 0px 0px 0px 2px inset`
        )
    })

    it('size a chips box like an input', async () => {
        const screen = await render(
            <>
                <Input aria-label="Name" />
                <Combobox items={['Bo']} multiple>
                    <ComboboxChips data-testid="chips">
                        <ComboboxChipsInput aria-label="Facilities" />
                    </ComboboxChips>
                </Combobox>
            </>
        )
        const height = (element: Element) =>
            element.getBoundingClientRect().height
        expect(height(screen.getByTestId('chips').element())).toBe(
            height(screen.getByRole('textbox', { name: 'Name' }).element())
        )
    })

    it('open a combobox list under the whole field, its button too', async () => {
        const screen = await render(
            <div style={{ width: 300 }}>
                <Combobox items={['Bo', 'Kenema']}>
                    <ComboboxInput aria-label="District" />
                    <ComboboxContent>
                        <ComboboxList>
                            {(item: string) => (
                                <ComboboxItem key={item} value={item}>
                                    {item}
                                </ComboboxItem>
                            )}
                        </ComboboxList>
                    </ComboboxContent>
                </Combobox>
            </div>
        )
        await userEvent.click(
            screen.getByRole('combobox', { name: 'District' })
        )
        const field = document
            .querySelector('[data-slot=input-group]')!
            .getBoundingClientRect()
        const list = document
            .querySelector('[data-slot=combobox-content]')!
            .getBoundingClientRect()
        // Within the field's borders, as the list sits under its input.
        expect(list.width).toBeGreaterThanOrEqual(field.width - 2)
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

    it('tint a pressed outline toggle a step darker on hover', async () => {
        const screen = await render(
            <Toggle variant="outline" defaultPressed>
                Bold
            </Toggle>
        )
        const toggle = screen.getByRole('button')
        expect(style(toggle.element()).backgroundColor).toBe(
            roleColour('primary-subtle')
        )
        await userEvent.hover(toggle)
        await expect
            .poll(() => style(toggle.element()).backgroundColor)
            .toBe(roleColour('info-fill'))
    })
})
