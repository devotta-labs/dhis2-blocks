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
    FieldContent,
    FieldControl,
    FieldDescription,
    FieldError,
    FieldLabel,
} from './field'
import { Input } from './input'
import { InputGroup, InputGroupTextarea } from './input-group'
import { RadioGroup, RadioGroupItem } from './radio-group'
import { Select, SelectTrigger, SelectValue } from './select'
import { Textarea } from './textarea'
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

// First: React warns about a ref only once per component.
test('renders FieldLabel without a ref warning', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {})
    await render(
        <Field>
            <FieldLabel>Name</FieldLabel>
            <Input />
        </Field>
    )
    expect(error).not.toHaveBeenCalled()
    error.mockRestore()
})

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

test('links a Textarea', async () => {
    await render(
        <Invalid>
            <Textarea />
        </Invalid>
    )
    await expectLinked(page.getByRole('textbox', { name: 'Name' }))
})

test('keeps a controlled Textarea’s own id, value, change handler and ref', async () => {
    const ref = React.createRef<HTMLTextAreaElement>()
    const Notes = () => {
        const [value, setValue] = React.useState('a')
        return (
            <Field>
                <FieldLabel htmlFor="notes">Notes</FieldLabel>
                <Textarea
                    id="notes"
                    ref={ref}
                    rows={4}
                    value={value}
                    onChange={(event) =>
                        setValue(event.currentTarget.value.toUpperCase())
                    }
                />
            </Field>
        )
    }
    await render(<Notes />)
    const notes = page.getByRole('textbox', { name: 'Notes' })
    await userEvent.fill(notes, 'bc')
    await expect.element(notes).toHaveValue('BC')
    expect(ref.current?.id).toBe('notes')
    expect(ref.current?.rows).toBe(4)
})

test('links a textarea in an InputGroup', async () => {
    await render(
        <Invalid>
            <InputGroup>
                <InputGroupTextarea />
            </InputGroup>
        </Invalid>
    )
    await expectLinked(page.getByRole('textbox', { name: 'Name' }))
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

test('names and describes each radio in its own horizontal field', async () => {
    await render(
        <RadioGroup aria-label="Spacing">
            <Field orientation="horizontal">
                <RadioGroupItem value="compact" />
                <FieldContent>
                    <FieldLabel>Compact</FieldLabel>
                    <FieldDescription>Fits more on screen.</FieldDescription>
                </FieldContent>
            </Field>
            <Field orientation="horizontal">
                <RadioGroupItem value="comfortable" />
                <FieldContent>
                    <FieldLabel>Comfortable</FieldLabel>
                    <FieldDescription>Room to read.</FieldDescription>
                </FieldContent>
            </Field>
        </RadioGroup>
    )
    const compact = page.getByRole('radio', { name: 'Compact' })
    await expect
        .element(compact)
        .toHaveAccessibleDescription('Fits more on screen.')
    await expect
        .element(page.getByRole('radio', { name: 'Comfortable' }))
        .toHaveAccessibleDescription('Room to read.')
    await userEvent.click(page.getByText('Room to read.'))
    await expect
        .element(page.getByRole('radio', { name: 'Comfortable' }))
        .not.toBeChecked()
    await userEvent.click(page.getByText('Comfortable', { exact: true }))
    await expect
        .element(page.getByRole('radio', { name: 'Comfortable' }))
        .toBeChecked()
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
