import React from 'react'
import type { ReactNode } from 'react'
import { page, userEvent } from 'vitest/browser'
import { render } from 'vitest-browser-react'
import { Checkbox } from './checkbox'
import {
    Combobox,
    ComboboxContent,
    ComboboxInput,
    ComboboxList,
    ComboboxTrigger,
    ComboboxValue,
} from './combobox'
import {
    Field,
    FieldControl,
    FieldDescription,
    FieldError,
    FieldLabel,
} from './field'
import { Input } from './input'
import { RadioGroup, RadioGroupItem } from './radio-group'
import { Select, SelectTrigger, SelectValue } from './select'
import { roleColour } from '../test/roleColour'

/** A labelled, described field with an error, around `control`. */
const Invalid = ({ children }: { children: ReactNode }) => (
    <Field invalid data-testid="field">
        <FieldLabel>Name</FieldLabel>
        {children}
        <FieldDescription>Shown on the card</FieldDescription>
        <FieldError>Enter a name</FieldError>
    </Field>
)

const expectLinked = async (control: ReturnType<typeof page.getByRole>) => {
    await expect
        .element(control)
        .toHaveAccessibleDescription(/Shown on the card.*Enter a name/)
    await expect.element(control).toHaveAttribute('aria-invalid', 'true')
}

test('links an Input', async () => {
    await render(
        <Invalid>
            <Input />
        </Invalid>
    )
    await expectLinked(page.getByRole('textbox', { name: 'Name' }))
})

test('links a Select', async () => {
    await render(
        <Invalid>
            <Select items={[{ value: 'a', label: 'A' }]}>
                <SelectTrigger>
                    <SelectValue />
                </SelectTrigger>
            </Select>
        </Invalid>
    )
    await expectLinked(page.getByRole('combobox', { name: 'Name' }))
})

test('links a RadioGroup', async () => {
    await render(
        <Invalid>
            <RadioGroup>
                <RadioGroupItem value="a" aria-label="A" />
            </RadioGroup>
        </Invalid>
    )
    await expectLinked(page.getByRole('radiogroup', { name: 'Name' }))
})

test('links a Checkbox', async () => {
    await render(
        <Invalid>
            <Checkbox />
        </Invalid>
    )
    await expectLinked(page.getByRole('checkbox', { name: 'Name' }))
})

test("links a control that isn't Base UI", async () => {
    await render(
        <Invalid>
            <FieldControl render={(props) => <input {...props} />} />
        </Invalid>
    )
    await expectLinked(page.getByRole('textbox', { name: 'Name' }))
})

test('styles the invalid state', async () => {
    await render(
        <Invalid>
            <Input />
        </Invalid>
    )
    const root = page.getByTestId('field').element()
    expect(root).toHaveAttribute('data-invalid')
    expect(getComputedStyle(root).color).toBe(roleColour('destructive'))
})

test('shows FieldError content without native validity', async () => {
    await render(
        <Field>
            <FieldLabel>Name</FieldLabel>
            <Input />
            <FieldError>Required</FieldError>
        </Field>
    )
    await expect.element(page.getByText('Required')).toBeVisible()
})

test('has no group role', async () => {
    await render(
        <Invalid>
            <Input />
        </Invalid>
    )
    expect(page.getByTestId('field').element()).not.toHaveAttribute('role')
})

test("a combobox's popup search keeps its own name", async () => {
    await render(
        <Field>
            <FieldLabel>Facility</FieldLabel>
            <Combobox items={['Ngelehun']}>
                <ComboboxTrigger>
                    <ComboboxValue />
                </ComboboxTrigger>
                <ComboboxContent>
                    <ComboboxInput
                        showTrigger={false}
                        aria-label="Search facilities"
                    />
                    <ComboboxList>{(item: string) => item}</ComboboxList>
                </ComboboxContent>
            </Combobox>
        </Field>
    )
    await userEvent.click(page.getByRole('combobox', { name: 'Facility' }))
    await expect
        .element(page.getByRole('combobox', { name: 'Search facilities' }))
        .toBeVisible()
})
