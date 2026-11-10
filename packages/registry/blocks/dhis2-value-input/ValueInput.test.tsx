import { useState } from 'react'
import { page, userEvent } from 'vitest/browser'
import { render } from 'vitest-browser-react'
import type { Field, ValueSettings } from '@/components/dhis2-value-types'
import { popupEditors } from './editors/popupEditors'
import { ValueInput } from './ValueInput'
import type { ValueInputProps } from './ValueInput'

/** Each text an alert says: when it appears, or its text changes. */
const watchAlerts = () => {
    const said: string[] = []
    const seen = new WeakMap<Element, string>()
    const observer = new MutationObserver(() => {
        for (const alert of document.querySelectorAll('[role="alert"]')) {
            const text = alert.textContent ?? ''
            if (text !== '' && seen.get(alert) !== text) {
                said.push(text)
            }
            seen.set(alert, text)
        }
    })
    observer.observe(document.body, {
        childList: true,
        subtree: true,
        characterData: true,
    })
    onTestFinished(() => observer.disconnect())
    return said
}

const NUMBER: Field = { valueType: 'NUMBER' }
const COORDINATE: Field = { valueType: 'COORDINATE' }
const SETTINGS: ValueSettings = {
    calendar: 'gregorian',
    dateFormat: 'YYYY-MM-DD',
}
const LABEL = 'Temperature'

const mount = async (props: Partial<ValueInputProps> = {}) => {
    const onChange = vi.fn()
    const base: ValueInputProps = {
        field: NUMBER,
        settings: SETTINGS,
        label: LABEL,
        value: undefined,
        onChange,
        ...props,
    }
    const screen = await render(<ValueInput {...base} />)
    return {
        onChange,
        input: page.getByRole('textbox', { name: LABEL }),
        rerender: (more: Partial<ValueInputProps>) =>
            screen.rerender(<ValueInput {...base} {...more} />),
    }
}

/**
 * A host that keeps the value and problem it is given, as a form would, and builds its field anew on every render.
 */
const Host = ({
    initial,
    onChange,
}: {
    initial?: string
    onChange?: ValueInputProps['onChange']
}) => {
    const [value, setValue] = useState(initial)
    const [problem, setProblem] = useState<string>()
    return (
        <>
            <ValueInput
                field={{ valueType: 'NUMBER' }}
                settings={SETTINGS}
                label={LABEL}
                value={value}
                onChange={(next, nextProblem) => {
                    onChange?.(next, nextProblem)
                    setValue(next ?? undefined)
                    setProblem(nextProblem?.text)
                }}
            />
            <output>{problem === undefined ? 'Saved' : 'Not saved'}</output>
        </>
    )
}

test('a number is reported when the field is left, not while it is typed', async () => {
    const { input, onChange } = await mount()
    await userEvent.click(input)
    await userEvent.keyboard('12')
    await expect.element(input).toHaveValue('12')
    expect(onChange).not.toHaveBeenCalled()
    await userEvent.keyboard('{Tab}')
    expect(onChange).toHaveBeenCalledExactlyOnceWith('12')
})

test('text that is not a number is reported as a problem, shown and marked invalid', async () => {
    const { input, onChange } = await mount()
    await userEvent.click(input)
    await userEvent.keyboard('1,5{Tab}')
    expect(onChange).toHaveBeenCalledExactlyOnceWith(null, {
        message: 'Use a full stop for decimals',
        text: '1,5',
    })
    await expect
        .element(page.getByText('Use a full stop for decimals'))
        .toBeVisible()
    await expect.element(input).toHaveAttribute('aria-invalid', 'true')
    await expect
        .element(input)
        .toHaveAccessibleDescription('Use a full stop for decimals')
    await expect.element(input).toHaveValue('1,5')
})

test('Enter reports the value before a surrounding form submits', async () => {
    const log: string[] = []
    const Form = () => {
        const [value, setValue] = useState<string>()
        return (
            <form
                onSubmit={(event) => {
                    event.preventDefault()
                    log.push(`submit ${value}`)
                }}
            >
                <ValueInput
                    field={NUMBER}
                    settings={SETTINGS}
                    label={LABEL}
                    value={value}
                    onChange={(next) => {
                        log.push(`change ${next}`)
                        setValue(next ?? undefined)
                    }}
                />
            </form>
        )
    }
    await render(<Form />)
    await userEvent.click(page.getByRole('textbox', { name: LABEL }))
    await userEvent.keyboard('12{Enter}')
    expect(log).toEqual(['change 12', 'submit 12'])
})

test('a button clicked while the field has focus reads the typed value', async () => {
    const saved = vi.fn()
    const Panel = () => {
        const [value, setValue] = useState<string>()
        return (
            <>
                <ValueInput
                    field={NUMBER}
                    settings={SETTINGS}
                    label={LABEL}
                    value={value}
                    onChange={(next) => setValue(next ?? undefined)}
                />
                <button type="button" onClick={() => saved(value)}>
                    Save
                </button>
            </>
        )
    }
    await render(<Panel />)
    await userEvent.click(page.getByRole('textbox', { name: LABEL }))
    await userEvent.keyboard('37')
    await page.getByRole('button', { name: 'Save' }).click()
    expect(saved).toHaveBeenCalledExactlyOnceWith('37')
})

test('the control given another field shows its value, with no text or problem from the one before', async () => {
    const { input, rerender } = await mount({ value: '12' })
    await userEvent.click(input)
    await userEvent.keyboard('{Backspace}{Backspace}abc{Tab}')
    await expect.element(page.getByText('Enter a number')).toBeVisible()

    await rerender({ field: { valueType: 'TEXT' }, value: 'Fever' })
    await expect.element(input).toHaveValue('Fever')
    await expect
        .element(page.getByText('Enter a number'))
        .not.toBeInTheDocument()
    await expect.element(input).not.toHaveAttribute('aria-invalid')
})

test('a value from the host replaces the text; the value just reported does not', async () => {
    const { input, onChange, rerender } = await mount()
    await userEvent.click(input)
    await userEvent.keyboard(' 37 {Tab}')
    expect(onChange).toHaveBeenCalledExactlyOnceWith('37')
    await expect.element(input).toHaveValue('37')

    await rerender({ value: '37' })
    await expect.element(input).toHaveValue('37')
    await rerender({ value: '40' })
    await expect.element(input).toHaveValue('40')
    await rerender({ value: undefined })
    await expect.element(input).toHaveValue('')
    expect(onChange).toHaveBeenCalledTimes(1)
})

test('a host that re-renders with a new field object after a problem keeps the typed text and the problem', async () => {
    const changed = vi.fn()
    await render(<Host onChange={changed} />)
    const input = page.getByRole('textbox', { name: LABEL })
    await userEvent.click(input)
    await userEvent.keyboard('1,5{Tab}')
    expect(changed).toHaveBeenCalledExactlyOnceWith(null, {
        message: 'Use a full stop for decimals',
        text: '1,5',
    })
    await expect.element(page.getByText('Not saved')).toBeVisible()
    await expect.element(input).toHaveValue('1,5')
    await expect
        .element(page.getByText('Use a full stop for decimals'))
        .toBeVisible()
})

test('a host that keeps the last good value and later gives what a problem reported keeps the text; a key resets it', async () => {
    const onChange = vi.fn()
    const field = (key: string, value: string | undefined) => (
        <ValueInput
            key={key}
            field={NUMBER}
            settings={SETTINGS}
            label={LABEL}
            value={value}
            onChange={onChange}
        />
    )
    const screen = await render(field('a', '12'))
    const input = page.getByRole('textbox', { name: LABEL })
    await userEvent.click(input)
    await userEvent.keyboard('{Backspace}{Backspace}abc{Tab}')
    expect(onChange).toHaveBeenCalledExactlyOnceWith(null, {
        message: 'Enter a number',
        text: 'abc',
    })

    // Empty is what the problem reported: the host saying it back.
    await screen.rerender(field('a', undefined))
    await expect.element(input).toHaveValue('abc')
    await expect.element(page.getByText('Enter a number')).toBeVisible()

    await screen.rerender(field('b', undefined))
    await expect.element(input).toHaveValue('')
    await expect
        .element(page.getByText('Enter a number'))
        .not.toBeInTheDocument()
    await expect.element(input).not.toHaveAttribute('aria-invalid')
})

test('a value from the host while a problem shows replaces the text and the problem', async () => {
    const { input, rerender } = await mount({ value: '12' })
    await userEvent.click(input)
    await userEvent.keyboard('{Backspace}{Backspace}abc{Tab}')
    await expect.element(page.getByText('Enter a number')).toBeVisible()

    await rerender({ value: '40' })
    await expect.element(input).toHaveValue('40')
    await expect
        .element(page.getByText('Enter a number'))
        .not.toBeInTheDocument()
})

test('after a problem, a host passing null, as the problem reported it, keeps the typed text and the problem', async () => {
    const { input, rerender } = await mount({ value: '12' })
    await userEvent.click(input)
    await userEvent.keyboard('{Backspace}{Backspace}abc{Tab}')
    await expect.element(page.getByText('Enter a number')).toBeVisible()

    await rerender({ value: null })
    await expect.element(input).toHaveValue('abc')
    await expect.element(page.getByText('Enter a number')).toBeVisible()
})

test('a host that stores the cleared value a problem reports, after an await, keeps the typed text and the problem', async () => {
    const AsyncHost = () => {
        const [value, setValue] = useState<string | undefined>('12')
        return (
            <ValueInput
                field={NUMBER}
                settings={SETTINGS}
                label={LABEL}
                value={value}
                onChange={async (next) => {
                    await new Promise((resolve) => {
                        setTimeout(resolve, 50)
                    })
                    setValue(next ?? undefined)
                }}
            />
        )
    }
    await render(<AsyncHost />)
    const input = page.getByRole('textbox', { name: LABEL })
    await userEvent.click(input)
    await userEvent.keyboard('{Backspace}{Backspace}abc{Tab}')
    await new Promise((resolve) => {
        setTimeout(resolve, 100)
    })
    await expect.element(input).toHaveValue('abc')
    await expect.element(page.getByText('Enter a number')).toBeVisible()
})

test('a host that stores the cleared value a problem reports keeps the typed text and the problem', async () => {
    await render(<Host initial="12" />)
    const input = page.getByRole('textbox', { name: LABEL })
    await userEvent.click(input)
    await userEvent.keyboard('{Backspace}{Backspace}abc{Tab}')
    await expect.element(page.getByText('Not saved')).toBeVisible()
    await expect.element(input).toHaveValue('abc')
    await expect.element(page.getByText('Enter a number')).toBeVisible()
})

test('a host that moves focus on Enter gets one report', async () => {
    const onChange = vi.fn()
    await render(
        // oxlint-disable-next-line jsx-a11y/no-static-element-interactions -- a host's form-wide Enter-to-next-field
        <div
            onKeyDown={(event) => {
                if (event.key === 'Enter') {
                    document.getElementById('next')?.focus()
                }
            }}
        >
            <ValueInput
                field={NUMBER}
                settings={SETTINGS}
                label={LABEL}
                value={undefined}
                onChange={onChange}
            />
            <button id="next" type="button">
                Next
            </button>
        </div>
    )
    await userEvent.click(page.getByRole('textbox', { name: LABEL }))
    await userEvent.keyboard('12{Enter}')
    await expect
        .element(page.getByRole('button', { name: 'Next' }))
        .toHaveFocus()
    expect(onChange).toHaveBeenCalledExactlyOnceWith('12')
})

test('a read-only field can be focused, not edited, and says why', async () => {
    const { input, onChange } = await mount({
        value: '12',
        readOnly: 'Assigned by a rule',
    })
    await userEvent.click(input)
    await expect.element(input).toHaveFocus()
    await userEvent.keyboard('9{Tab}')
    await expect.element(input).toHaveValue('12')
    await expect.element(input).toHaveAttribute('readonly')
    await expect
        .element(input)
        .toHaveAccessibleDescription('Assigned by a rule')
    expect(onChange).not.toHaveBeenCalled()
})

test('a field a rule locks while it is typed in drops the typed text', async () => {
    const { input, onChange, rerender } = await mount({ value: '12' })
    await userEvent.click(input)
    await userEvent.keyboard('3')
    await rerender({ readOnly: 'Assigned by a rule' })
    await expect.element(input).toHaveValue('12')
    await userEvent.keyboard('{Tab}')
    expect(onChange).not.toHaveBeenCalled()
})

test('a required field says so to everyone', async () => {
    const { input } = await mount({ required: true })
    await expect.element(input).toHaveAttribute('aria-required', 'true')
    // The marker is seen, not read: the field says it is required instead.
    await expect
        .element(page.getByRole('textbox', { name: LABEL, exact: true }))
        .toBeInTheDocument()
    await expect
        .element(page.getByText('*', { exact: true }))
        .toHaveAttribute('aria-hidden', 'true')
})

test('messages show under the field and describe it', async () => {
    const { input } = await mount({
        description: 'Under the tongue',
        messages: [
            { tone: 'warning', text: 'Unusually high' },
            { tone: 'error', text: 'Must be below 45' },
        ],
    })
    // The tone is written out, not only coloured.
    await expect
        .element(page.getByText('Warning: Unusually high'))
        .toBeVisible()
    await expect
        .element(page.getByText('Error: Must be below 45'))
        .toBeVisible()
    await expect
        .element(input)
        .toHaveAccessibleDescription(
            'Under the tongue Warning: Unusually high Error: Must be below 45'
        )
    await expect.element(input).toHaveAttribute('aria-invalid', 'true')
})

test('a value type no control edits is shown read-only, with the reason', async () => {
    const value = '{"type":"Point","coordinates":[1,2]}'
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const { input } = await mount({ field: { valueType: 'GEOJSON' }, value })
    await expect.element(input).toHaveValue(value)
    expect(warn).toHaveBeenCalledExactlyOnceWith(
        'formatDhis2Value: unknown value type "GEOJSON", showing the raw value'
    )
    await expect.element(input).toHaveAttribute('readonly')
    await expect
        .element(input)
        .toHaveAccessibleDescription('Edit this field in its own form')
})

test('a field with options shows the option name, checked', async () => {
    await mount({
        field: {
            valueType: 'TEXT',
            options: [
                { code: 'POS', name: 'Positive' },
                { code: 'NEG', name: 'Negative' },
            ],
        },
        value: 'NEG',
    })
    await expect
        .element(page.getByRole('radio', { name: 'Negative' }))
        .toBeChecked()
})

test('after a problem, valid text clears it at once and is reported on leaving', async () => {
    const { input, onChange } = await mount()
    await userEvent.click(input)
    await userEvent.keyboard('1,5{Tab}')
    await expect.element(input).toHaveAttribute('aria-invalid', 'true')

    await userEvent.click(input)
    await userEvent.keyboard('{Backspace}{Backspace}.5')
    await expect
        .element(page.getByText('Use a full stop for decimals'))
        .not.toBeInTheDocument()
    await expect.element(input).not.toHaveAttribute('aria-invalid')
    expect(onChange).toHaveBeenCalledTimes(1)

    await userEvent.keyboard('{Tab}')
    expect(onChange).toHaveBeenCalledTimes(2)
    expect(onChange).toHaveBeenLastCalledWith('1.5')
})

test('a problem is announced once, when it appears', async () => {
    const said = watchAlerts()
    const { input } = await mount()
    await userEvent.click(input)
    await userEvent.keyboard('abc')
    expect(said).toEqual([])
    await userEvent.keyboard('{Tab}')
    await expect.poll(() => said).toEqual(['Enter a number'])

    await userEvent.click(input)
    await userEvent.keyboard('def{Tab}')
    await expect.element(input).toHaveValue('abcdef')
    expect(said).toEqual(['Enter a number'])
})

test('while typing after a problem, the problem stands until fixed and is not replaced', async () => {
    const said = watchAlerts()
    const { input } = await mount()
    await userEvent.click(input)
    await userEvent.keyboard('1,5{Tab}')
    await expect.poll(() => said).toEqual(['Use a full stop for decimals'])

    // Now a different problem, which is only said once committed.
    await userEvent.click(input)
    await userEvent.keyboard('x')
    await expect
        .element(page.getByText('Use a full stop for decimals'))
        .toBeVisible()
    await expect.element(input).toHaveAttribute('aria-invalid', 'true')
    expect(said).toEqual(['Use a full stop for decimals'])

    await userEvent.keyboard('{Tab}')
    await expect
        .poll(() => said)
        .toEqual(['Use a full stop for decimals', 'Enter a number'])
})

test('once the text has been valid, the problem stays hidden until the next commit', async () => {
    const said = watchAlerts()
    const { input } = await mount()
    await userEvent.click(input)
    await userEvent.keyboard('1,5{Tab}')
    await expect.poll(() => said).toEqual(['Use a full stop for decimals'])

    await userEvent.click(input)
    await userEvent.keyboard('{Backspace}{Backspace}')
    await expect.element(input).toHaveValue('1')
    await expect.element(page.getByRole('alert')).not.toBeInTheDocument()
    await userEvent.keyboard('x')
    await expect.element(input).toHaveValue('1x')
    await expect.element(page.getByRole('alert')).not.toBeInTheDocument()
    expect(said).toEqual(['Use a full stop for decimals'])

    await userEvent.keyboard('{Tab}')
    await expect
        .element(page.getByRole('alert'))
        .toHaveTextContent('Enter a number')
    expect(said).toEqual(['Use a full stop for decimals', 'Enter a number'])
})

test('a read-only org unit shows the name the host knows, or "Unknown" and its id', async () => {
    const { input, rerender } = await mount({
        field: { valueType: 'ORGANISATION_UNIT' },
        value: 'DiszpKrYNg8',
        readOnly: 'Assigned by a rule',
    })
    await expect.element(input).toHaveValue('Unknown (DiszpKrYNg8)')
    await rerender({ valueName: 'Ngelehun CHC' })
    await expect.element(input).toHaveValue('Ngelehun CHC')
})

test('a read-only long text shows its value, not a name given for it', async () => {
    const { input } = await mount({
        field: { valueType: 'LONG_TEXT' },
        value: 'Seen',
        valueName: 'Not this',
        readOnly: 'Assigned by a rule',
    })
    await expect.element(input).toHaveValue('Seen')
})

test('a read-only long text shows every line', async () => {
    const { input } = await mount({
        field: { valueType: 'LONG_TEXT' },
        value: 'Seen\nat home',
        readOnly: 'Assigned by a rule',
    })
    await expect.element(input).toHaveValue('Seen\nat home')
    expect(input.element().tagName).toBe('TEXTAREA')
    await expect.element(input).toHaveAttribute('readonly')
    await expect
        .element(input)
        .toHaveAccessibleDescription('Assigned by a rule')
})

test('a pop-up type with no editor registered is shown read-only, with the reason', async () => {
    const editor = popupEditors.COORDINATE
    delete popupEditors.COORDINATE
    onTestFinished(() => {
        popupEditors.COORDINATE = editor
    })
    const { input } = await mount({ field: COORDINATE, value: '[-11.4,8.1]' })
    await expect.element(input).toHaveAttribute('readonly')
    await expect
        .element(input)
        .toHaveAccessibleDescription('Edit this field in its own form')
})
