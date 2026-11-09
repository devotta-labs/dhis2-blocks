import { page, userEvent } from 'vitest/browser'
import { render } from 'vitest-browser-react'
import { parseDhis2Calendar } from '@/components/dhis2-value-display'
import { ValueInput } from '@/components/dhis2-value-input'
import { parseDateFormat } from '@/components/dhis2-value-types'
import type { Field, ValueSettings } from '@/components/dhis2-value-types'
import { Cell } from '../Cell'
import { CELL, HEADER, inputOf, rig } from './harness'

// The grid and a form must not drift: the same typing is the same value, or the same problem, in both.

const SETTINGS: ValueSettings = {
    calendar: parseDhis2Calendar('ethiopian'),
    dateFormat: parseDateFormat('dd-MM-yyyy'),
}
const OPTION_SET = 'an option set'
const DISEASE: Field = {
    valueType: 'TEXT',
    options: [
        'Cholera',
        'Dengue',
        'Malaria',
        'Measles',
        'Polio',
        'Typhoid',
    ].map((name) => ({ code: name.toUpperCase(), name })),
}
const FORM_LABEL = 'In a form'

type Outcome = { value: string | undefined } | { problem: string }
type Row = [Field['valueType'] | typeof OPTION_SET, string, Outcome]

const ROWS: ReadonlyArray<Row> = [
    ['TEXT', 'Fever', { value: 'Fever' }],
    ['NUMBER', '1,5', { problem: 'Use a full stop for decimals' }],
    ['NUMBER', '12', { value: '12' }],
    [
        'INTEGER_POSITIVE',
        '-1',
        { problem: 'Enter a whole number greater than zero' },
    ],
    ['PERCENTAGE', '101', { problem: 'Enter a percentage between 0 and 100' }],
    ['EMAIL', 'nurse.example.org', { problem: 'Enter a valid email address' }],
    ['PHONE_NUMBER', 'call me', { problem: 'Enter a valid phone number' }],
    ['DATE', '04-02-2019', { value: '2026-10-14' }],
    ['DATE', '31-02-2019', { problem: 'Enter a valid date' }],
    ['TIME', '9:30', { value: '09:30' }],
    ['TIME', '25:00', { problem: 'Enter a valid time' }],
    [OPTION_SET, 'Cholera', { value: 'CHOLERA' }],
    [OPTION_SET, 'chol', { value: 'CHOLERA' }],
    [OPTION_SET, 'zzz', { problem: 'Choose one of the options' }],
]

const fieldOf = (type: Row[0]): Field =>
    type === OPTION_SET ? DISEASE : { valueType: type }

const roleOf = (field: Field) =>
    field.options === undefined ? 'textbox' : 'combobox'

/** The same text typed, then Tab, into a grid cell and into a form's control: what each stores or says. */
const typeInBoth = async (type: Row[0], typed: string) => {
    const field = fieldOf(type)
    const setup = rig(field, { settings: SETTINGS })
    const onChange = vi.fn()
    await render(
        <>
            {setup.ui(
                <Cell
                    cellKey={CELL}
                    field={field}
                    labelledBy={HEADER}
                    move={setup.move}
                />
            )}
            <ValueInput
                field={field}
                settings={SETTINGS}
                label={FORM_LABEL}
                value={undefined}
                onChange={onChange}
            />
        </>
    )

    inputOf(page.getByRole(roleOf(field), { name: 'Age (years)' })).focus()
    await userEvent.keyboard(`${typed}{Tab}`)
    const cell = setup.stored()
    const inGrid: Outcome =
        cell?.error === undefined
            ? { value: cell?.value }
            : { problem: cell.error }

    await userEvent.click(page.getByRole(roleOf(field), { name: FORM_LABEL }))
    await userEvent.keyboard(`${typed}{Tab}`)
    expect(onChange).toHaveBeenCalledOnce()
    const [value, problem] = onChange.mock.calls[0] ?? []
    const inForm: Outcome =
        problem === undefined
            ? { value: value ?? undefined }
            : { problem: problem.message }
    return { inGrid, inForm }
}

test.each(ROWS)(
    '%s typed as %j: the grid and a form agree',
    async (type, typed, expected) => {
        const { inGrid, inForm } = await typeInBoth(type, typed)
        expect(inGrid).toEqual(expected)
        expect(inForm).toEqual(expected)
    }
)
