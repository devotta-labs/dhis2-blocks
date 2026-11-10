import { CustomDataProvider } from '@dhis2/app-runtime'
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
const HIDDEN_OPTION = 'an option set with Polio hidden'
const MASKED = 'a text with a field mask'
const DISEASE: Field = {
    valueType: 'TEXT',
    options: [
        'Cholera',
        'Dengue',
        'Malaria',
        'Measles',
        'Polio',
        'Typhoid',
        'Yellow fever',
    ].map((name) => ({ code: name.toUpperCase(), name })),
}
const HIDDEN = new Set(['POLIO'])
const FORM_LABEL = 'In a form'

type Outcome = { value: string | undefined } | { problem: string }
type Row = [
    (
        | Field['valueType']
        | typeof OPTION_SET
        | typeof HIDDEN_OPTION
        | typeof MASKED
    ),
    string,
    Outcome,
]

const ROWS: ReadonlyArray<Row> = [
    ['TEXT', 'Fever', { value: 'Fever' }],
    ['NUMBER', '1,5', { problem: 'Use a full stop for decimals' }],
    ['NUMBER', '12', { value: '12' }],
    [
        'INTEGER_POSITIVE',
        '-1',
        { problem: 'Enter a whole number greater than zero' },
    ],
    ['INTEGER', '-7', { value: '-7' }],
    ['INTEGER', '1.5', { problem: 'Enter a whole number' }],
    [
        'INTEGER_NEGATIVE',
        '5',
        { problem: 'Enter a whole number less than zero' },
    ],
    ['INTEGER_ZERO_OR_POSITIVE', '0', { value: '0' }],
    [
        'INTEGER_ZERO_OR_POSITIVE',
        '-1',
        { problem: 'Enter a whole number of zero or more' },
    ],
    ['PERCENTAGE', '101', { problem: 'Enter a percentage between 0 and 100' }],
    ['UNIT_INTERVAL', '0.25', { value: '0.25' }],
    ['UNIT_INTERVAL', '1.5', { problem: 'Enter a number between 0 and 1' }],
    ['URL', 'https://dhis2.org', { value: 'https://dhis2.org' }],
    ['URL', 'dhis2 dot org', { problem: 'Enter a valid URL' }],
    ['LETTER', 'b', { value: 'b' }],
    ['LETTER', 'ab', { problem: 'Enter a single letter' }],
    ['EMAIL', 'nurse.example.org', { problem: 'Enter a valid email address' }],
    ['PHONE_NUMBER', 'call me', { problem: 'Enter a valid phone number' }],
    ['DATE', '04-02-2019', { value: '2026-10-14' }],
    ['DATE', '31-02-2019', { problem: 'Enter a valid date' }],
    ['DATETIME', '04-02-2019 14:30', { value: '2026-10-14T14:30' }],
    [
        'DATETIME',
        '04-02-2019 25:00',
        { problem: 'Enter a valid date and time' },
    ],
    ['TIME', '9:30', { value: '09:30' }],
    ['TIME', '25:00', { problem: 'Enter a valid time' }],
    [OPTION_SET, 'Cholera', { value: 'CHOLERA' }],
    [OPTION_SET, 'chol', { value: 'CHOLERA' }],
    [OPTION_SET, 'zzz', { problem: 'Choose one of the options' }],
    [HIDDEN_OPTION, 'Polio', { problem: 'Choose one of the options' }],
    [HIDDEN_OPTION, 'Dengue', { value: 'DENGUE' }],
    [MASKED, '12-A', { value: '12-A' }],
    [MASKED, '12-a', { problem: 'Enter a value in the required format' }],
]

const fieldOf = (type: Row[0]): Field => {
    if (type === OPTION_SET || type === HIDDEN_OPTION) {
        return DISEASE
    }
    return type === MASKED
        ? { valueType: 'TEXT', fieldMask: '\\d\\d-\\X' }
        : { valueType: type }
}

const roleOf = (field: Field) =>
    field.options === undefined ? 'textbox' : 'combobox'

/** The same text typed, then Tab, into a grid cell and into a form's control: what each stores or says. */
const typeInBoth = async (type: Row[0], typed: string) => {
    const field = fieldOf(type)
    const hiddenOptions = type === HIDDEN_OPTION ? HIDDEN : undefined
    const setup = rig(field, {
        settings: SETTINGS,
        effects: hiddenOptions && { hiddenOptions },
    })
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
                hiddenOptions={hiddenOptions}
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

const CHC = 'DiszpKrYNg8'
/** A server whose org units start "Ngelehun". */
const ORG_UNITS = {
    organisationUnits: async () => ({
        pager: { total: 2 },
        organisationUnits: [
            { id: CHC, displayName: 'Ngelehun CHC', ancestors: [] },
            { id: 'FwKJ7gYEv8U', displayName: 'Ngelehun MCHP', ancestors: [] },
        ],
    }),
}

test('an org unit searched for and picked with Tab: the grid and a form agree', async () => {
    const field: Field = { valueType: 'ORGANISATION_UNIT' }
    const setup = rig(field, { data: ORG_UNITS })
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
            <CustomDataProvider data={ORG_UNITS}>
                <ValueInput
                    field={field}
                    settings={SETTINGS}
                    label={FORM_LABEL}
                    value={undefined}
                    onChange={onChange}
                />
            </CustomDataProvider>
        </>
    )
    const top = page.getByRole('option', { name: /Ngelehun CHC/ })

    inputOf(page.getByRole('combobox', { name: 'Age (years)' })).focus()
    await userEvent.keyboard('Ng')
    await expect.element(top).toHaveAttribute('aria-selected', 'true')
    await userEvent.keyboard('{Tab}')
    expect(setup.stored()?.value).toBe(CHC)

    await userEvent.click(page.getByRole('combobox', { name: FORM_LABEL }))
    await userEvent.keyboard('Ng')
    await expect.element(top).toHaveAttribute('data-highlighted')
    await userEvent.keyboard('{Tab}')
    expect(onChange.mock.calls).toEqual([[CHC]])
})
