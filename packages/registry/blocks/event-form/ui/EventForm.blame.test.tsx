import { page, userEvent } from 'vitest/browser'
import { liveRegion } from '../../../test/liveRegion'
import { CHILD_VISIT, RULES_CHANGED_VISIT } from '../test/childVisit'
import { editable, recorded, renderForm } from '../test/serve'
import type { EventFormProps } from './EventForm'

const open = async (props: Partial<EventFormProps> = {}, served = {}) => {
    const server = await renderForm(served, { blame: undefined, ...props })
    await editable()
    return server
}

const textbox = (name: string) => page.getByRole('textbox', { name })
const button = (name: string) => page.getByRole('button', { name })
const radio = (name: string) => page.getByRole('radio', { name, exact: true })

const enter = async (label: string, text: string) => {
    await userEvent.click(textbox(label))
    await userEvent.keyboard(`${text}{Tab}`)
}

test('a field a rule set, required or gave fewer options has one marker beside its label, saying the main effect', async () => {
    await open()
    await enter('Weight (kg)', '150')
    await expect
        .element(button('Set automatically, Paracetamol dose (mg): why'))
        .toBeVisible()
    await expect
        .element(button('Set automatically, Daily total (mg): why'))
        .toBeVisible()
    await enter('Temperature (°C)', '39')
    await expect
        .element(button('Required here, Malaria test: why'))
        .toBeVisible()
    expect(
        page.getByRole('button', { name: /Malaria test: why$/ }).all()
    ).toHaveLength(1)
    await userEvent.tripleClick(textbox('Weight (kg)'))
    await userEvent.keyboard('2{Tab}')
    await expect.element(button('Fewer options, Outcome: why')).toBeVisible()
    expect(page.getByRole('button', { name: /^Why\?/ }).query()).toBeNull()
})

test('a field the rules only give messages has no marker; the messages show under it, without the rule', async () => {
    await open()
    await enter('Weight (kg)', '150')
    await enter('Temperature (°C)', '39')
    await expect
        .element(
            page.getByText('Warning: Fever: test for malaria', { exact: true })
        )
        .toBeVisible()
    await expect
        .element(
            page.getByText(
                'On completing: Check the weight: over 100 kg for a child',
                { exact: true }
            )
        )
        .toBeVisible()
    expect(
        page.getByRole('button', { name: /Temperature \(°C\): why$/ }).query()
    ).toBeNull()
    expect(
        page.getByRole('button', { name: /Weight \(kg\): why$/ }).query()
    ).toBeNull()
    expect(page.getByText(/^Required by rule/).query()).toBeNull()
    expect(page.getByText(/^Some options removed/).query()).toBeNull()
    await expect
        .poll(() => liveRegion().textContent)
        .toBe('Malaria test required.')
})

test('the marker says why in words, names the rule, shows its condition on request, and leads to an answer it read', async () => {
    await open()
    await enter('Weight (kg)', '150')
    const marker = button('Set automatically, Paracetamol dose (mg): why')
    await expect.element(marker).toHaveAttribute('aria-expanded', 'false')
    await userEvent.click(marker)
    await expect.element(marker).toHaveAttribute('aria-expanded', 'true')
    const dialog = page.getByRole('dialog')
    await expect
        .element(dialog.getByText('Set to 300 because Weight (kg) is 150.'))
        .toBeVisible()
    await expect
        .element(dialog.getByText('Rule: Paracetamol dose'))
        .toBeVisible()
    const showRule = dialog.getByRole('button', { name: 'Show rule' })
    await expect.element(showRule).toHaveAttribute('aria-expanded', 'false')
    const condition = dialog.getByText('d2:hasValue(#{weight})')
    await expect.element(condition).not.toBeVisible()
    await userEvent.click(showRule)
    await expect.element(showRule).toHaveAttribute('aria-expanded', 'true')
    await expect.element(condition).toBeVisible()
    expect(condition.element().tagName).toBe('CODE')
    await userEvent.click(
        dialog.getByRole('button', { name: 'Weight (kg): 150' })
    )
    await expect.element(page.getByRole('dialog')).not.toBeInTheDocument()
    await expect.element(textbox('Weight (kg)')).toHaveFocus()
})

test('a set field is read-only, its reason in its description, and Tab passes it for its marker', async () => {
    await open()
    await enter('Weight (kg)', '150')
    const dose = textbox('Paracetamol dose (mg)')
    await expect.element(dose).toHaveAttribute('readonly')
    await expect
        .element(dose)
        .toHaveAccessibleDescription(
            'Set by rule "Paracetamol dose" because Weight (kg) is 150'
        )
    await expect
        .element(page.getByText(/^Set by rule "Paracetamol dose"/))
        .toHaveClass('sr-only')
    await expect
        .element(textbox('Daily total (mg)'))
        .toHaveAccessibleDescription(
            'Set by rule "Daily total" because Paracetamol dose (mg) is 300'
        )
    await userEvent.click(textbox('Temperature (°C)'))
    await userEvent.keyboard('{Tab}')
    await expect
        .element(button('Set automatically, Paracetamol dose (mg): why'))
        .toHaveFocus()
    await userEvent.keyboard('{Tab}')
    await expect
        .element(button('Set automatically, Daily total (mg): why'))
        .toHaveFocus()
})

test('a field hidden by a rule is listed, closed until pressed, at the end of its section', async () => {
    await open()
    await userEvent.click(radio('Male'))
    const disclosure = button('1 question hidden by rules')
    await expect.element(disclosure).toHaveAttribute('aria-expanded', 'false')
    const line =
        'Pregnant: hidden by rule "Hide pregnancy for men" because Sex is Male'
    await expect.element(page.getByText(line)).not.toBeVisible()
    await userEvent.click(disclosure)
    await expect.element(disclosure).toHaveAttribute('aria-expanded', 'true')
    await expect.element(page.getByText(line)).toBeVisible()
    await expect.element(button('Why? Pregnant')).toBeVisible()
    await expect.poll(() => liveRegion().textContent).toBe('Pregnant hidden.')
})

test('a field shown again is not marked, and its showing is said', async () => {
    await open()
    await userEvent.click(radio('Male'))
    await expect.element(radio('Yes')).not.toBeInTheDocument()
    await userEvent.click(radio('Female'))
    await expect.element(radio('Yes')).toBeVisible()
    expect(
        page.getByRole('button', { name: /Pregnant: why$/ }).query()
    ).toBeNull()
    await expect.poll(() => liveRegion().textContent).toBe('Pregnant shown.')
})

test('a stored answer a rule hides leaves its list closed until pressed', async () => {
    await open({ eventId: CHILD_VISIT.eventId }, { event: RULES_CHANGED_VISIT })
    await expect
        .element(
            page
                .getByRole('group', { name: 'Assessment' })
                .getByRole('button', { name: '1 question hidden by rules' })
        )
        .toHaveAttribute('aria-expanded', 'false')
})

test('a hidden answer a rule sets is saved, so the line does not call it lost', async () => {
    const { to } = await open({ eventId: CHILD_VISIT.eventId })
    await userEvent.click(radio('Male'))
    await userEvent.click(button('1 question hidden by rules'))
    await expect
        .element(page.getByText(/^Pregnant: hidden by rule/))
        .not.toHaveTextContent(/not saved/)
    await button('Save').click()
    await expect.poll(() => to('tracker')).toHaveLength(1)
    // SAFETY: the form sends one event in a tracker import.
    const [event] = (
        to('tracker')[0].data as {
            events: [{ dataValues: Array<{ dataElement: string }> }]
        }
    ).events
    expect(event.dataValues).toContainEqual({
        dataElement: 'labPregnant',
        value: 'false',
    })
})

test('a section hidden by a rule is one line in its place', async () => {
    await open()
    const disclosure = button('"Follow-up" hidden by rules')
    await expect.element(disclosure).toHaveAttribute('aria-expanded', 'false')
    await userEvent.click(disclosure)
    await expect
        .element(
            page.getByText(
                'Follow-up: hidden by rule "Follow-up after referral" because Outcome is not answered'
            )
        )
        .toBeVisible()
})

test('a visit date in the future: the form-level error is in the feedback', async () => {
    await open()
    await userEvent.fill(textbox('Visit date'), '2099-01-01')
    await userEvent.keyboard('{Tab}')
    await expect
        .element(page.getByText('Error: The visit date is in the future'))
        .toBeVisible()
})

test('with blame off, the rules still apply but say nothing of themselves', async () => {
    await open({ blame: 'off' })
    await enter('Weight (kg)', '150')
    await expect
        .element(textbox('Paracetamol dose (mg)'))
        .toHaveAccessibleDescription('Set by a program rule')
    await userEvent.click(radio('Male'))
    await expect
        .element(page.getByText('Pregnant', { exact: true }))
        .not.toBeInTheDocument()
    expect(page.getByRole('button', { name: /why$|^Why\?/ }).query()).toBeNull()
    expect(
        page.getByRole('button', { name: /hidden by rules/ }).query()
    ).toBeNull()
    await expect.poll(() => liveRegion().textContent).toBe('Pregnant hidden.')
})

describe('answers the rules alone changed', () => {
    const rulesChanged = (props: Partial<EventFormProps>) =>
        open(
            { eventId: CHILD_VISIT.eventId, ...props },
            { event: RULES_CHANGED_VISIT }
        )

    test('are reported, and not as unsaved changes, while the form says nothing of them', async () => {
        const {
            callback: onUnsavedRuleChanges,
            values: changesWith,
            until: changes,
        } = recorded<number>()
        const onDirtyChange = vi.fn()
        await rulesChanged({ onUnsavedRuleChanges, onDirtyChange })
        await expect.element(textbox('Paracetamol dose (mg)')).toHaveValue('24')
        expect(page.getByText(/Rules have changed/).query()).toBeNull()
        expect(changesWith.at(-1)).toBe(4)
        expect(onDirtyChange).not.toHaveBeenCalled()
        await userEvent.click(button('Save'))
        await changes((values) => values.at(-1) === 0)
    })

    test('are 0 once the user changes an answer, as Save then sends it all', async () => {
        const {
            callback: onUnsavedRuleChanges,
            values: changesWith,
            until: changes,
        } = recorded<number>()
        await rulesChanged({ onUnsavedRuleChanges })
        await changes((values) => values.at(-1) === 4)
        await enter('Weight (kg)', '13')
        expect(changesWith.at(-1)).toBe(0)
    })

    test('are not reported for a new event before its first save', async () => {
        const onUnsavedRuleChanges = vi.fn()
        await open({ onUnsavedRuleChanges })
        await enter('Weight (kg)', '12')
        await expect.element(textbox('Paracetamol dose (mg)')).toHaveValue('24')
        expect(onUnsavedRuleChanges).not.toHaveBeenCalled()
    })
})
