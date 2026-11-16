import { page, userEvent } from 'vitest/browser'
import { CHILD_VISIT_RULES } from '../__tests__/childVisit'
import { editable, renderForm } from '../__tests__/serve'
import type { EventFormProps } from './EventForm'

const textbox = (name: string) => page.getByRole('textbox', { name })
const temperature = () => textbox('Temperature (°C)')
const dose = () => textbox('Paracetamol dose (mg)')

/** The Child visit rules and one more: a very high temperature hides the dose, the field after it. */
const HIDES_DOSE = {
    programRules: [
        ...CHILD_VISIT_RULES.programRules,
        {
            id: 'labRule0099',
            name: 'No paracetamol at a very high fever',
            displayName: 'No paracetamol at a very high fever',
            condition: '#{temp} > 41',
            programRuleActions: [
                {
                    id: 'labActn0990',
                    programRuleActionType: 'HIDEFIELD',
                    dataElement: { id: 'labDoseMg01' },
                },
            ],
        },
    ],
}

const open = async (props: Partial<EventFormProps> = {}) => {
    await renderForm({ rules: HIDES_DOSE }, props)
    await editable()
}

describe.each(['markers', 'off'] as const)('blame="%s"', (blame) => {
    test('focus on a field that a commit hides goes on to the next field', async () => {
        await open({ blame })
        await userEvent.click(temperature())
        await userEvent.keyboard('42')
        // Tab goes to the dose, which the commit on leaving the temperature hides.
        await userEvent.keyboard('{Tab}')
        await expect.element(dose()).not.toBeInTheDocument()
        await expect.element(textbox('Daily total (mg)')).toHaveFocus()
    })
})

test('focus on a marker that a commit removes goes on to the next field', async () => {
    await open({ blame: 'markers' })
    await userEvent.click(textbox('Weight (kg)'))
    await userEvent.keyboard('150{Tab}')
    const marker = page.getByRole('button', {
        name: 'Set automatically, Paracetamol dose (mg): why',
    })
    await expect.element(marker).toBeVisible()
    await userEvent.keyboard('42')
    // Tab goes to the dose's marker, which leaves with the dose.
    await userEvent.keyboard('{Tab}')
    await expect.element(marker).not.toBeInTheDocument()
    await expect.element(textbox('Daily total (mg)')).toHaveFocus()
})
