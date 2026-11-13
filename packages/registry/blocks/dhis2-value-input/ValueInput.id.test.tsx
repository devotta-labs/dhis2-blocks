import { page } from 'vitest/browser'
import { render } from 'vitest-browser-react'
import type { Field } from '@/components/dhis2-value-types'
import { ValueInput } from './ValueInput'
import type { ValueInputProps } from './ValueInput'

const NUMBER: Field = { valueType: 'NUMBER' }
const BOOLEAN: Field = { valueType: 'BOOLEAN' }
const COORDINATE: Field = { valueType: 'COORDINATE' }
const LABEL = 'Temperature'
const multiSelect = (count: number): Field => ({
    valueType: 'MULTI_TEXT',
    options: Array.from({ length: count }, (_, index) => ({
        code: `O${index + 1}`,
        name: `Option ${index + 1}`,
    })),
})

/** A field with the id `given`, as a host that links to or focuses it gives one. */
const mount = async (props: Partial<ValueInputProps>) => {
    const onChange = vi.fn()
    await render(
        <ValueInput
            field={NUMBER}
            settings={{ calendar: 'gregorian', dateFormat: 'YYYY-MM-DD' }}
            label={LABEL}
            value={undefined}
            onChange={onChange}
            id="given"
            {...props}
        />
    )
    return { onChange }
}

test.each([
    ['a typed field', NUMBER, undefined, 'textbox', LABEL],
    [
        'an empty radio group, at its first radio',
        BOOLEAN,
        undefined,
        'radio',
        'Yes',
    ],
    ['a radio group, at its checked radio', BOOLEAN, 'false', 'radio', 'No'],
    [
        'a pop-up field, at its first input',
        COORDINATE,
        undefined,
        'textbox',
        /Latitude/,
    ],
    [
        'a short multi-select, at its first box',
        multiSelect(5),
        undefined,
        'checkbox',
        'Option 1',
    ],
    [
        'a long multi-select, at its combobox',
        multiSelect(6),
        undefined,
        'combobox',
        LABEL,
    ],
] as const)(
    'a host focusing the id given puts focus in %s',
    async (_, field, value, role, name) => {
        const { onChange } = await mount({ field, value })
        document.getElementById('given')?.focus()
        await expect.element(page.getByRole(role, { name })).toHaveFocus()
        // Focus alone picks nothing, in an empty radio group too.
        expect(onChange).not.toHaveBeenCalled()
    }
)

test.each([
    ['a radio group', BOOLEAN, 'radiogroup'],
    ['a pop-up field', COORDINATE, 'group'],
] as const)(
    'the id given is on %s, which the label names',
    async (_, field, role) => {
        await mount({ field })
        expect(document.getElementById('given')).toBe(
            page.getByRole(role, { name: LABEL }).element()
        )
    }
)
