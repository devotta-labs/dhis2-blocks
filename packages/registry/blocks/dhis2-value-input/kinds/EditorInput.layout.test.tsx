import { CustomDataProvider } from '@dhis2/app-runtime'
import { page, userEvent } from 'vitest/browser'
import { render } from 'vitest-browser-react'
import { ageFromBirth, todayIso } from '@/components/dhis2-value-types'
import type { Field, ValueSettings } from '@/components/dhis2-value-types'
import { ValueInput } from '../ValueInput'
import type { ValueInputProps } from '../ValueInput'

const SETTINGS: ValueSettings = {
    calendar: 'gregorian',
    dateFormat: 'YYYY-MM-DD',
}
const LABEL = 'Notes'

/**
 * A pop-up field in a form, with a button after it to leave the field for. `submits` has, for each time the form
 * submitted, how many changes were reported by then.
 */
const mount = async (field: Field, props: Partial<ValueInputProps> = {}) => {
    const onChange = vi.fn()
    const submits: number[] = []
    await render(
        <CustomDataProvider data={{}}>
            <form
                onSubmit={(event) => {
                    event.preventDefault()
                    submits.push(onChange.mock.calls.length)
                }}
            >
                <ValueInput
                    field={field}
                    settings={SETTINGS}
                    label={LABEL}
                    value={undefined}
                    onChange={onChange}
                    {...props}
                />
                <button type="button">After</button>
                <button type="submit">Submit</button>
            </form>
        </CustomDataProvider>
    )
    return {
        onChange,
        submits,
        leave: () => page.getByRole('button', { name: 'After' }).click(),
    }
}

/** The box drawn around a textbox: its own, or the input group's it sits in. */
const box = (name: string) => {
    const input = page.getByRole('textbox', { name }).element()
    return (
        input.closest('[data-slot=input-group]') ?? input
    ).getBoundingClientRect()
}

test("an age's and a coordinate's fields are as tall as a typed field", async () => {
    await render(
        <CustomDataProvider data={{}}>
            <ValueInput
                field={{ valueType: 'NUMBER' }}
                settings={SETTINGS}
                label="Weight"
                value={undefined}
                onChange={() => undefined}
            />
            <ValueInput
                field={{ valueType: 'AGE' }}
                settings={SETTINGS}
                label="Age"
                value={undefined}
                onChange={() => undefined}
            />
            <ValueInput
                field={{ valueType: 'COORDINATE' }}
                settings={SETTINGS}
                label="Location"
                value={undefined}
                onChange={() => undefined}
            />
        </CustomDataProvider>
    )
    const typed = box('Weight').height
    for (const name of ['Date of birth', 'Years', 'Days', 'Latitude']) {
        expect(box(name).height).toBe(typed)
    }
})

test("an age's date of birth, years, months and days sit on one row when there is room", async () => {
    const { innerWidth, innerHeight } = window
    await page.viewport(800, 600)
    onTestFinished(() => page.viewport(innerWidth, innerHeight))
    await mount({ valueType: 'AGE' })
    const tops = ['Date of birth', 'Years', 'Months', 'Days'].map(
        (name) => box(name).top
    )
    expect(new Set(tops).size).toBe(1)
    expect(box('Years').width).toBeLessThan(box('Date of birth').width)
})

test("an age's years, months and days stay on one row when the date of birth has no room beside them", async () => {
    const { innerWidth, innerHeight } = window
    await page.viewport(360, 600)
    onTestFinished(() => page.viewport(innerWidth, innerHeight))
    await mount({ valueType: 'AGE' })
    const tops = ['Years', 'Months', 'Days'].map((name) => box(name).top)
    expect(new Set(tops).size).toBe(1)
    expect(tops[0]).toBeGreaterThan(box('Date of birth').bottom)
})

test("an age's date of birth says its format under it, not as a placeholder", async () => {
    await mount({ valueType: 'AGE' })
    const birth = page.getByRole('textbox', { name: 'Date of birth' })
    await expect
        .element(birth)
        .toHaveAccessibleDescription('Date format: YYYY-MM-DD')
    await expect.element(birth).not.toHaveAttribute('placeholder')
})

test('a day picked for the date of birth fills it and the age, and is reported when the field is left', async () => {
    const { onChange, leave } = await mount(
        { valueType: 'AGE' },
        { value: '2020-03-14' }
    )
    await userEvent.click(page.getByRole('button', { name: 'Choose date' }))
    await userEvent.click(
        page.getByRole('button', { name: '12 March 2020', exact: true })
    )
    const birth = page.getByRole('textbox', { name: 'Date of birth' })
    await expect.element(birth).toHaveValue('2020-03-12')
    await expect.element(birth).toHaveFocus()
    await expect
        .element(page.getByRole('textbox', { name: 'Years' }))
        .toHaveValue(String(ageFromBirth('2020-03-12', todayIso()).years))

    await leave()
    expect(onChange.mock.calls.at(-1)).toEqual(['2020-03-12', undefined])
})

test("a coordinate's latitude and longitude sit side by side, each narrow", async () => {
    await mount({ valueType: 'COORDINATE' })
    expect(box('Latitude').top).toBe(box('Longitude').top)
    expect(box('Latitude').width).toBeLessThanOrEqual(160)
})

test('a multi-select of five options is a list of boxes, with "Clear all" once one is ticked', async () => {
    await mount({
        valueType: 'MULTI_TEXT',
        options: Array.from({ length: 5 }, (_, index) => ({
            code: `O${index + 1}`,
            name: `Option ${index + 1}`,
        })),
    })
    await expect
        .element(page.getByRole('checkbox', { name: 'Option 5' }))
        .toBeVisible()
    expect(page.getByRole('searchbox').elements()).toEqual([])
    expect(page.getByRole('combobox').elements()).toEqual([])
    const clear = page.getByRole('button', { name: 'Clear all' })
    await expect.element(clear).not.toBeInTheDocument()

    await userEvent.click(page.getByRole('checkbox', { name: 'Option 2' }))
    await expect.element(clear).toBeVisible()
})

const SIX: Field = {
    valueType: 'MULTI_TEXT',
    options: Array.from({ length: 6 }, (_, index) => ({
        code: `O${index + 1}`,
        name: `Option ${index + 1}`,
    })),
}

test('a multi-select of six options is a combobox: a pick adds a chip, a removed chip is reported on leaving', async () => {
    const { onChange, leave } = await mount(SIX, { value: 'O1' })
    expect(page.getByRole('checkbox').elements()).toEqual([])
    const search = page.getByRole('combobox', { name: LABEL })
    await userEvent.click(search)
    await userEvent.keyboard('O4')
    await userEvent.click(page.getByRole('option', { name: 'Option 4' }))
    await expect.element(page.getByText('Option 4')).toBeVisible()
    expect(onChange).not.toHaveBeenCalled()

    await leave()
    expect(onChange.mock.calls).toEqual([['O1,O4', undefined]])

    await userEvent.click(page.getByRole('button', { name: 'Remove Option 1' }))
    await expect.element(page.getByText('Option 1')).not.toBeInTheDocument()
    await leave()
    expect(onChange.mock.calls.at(-1)).toEqual(['O4', undefined])
})

test('a multi-select of six options with one hidden is five boxes, without the hidden one', async () => {
    await mount(SIX, { hiddenOptions: new Set(['O6']) })
    await expect
        .element(page.getByRole('checkbox', { name: 'Option 5' }))
        .toBeVisible()
    expect(page.getByRole('checkbox').elements()).toHaveLength(5)
})

test('Enter on a highlighted option of a long multi-select picks it, without submitting the form', async () => {
    const { onChange, submits, leave } = await mount(SIX)
    const search = page.getByRole('combobox', { name: LABEL })
    await userEvent.click(search)
    await userEvent.keyboard('Option 3{Enter}')
    await expect
        .element(page.getByRole('button', { name: 'Remove Option 3' }))
        .toBeVisible()
    expect(submits).toEqual([])
    await leave()
    expect(onChange.mock.calls).toEqual([['O3', undefined]])

    await userEvent.click(page.getByRole('button', { name: 'Clear all' }))
    expect(onChange.mock.calls.at(-1)).toEqual([null, undefined])
    await expect.element(search).toHaveFocus()
})
