import React from 'react'
import { userEvent } from 'vitest/browser'
import { render } from 'vitest-browser-react'
import { Combobox, ComboboxChips, ComboboxChipsInput } from './combobox'
import { Input } from './input'
import { SelectTrigger, Select, SelectValue } from './select'
import { Textarea } from './textarea'
import { Spinner } from './spinner'

const style = (element: Element) => getComputedStyle(element)

describe('form controls in forced colours', () => {
    it('keep the spinner arc apart from its track', async () => {
        const screen = await render(<Spinner data-testid="spinner" />)
        const spinner = style(screen.getByTestId('spinner').element())
        expect(spinner.borderBottomColor).not.toBe(spinner.borderTopColor)
    })

    it.each([
        ['an input', () => <Input aria-label="Field" />],
        ['a textarea', () => <Textarea aria-label="Field" />],
        [
            'a select',
            () => (
                <Select>
                    <SelectTrigger aria-label="Field">
                        <SelectValue />
                    </SelectTrigger>
                </Select>
            ),
        ],
    ] as const)('outline %s when it has keyboard focus', async (_, Field) => {
        const screen = await render(<Field />)
        await userEvent.tab()
        const field = screen.getByLabelText('Field').element()
        expect(document.activeElement).toBe(field)
        expect(style(field).outlineStyle).toBe('solid')
    })

    it('outline a chips box while its input has keyboard focus', async () => {
        const screen = await render(
            <Combobox items={['Bo']} multiple>
                <ComboboxChips data-testid="chips">
                    <ComboboxChipsInput aria-label="Facilities" />
                </ComboboxChips>
            </Combobox>
        )
        await userEvent.tab()
        expect(style(screen.getByTestId('chips').element()).outlineStyle).toBe(
            'solid'
        )
    })
})
