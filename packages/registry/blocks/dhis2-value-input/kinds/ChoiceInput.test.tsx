import { useState } from 'react'
import { page, userEvent } from 'vitest/browser'
import { render } from 'vitest-browser-react'
import type { Field, ValueSettings } from '@/components/dhis2-value-types'
import { ValueInput } from '../ValueInput'
import type { ValueInputProps } from '../ValueInput'

const SETTINGS: ValueSettings = {
    calendar: 'gregorian',
    dateFormat: 'YYYY-MM-DD',
}
const LABEL = 'Result'

const options = (count: number) =>
    Array.from({ length: count }, (_, i) => ({
        code: String.fromCharCode(65 + i),
        name: `Name ${String.fromCharCode(65 + i)}`,
    }))

const mount = async (field: Field, props: Partial<ValueInputProps> = {}) => {
    const onChange = vi.fn()
    await render(
        <ValueInput
            field={field}
            settings={SETTINGS}
            label={LABEL}
            value={undefined}
            onChange={onChange}
            {...props}
        />
    )
    return onChange
}

/** A host that keeps the value it is told, as a form does. */
const mountHeld = async (
    field: Field,
    props: Partial<ValueInputProps> = {}
) => {
    const onChange = vi.fn()
    const Host = () => {
        const [value, setValue] = useState(props.value)
        return (
            <ValueInput
                field={field}
                settings={SETTINGS}
                label={LABEL}
                {...props}
                value={value}
                onChange={(next, problem) => {
                    onChange(next, problem)
                    setValue(next ?? undefined)
                }}
            />
        )
    }
    await render(<Host />)
    return onChange
}

const BOOLEAN: Field = { valueType: 'BOOLEAN' }
const SHORT: Field = { valueType: 'TEXT', options: options(3) }
const LONG: Field = { valueType: 'TEXT', options: options(6) }
const radio = (name: string) => page.getByRole('radio', { name })
const clear = () => page.getByRole('button', { name: 'Clear' })

test('Yes is picked with one click and reported at once', async () => {
    const onChange = await mount(BOOLEAN)
    await userEvent.click(radio('Yes'))
    expect(onChange).toHaveBeenCalledExactlyOnceWith('true')
})

test('arrow Down moves to No, checks and picks it; Tab leaves the group', async () => {
    const onChange = await mountHeld(BOOLEAN)
    await userEvent.click(radio('Yes'))
    await userEvent.keyboard('{ArrowDown}')
    expect(onChange).toHaveBeenLastCalledWith('false', undefined)
    await expect.element(radio('No')).toBeChecked()
    await expect.element(radio('No')).toHaveFocus()
    await userEvent.keyboard('{Tab}')
    // Tab left the group for the next control in the field, and picked nothing.
    await expect.element(radio('No')).not.toHaveFocus()
    await expect.element(clear()).toHaveFocus()
    expect(onChange).toHaveBeenCalledTimes(2)
})

test('a Yes-only box reports Yes when ticked and no value when unticked', async () => {
    const onChange = vi.fn()
    const Host = () => {
        const [value, setValue] = useState<string>()
        return (
            <ValueInput
                field={{ valueType: 'TRUE_ONLY' }}
                settings={SETTINGS}
                label={LABEL}
                value={value}
                onChange={(next) => {
                    onChange(next)
                    setValue(next ?? undefined)
                }}
            />
        )
    }
    await render(<Host />)
    const box = page.getByRole('checkbox', { name: LABEL })
    await userEvent.click(box)
    expect(onChange).toHaveBeenLastCalledWith('true')
    await userEvent.click(box)
    expect(onChange).toHaveBeenLastCalledWith(null)
})

test('a Yes-only box keeps its size in a wide field', async () => {
    await render(
        <div style={{ width: 400 }}>
            <ValueInput
                field={{ valueType: 'TRUE_ONLY' }}
                settings={SETTINGS}
                label={LABEL}
                value={undefined}
                onChange={() => undefined}
            />
        </div>
    )
    const box = page.getByRole('checkbox', { name: LABEL }).element()
    const { width, height } = box.getBoundingClientRect()
    expect(width).toBe(height)
})

test('a Yes-only box has its label beside it, which ticks it when clicked', async () => {
    const onChange = await mount(
        { valueType: 'TRUE_ONLY' },
        { required: true, description: 'Seen today' }
    )
    const box = page.getByRole('checkbox', { name: LABEL })
    const label = page.getByText(LABEL)
    const boxAt = box.element().getBoundingClientRect()
    const labelAt = label.element().getBoundingClientRect()
    expect(labelAt.left).toBeGreaterThan(boxAt.right)
    expect(labelAt.top).toBeLessThan(boxAt.bottom)
    await expect.element(box).toHaveAccessibleDescription('Seen today')
    await expect.element(box).toHaveAttribute('aria-required', 'true')
    expect(
        page.getByText('Seen today').element().getBoundingClientRect().top
    ).toBeGreaterThanOrEqual(boxAt.bottom)

    await userEvent.click(label)
    expect(onChange).toHaveBeenCalledExactlyOnceWith('true')
})

test('Yes and No sit on one row, with Clear right after No however long the label; an option set has a radio per line', async () => {
    await mount(BOOLEAN, {
        value: 'true',
        label: 'Daily iron and folic acid treatment for moderate anaemia given at this visit',
    })
    const top = (element: Element) => element.getBoundingClientRect().top
    const yes = radio('Yes').element()
    expect(top(radio('No').element())).toBe(top(yes))
    const gap =
        clear().element().getBoundingClientRect().left -
        page.getByText('No', { exact: true }).element().getBoundingClientRect()
            .right
    expect(gap).toBeGreaterThan(0)
    expect(gap).toBeLessThan(24)

    await mount(SHORT)
    expect(top(radio('Name B').element())).toBeGreaterThan(
        top(radio('Name A').element())
    )
})

test('picking Yes or No does not make the row taller, though Clear comes with the value', async () => {
    await mountHeld(BOOLEAN)
    const row = () =>
        page.getByRole('radiogroup', { name: LABEL }).element().parentElement!
    const empty = row().getBoundingClientRect().height
    await userEvent.click(radio('Yes'))
    await expect.element(clear()).toBeVisible()
    expect(row().getBoundingClientRect().height).toBe(empty)
})

test("a short option set's radios show and are described by each option's description", async () => {
    const onChange = await mount(
        {
            valueType: 'TEXT',
            options: [
                {
                    code: 'NONE',
                    name: 'No referral',
                    description: 'Treated here.',
                },
                { code: 'HOSP', name: 'Hospital' },
            ],
        },
        { messages: [{ tone: 'error', text: 'Choose one' }] }
    )
    // The field's messages describe the group and each radio; an option's description follows on its radio.
    await expect
        .element(page.getByRole('radiogroup', { name: LABEL }))
        .toHaveAccessibleDescription('Error: Choose one')
    const none = radio('No referral')
    await expect
        .element(none)
        .toHaveAccessibleDescription('Error: Choose one Treated here.')
    await expect.element(none).toHaveAttribute('aria-invalid', 'true')
    await expect
        .element(radio('Hospital'))
        .toHaveAccessibleDescription('Error: Choose one')
    await userEvent.click(page.getByText('No referral'))
    expect(onChange).toHaveBeenLastCalledWith('NONE')
})

test('a short option set is a radio group named by the label, showing names', async () => {
    await mount(SHORT)
    await expect
        .element(page.getByRole('radiogroup', { name: LABEL }))
        .toBeVisible()
    await expect.element(radio('Name B')).toBeVisible()
    await expect
        .element(page.getByText('B', { exact: true }))
        .not.toBeInTheDocument()
})

test('a long option set is a combobox: typing lists a name, picking reports its code', async () => {
    const onChange = await mount(LONG)
    await userEvent.click(page.getByRole('combobox', { name: LABEL }))
    await userEvent.keyboard('Name E')
    await userEvent.click(page.getByRole('option', { name: 'Name E' }))
    expect(onChange).toHaveBeenCalledExactlyOnceWith('E')
})

test('a hidden option is not listed when typed for', async () => {
    // Six are still visible, so the field is searched; with five it would be radios.
    await mount(
        { valueType: 'TEXT', options: options(7) },
        { hiddenOptions: new Set(['E']) }
    )
    await userEvent.click(page.getByRole('combobox', { name: LABEL }))
    await userEvent.keyboard('Name')
    await expect
        .element(page.getByRole('option', { name: 'Name D' }))
        .toBeVisible()
    await expect
        .element(page.getByRole('option', { name: 'Name E' }))
        .not.toBeInTheDocument()
})

test('a long option set shows the name of the stored value', async () => {
    await mount(LONG, { value: 'C' })
    await expect
        .element(page.getByRole('combobox', { name: LABEL }))
        .toHaveValue('Name C')
})

const OUTSIDE = 'Elsewhere'

/** A long option set with something else on the page to click, so the field is left without Tab. Above it, so the
 * open list does not cover it. */
const mountBeside = async (props: Partial<ValueInputProps> = {}) => {
    const onChange = vi.fn()
    await render(
        <>
            <button type="button">{OUTSIDE}</button>
            <ValueInput
                field={LONG}
                settings={SETTINGS}
                label={LABEL}
                value={undefined}
                onChange={onChange}
                {...props}
            />
        </>
    )
    return onChange
}

test('a long option set takes the top match of what is typed on Tab, and shows its name', async () => {
    const onChange = await mount(LONG)
    const box = page.getByRole('combobox', { name: LABEL })
    await userEvent.click(box)
    await userEvent.keyboard('name d')
    expect(onChange).not.toHaveBeenCalled()
    await userEvent.keyboard('{Tab}')
    expect(onChange).toHaveBeenCalledExactlyOnceWith('D')
    await expect.element(box).toHaveValue('Name D')
})

test('an option the mouse rests on is not picked by Tab; the typed text is committed', async () => {
    const onChange = await mount(LONG)
    await userEvent.click(page.getByRole('combobox', { name: LABEL }))
    await userEvent.keyboard('name')
    const hovered = page.getByRole('option', { name: 'Name C' })
    await userEvent.hover(hovered)
    await expect.element(hovered).toHaveAttribute('data-highlighted')
    await userEvent.keyboard('{Tab}')
    expect(onChange.mock.calls).toEqual([
        [null, { message: 'Choose one of the options', text: 'name' }],
    ])
})

test('a long option set takes the top match on Enter', async () => {
    const onChange = await mount(LONG)
    await userEvent.click(page.getByRole('combobox', { name: LABEL }))
    await userEvent.keyboard('Name B{Enter}')
    expect(onChange).toHaveBeenCalledExactlyOnceWith('B')
})

test('an option name or code typed and left is reported as its code', async () => {
    const onChange = await mountBeside()
    const box = page.getByRole('combobox', { name: LABEL })
    await userEvent.click(box)
    await userEvent.keyboard('name f')
    await userEvent.click(page.getByText(OUTSIDE))
    expect(onChange).toHaveBeenCalledExactlyOnceWith('F')

    await userEvent.click(box)
    await userEvent.keyboard('{Backspace>6/}c')
    await userEvent.click(page.getByText(OUTSIDE))
    expect(onChange).toHaveBeenLastCalledWith('C')
})

test('typed text that is no option is refused with the grid message, and stays shown', async () => {
    const onChange = await mount(LONG)
    const box = page.getByRole('combobox', { name: LABEL })
    await userEvent.click(box)
    await userEvent.keyboard('zzz{Tab}')
    expect(onChange).toHaveBeenCalledExactlyOnceWith(null, {
        message: 'Choose one of the options',
        text: 'zzz',
    })
    await expect.element(box).toHaveValue('zzz')
    await expect.element(box).toHaveAttribute('aria-invalid', 'true')
    await expect
        .element(box)
        .toHaveAccessibleDescription('Choose one of the options')
})

test('Enter with text that matches nothing reports the problem', async () => {
    const onChange = await mount(LONG)
    await userEvent.click(page.getByRole('combobox', { name: LABEL }))
    await userEvent.keyboard('zzz{Enter}')
    expect(onChange).toHaveBeenCalledExactlyOnceWith(null, {
        message: 'Choose one of the options',
        text: 'zzz',
    })
})

test('the name of a hidden option, typed and left, is refused', async () => {
    const onChange = await mountBeside({
        field: { valueType: 'TEXT', options: options(7) },
        hiddenOptions: new Set(['E']),
    })
    await userEvent.click(page.getByRole('combobox', { name: LABEL }))
    await userEvent.keyboard('Name E')
    await userEvent.click(page.getByText(OUTSIDE))
    expect(onChange).toHaveBeenCalledExactlyOnceWith(null, {
        message: 'Choose one of the options',
        text: 'Name E',
    })
})

test('emptied text on an optional long option set reports no value', async () => {
    const onChange = await mount(LONG, { value: 'C' })
    const box = page.getByRole('combobox', { name: LABEL })
    await userEvent.click(box)
    await userEvent.keyboard('{Backspace>6/}{Tab}')
    expect(onChange).toHaveBeenCalledExactlyOnceWith(null)
})

test('leaving a long option set untouched reports nothing', async () => {
    const onChange = await mount(LONG, { value: 'C' })
    await userEvent.click(page.getByRole('combobox', { name: LABEL }))
    await userEvent.keyboard('{Tab}')
    expect(onChange).not.toHaveBeenCalled()
})

test('Clear reports no value after a pick', async () => {
    const onChange = await mount(SHORT, { value: 'A' })
    await userEvent.click(clear())
    expect(onChange).toHaveBeenCalledExactlyOnceWith(null)
})

test('Clear is not offered when nothing is chosen', async () => {
    await mount(SHORT)
    await expect.element(clear()).not.toBeInTheDocument()
})

test('Clear is not offered for a required field', async () => {
    await mount(SHORT, { value: 'A', required: true })
    await expect.element(clear()).not.toBeInTheDocument()
})

test("a long option set's clear button in the input empties it and reports no value, keeping focus there", async () => {
    const onChange = await mountHeld(LONG, { value: 'C' })
    const input = page.getByRole('combobox', { name: LABEL })
    await expect.element(input).toHaveValue('Name C')
    await userEvent.click(clear())
    expect(onChange).toHaveBeenCalledExactlyOnceWith(null, undefined)
    await expect.element(input).toHaveValue('')
    await expect.element(input).toHaveFocus()
    await expect.element(clear()).not.toBeInTheDocument()
})

test('a required long option set has no clear button', async () => {
    await mount(LONG, { value: 'C', required: true })
    await expect.element(clear()).not.toBeInTheDocument()
})

test('a value that is no option is shown as the display block gives it, with no radio checked', async () => {
    await mount(SHORT, { value: 'GONE' })
    await expect.element(page.getByText('GONE')).toBeVisible()
    for (const name of ['Name A', 'Name B', 'Name C']) {
        await expect.element(radio(name)).not.toBeChecked()
    }
})

test('a hidden option the field holds stays shown and checked; another hidden one is absent', async () => {
    await mount(SHORT, { value: 'A', hiddenOptions: new Set(['A', 'B']) })
    await expect.element(radio('Name A')).toBeChecked()
    await expect.element(radio('Name B')).not.toBeInTheDocument()
})

test('five visible options and a held hidden one is a radio group, and a pick keeps focus in it', async () => {
    await mountHeld(
        { valueType: 'TEXT', options: options(6) },
        { value: 'F', hiddenOptions: new Set(['F']) }
    )
    await expect
        .element(page.getByRole('radiogroup', { name: LABEL }))
        .toBeVisible()
    await expect.element(radio('Name F')).toBeChecked()
    await userEvent.click(radio('Name B'))
    await expect.element(radio('Name B')).toBeChecked()
    await expect.element(radio('Name B')).toHaveFocus()
    await expect.element(radio('Name F')).not.toBeInTheDocument()
    await expect
        .element(page.getByRole('radiogroup', { name: LABEL }))
        .toBeVisible()
})

test('Clear moves focus to the choice', async () => {
    await mountHeld(SHORT, { value: 'A' })
    await userEvent.click(clear())
    await expect.element(clear()).not.toBeInTheDocument()
    await expect.element(radio('Name A')).toHaveFocus()
})

test('a required radio group says so', async () => {
    await mount(SHORT, { required: true })
    await expect
        .element(page.getByRole('radiogroup', { name: LABEL }))
        .toHaveAttribute('aria-required', 'true')
})

test('a required Yes/No in a form lets the form submit, with a value or without', async () => {
    const submitted = vi.fn()
    const Host = () => {
        const [value, setValue] = useState<string>()
        return (
            <form
                onSubmit={(event) => {
                    event.preventDefault()
                    submitted()
                }}
            >
                <ValueInput
                    field={BOOLEAN}
                    settings={SETTINGS}
                    label={LABEL}
                    value={value}
                    required
                    onChange={(next) => setValue(next ?? undefined)}
                />
                <button type="submit">Submit</button>
            </form>
        )
    }
    await render(<Host />)
    const submit = page.getByRole('button', { name: 'Submit' })
    await expect
        .element(page.getByRole('radiogroup', { name: LABEL }))
        .toHaveAttribute('aria-required', 'true')
    // The radios' form inputs have no name, so each is a group of its own, which a browser following HTML (Firefox)
    // finds missing when unchecked; Chromium does not, so the inputs themselves are checked.
    expect(document.querySelectorAll('input[required]')).toHaveLength(0)
    // The host checks what it needs: the browser does not hold the form back.
    await userEvent.click(submit)
    expect(submitted).toHaveBeenCalledTimes(1)
    await userEvent.click(radio('Yes'))
    await userEvent.click(submit)
    expect(submitted).toHaveBeenCalledTimes(2)
})

test('a read-only radio group and checkbox cannot be changed', async () => {
    const group = await mount(SHORT, { value: 'A', readOnly: 'Locked' })
    await userEvent.click(radio('Name B'), { force: true })
    expect(group).not.toHaveBeenCalled()
    await expect.element(radio('Name A')).toBeChecked()
})

test('a read-only Yes-only box cannot be changed', async () => {
    const onChange = await mount(
        { valueType: 'TRUE_ONLY' },
        { readOnly: 'Locked' }
    )
    await userEvent.click(page.getByRole('checkbox', { name: LABEL }), {
        force: true,
    })
    expect(onChange).not.toHaveBeenCalled()
})
