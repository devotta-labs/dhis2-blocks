import { page, userEvent } from 'vitest/browser'
import type { FieldModel } from '../../model/buildFormModel'
import {
    baseField,
    blur,
    found,
    manyChoices,
    mountField,
    textbox,
    yesNo,
    type Commit,
    type MountOptions,
} from './fieldTestSupport'

const mount = (fields: FieldModel | FieldModel[], options?: MountOptions) =>
    mountField(vi.fn<Commit>(), fields, options)

describe('text fields', () => {
    it('typing does not commit until blur', async () => {
        const { commit } = await mount(baseField())
        await userEvent.fill(textbox(), 'hello')
        expect(commit).not.toHaveBeenCalled()
        await userEvent.tab()
        expect(commit).toHaveBeenCalledTimes(1)
        expect(commit).toHaveBeenCalledWith('f1', 'hello')
    })

    it('Enter commits and clearing commits undefined', async () => {
        const { commit } = await mount(baseField({ value: 'old' }))
        await userEvent.fill(textbox(), 'new')
        await userEvent.keyboard('{Enter}')
        expect(commit).toHaveBeenLastCalledWith('f1', 'new')
        await userEvent.fill(textbox(), '')
        await userEvent.tab()
        expect(commit).toHaveBeenLastCalledWith('f1', undefined)
    })

    it('whitespace-only text is empty: it commits undefined, or nothing if already empty', async () => {
        const { commit } = await mount(baseField({ value: 'old' }))
        await userEvent.fill(textbox(), '   ')
        await userEvent.tab()
        expect(commit).toHaveBeenCalledTimes(1)
        expect(commit).toHaveBeenLastCalledWith('f1', undefined)
        await userEvent.fill(textbox(), '  ')
        await userEvent.tab()
        expect(commit).toHaveBeenCalledTimes(1)
    })

    it('does not commit when the text did not change', async () => {
        const { commit } = await mount(baseField({ value: 'same' }))
        await textbox().click()
        await userEvent.tab()
        expect(commit).not.toHaveBeenCalled()
    })

    it('passes the input mode to the input', async () => {
        await mount(baseField({ kind: 'text', inputMode: 'email' }))
        await expect.element(textbox()).toHaveAttribute('inputmode', 'email')
    })

    it('long text commits on blur and Enter adds a line', async () => {
        const { commit } = await mount(baseField({ kind: 'longText' }))
        const area = page.getByRole('textbox', { name: 'Field one' })
        await userEvent.fill(area, 'one')
        await userEvent.keyboard('{Enter}two')
        expect(commit).not.toHaveBeenCalled()
        await userEvent.tab()
        expect(commit).toHaveBeenCalledWith('f1', 'one\ntwo')
    })
})

describe('number fields', () => {
    it('shows an error and commits nothing for an unfinished number', async () => {
        const { commit } = await mount(
            baseField({ kind: 'number', inputMode: 'decimal' })
        )
        await userEvent.fill(textbox(), '12.')
        await userEvent.tab()
        expect(commit).not.toHaveBeenCalled()
        await expect.element(page.getByText('Enter a number')).toBeVisible()
        await expect.element(textbox()).toBeInvalid()
    })

    it('commits a finished number as a string', async () => {
        const { commit } = await mount(
            baseField({ kind: 'number', inputMode: 'decimal' })
        )
        await userEvent.fill(textbox(), '12')
        await userEvent.tab()
        expect(commit).toHaveBeenCalledWith('f1', '12')
        await userEvent.fill(textbox(), '-0.5e3')
        await userEvent.tab()
        expect(commit).toHaveBeenLastCalledWith('f1', '-0.5e3')
    })

    it('asks for a whole number when the type is an integer', async () => {
        const { commit } = await mount(
            baseField({ kind: 'number', inputMode: 'numeric' })
        )
        await userEvent.fill(textbox(), '1.5')
        await userEvent.tab()
        expect(commit).not.toHaveBeenCalled()
        await expect
            .element(page.getByText('Enter a whole number'))
            .toBeVisible()
    })

    it('clears the local error when the text is corrected', async () => {
        const { commit } = await mount(
            baseField({ kind: 'number', inputMode: 'decimal' })
        )
        await userEvent.fill(textbox(), 'abc')
        await userEvent.tab()
        await expect.element(page.getByText('Enter a number')).toBeVisible()
        await userEvent.fill(textbox(), '7')
        await userEvent.tab()
        expect(commit).toHaveBeenCalledWith('f1', '7')
        await expect
            .element(page.getByText('Enter a number'))
            .not.toBeInTheDocument()
    })

    it('commits undefined when a number is cleared', async () => {
        const { commit } = await mount(
            baseField({ kind: 'number', inputMode: 'numeric', value: '4' })
        )
        await userEvent.fill(textbox(), '')
        await userEvent.tab()
        expect(commit).toHaveBeenCalledWith('f1', undefined)
    })
})

describe('choice fields', () => {
    it('Yes commits true and clicking it again commits undefined', async () => {
        const { commit } = await mount(
            baseField({ kind: 'choice', choices: yesNo })
        )
        const yes = page.getByRole('button', { name: 'Yes' })
        await yes.click()
        expect(commit).toHaveBeenLastCalledWith('f1', 'true')
        await expect.element(yes).toHaveAttribute('aria-pressed', 'true')
        await yes.click()
        expect(commit).toHaveBeenLastCalledWith('f1', undefined)
        await expect.element(yes).toHaveAttribute('aria-pressed', 'false')
    })

    it('choosing the other answer replaces the first', async () => {
        const { commit } = await mount(
            baseField({ kind: 'choice', choices: yesNo, value: 'true' })
        )
        await page.getByRole('button', { name: 'No' }).click()
        expect(commit).toHaveBeenLastCalledWith('f1', 'false')
    })

    it('labels the group with the field label', async () => {
        await mount(baseField({ kind: 'choice', choices: yesNo }))
        await expect
            .element(page.getByRole('group', { name: 'Field one' }).first())
            .toBeVisible()
    })

    it.each(['vertical', 'horizontal'] as const)(
        'shows %s radio buttons and commits the chosen code',
        async (layout) => {
            const { commit } = await mount(
                baseField({
                    kind: 'choice',
                    radioLayout: layout,
                    choices: [
                        { value: 'a', label: 'Alpha' },
                        { value: 'b', label: 'Beta' },
                    ],
                })
            )
            const group = page.getByRole('radiogroup', { name: 'Field one' })
            await expect.element(group).toBeVisible()
            await expect
                .element(group)
                .toHaveAttribute('data-orientation', layout)
            await page.getByRole('radio', { name: 'Beta' }).click()
            expect(commit).toHaveBeenCalledWith('f1', 'b')
        }
    )

    it('a radio choice is cleared with the clear button', async () => {
        const { commit } = await mount(
            baseField({
                kind: 'choice',
                radioLayout: 'vertical',
                value: 'a',
                choices: [
                    { value: 'a', label: 'Alpha' },
                    { value: 'b', label: 'Beta' },
                ],
            })
        )
        await expect
            .element(page.getByRole('radio', { name: 'Alpha' }))
            .toBeChecked()
        await page.getByRole('button', { name: 'Clear' }).click()
        expect(commit).toHaveBeenCalledWith('f1', undefined)
    })

    it('a selected value outside the options stays visible', async () => {
        await mount(
            baseField({
                kind: 'choice',
                value: 'old',
                choices: [
                    { value: 'a', label: 'Alpha' },
                    { value: 'old', label: 'Retired' },
                ],
            })
        )
        await expect
            .element(page.getByRole('button', { name: 'Retired' }))
            .toHaveAttribute('aria-pressed', 'true')
    })
})

describe('select fields', () => {
    it('picks an option from the dropdown', async () => {
        const { commit } = await mount(
            baseField({ kind: 'select', choices: manyChoices })
        )
        await page.getByRole('combobox', { name: 'Field one' }).click()
        await page.getByRole('option', { name: 'Option C' }).click()
        expect(commit).toHaveBeenCalledWith('f1', 'c')
    })

    it('shows the label of the selected option and can clear it', async () => {
        const { commit } = await mount(
            baseField({ kind: 'select', choices: manyChoices, value: 'b' })
        )
        await expect
            .element(page.getByRole('combobox', { name: 'Field one' }))
            .toHaveTextContent('Option B')
        await page.getByRole('button', { name: 'Clear' }).click()
        expect(commit).toHaveBeenCalledWith('f1', undefined)
    })

    it('shows many options as radio buttons when the stage asks for them', async () => {
        const { commit } = await mount(
            baseField({
                kind: 'select',
                radioLayout: 'horizontal',
                choices: manyChoices,
            })
        )
        await page.getByRole('radio', { name: 'Option F' }).click()
        expect(commit).toHaveBeenCalledWith('f1', 'f')
    })
})

describe('multi-select fields', () => {
    const multi = (value?: string) =>
        baseField({
            kind: 'multiSelect',
            choices: manyChoices,
            ...(value !== undefined && { value }),
        })

    it('picks several options and commits comma separated codes', async () => {
        const { commit } = await mount(multi())
        const box = page.getByRole('combobox', { name: 'Field one' })
        await box.click()
        await page.getByRole('option', { name: 'Option C' }).click()
        expect(commit).toHaveBeenLastCalledWith('f1', 'c')
        await page.getByRole('option', { name: 'Option A' }).click()
        expect(commit).toHaveBeenLastCalledWith('f1', 'a,c')
    })

    it('removing a chip commits the rest, and the last removal commits undefined', async () => {
        const { commit } = await mount(multi('a,c'))
        await page.getByRole('button', { name: 'Remove Option A' }).click()
        expect(commit).toHaveBeenLastCalledWith('f1', 'c')
        await page.getByRole('button', { name: 'Remove Option C' }).click()
        expect(commit).toHaveBeenLastCalledWith('f1', undefined)
    })
})

describe('true-only fields', () => {
    it('checking commits true and unchecking commits undefined', async () => {
        const { commit } = await mount(baseField({ kind: 'trueOnly' }))
        const box = page.getByRole('checkbox', { name: 'Field one' })
        await box.click()
        expect(commit).toHaveBeenLastCalledWith('f1', 'true')
        await expect.element(box).toBeChecked()
        await box.click()
        expect(commit).toHaveBeenLastCalledWith('f1', undefined)
    })
})

describe('time fields', () => {
    it('commits on change and clearing commits undefined', async () => {
        const { commit, screen } = await mount(baseField({ kind: 'time' }))
        const input = screen.container.querySelector('input[type="time"]')
        expect(input).not.toBeNull()
        const locator = page.elementLocator(found(input))
        await userEvent.fill(locator, '14:30')
        expect(commit).toHaveBeenLastCalledWith('f1', '14:30')
        await userEvent.clear(locator)
        expect(commit).toHaveBeenLastCalledWith('f1', undefined)
    })
})

describe('coordinate fields', () => {
    const lat = () => page.getByRole('textbox', { name: 'Latitude' })
    const lng = () => page.getByRole('textbox', { name: 'Longitude' })

    it('commits [longitude,latitude] once both are set', async () => {
        const { commit } = await mount(baseField({ kind: 'coordinate' }))
        await userEvent.fill(lat(), '8.4657')
        await userEvent.tab()
        expect(commit).not.toHaveBeenCalled()
        await userEvent.fill(lng(), '-13.2317')
        await userEvent.tab()
        expect(commit).toHaveBeenCalledWith('f1', '[-13.2317,8.4657]')
    })

    it('names the missing part', async () => {
        const { commit } = await mount(baseField({ kind: 'coordinate' }))
        await userEvent.fill(lat(), '8.4657')
        await userEvent.tab()
        await userEvent.tab()
        expect(commit).not.toHaveBeenCalled()
        await expect.element(page.getByText('Enter a longitude')).toBeVisible()
    })

    it('rejects a latitude out of range', async () => {
        const { commit } = await mount(baseField({ kind: 'coordinate' }))
        await userEvent.fill(lng(), '10')
        await userEvent.fill(lat(), '91')
        await blur()
        expect(commit).not.toHaveBeenCalled()
        await expect
            .element(page.getByText('Enter a latitude between -90 and 90'))
            .toBeVisible()
    })

    it('shows a stored coordinate and clearing both commits undefined', async () => {
        const { commit } = await mount(
            baseField({ kind: 'coordinate', value: '[-13.2317,8.4657]' })
        )
        await expect.element(lat()).toHaveValue('8.4657')
        await expect.element(lng()).toHaveValue('-13.2317')
        await userEvent.fill(lat(), '')
        await userEvent.fill(lng(), '')
        await userEvent.tab()
        expect(commit).toHaveBeenLastCalledWith('f1', undefined)
    })
})
