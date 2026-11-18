import { page, userEvent } from 'vitest/browser'
import { render } from 'vitest-browser-react'
import { Why } from './Why'

test('an answer whose field is not on the page is text, not a way to it', async () => {
    await render(
        <>
            <input id="form-shown" aria-label="Weight (kg)" />
            <Why
                label="Paracetamol dose (mg)"
                formId="form"
                blames={[
                    {
                        effect: 'assigned',
                        ruleName: 'Paracetamol dose',
                        condition: 'd2:hasValue(#{weight}) && #{sex} == "F"',
                        value: '300',
                        because: [
                            {
                                fieldId: 'shown',
                                label: 'Weight (kg)',
                                value: '150',
                            },
                            {
                                fieldId: 'hidden',
                                label: 'Sex',
                                value: 'Female',
                            },
                        ],
                    },
                ]}
            />
        </>
    )
    await userEvent.click(
        page.getByRole('button', { name: 'Why? Paracetamol dose (mg)' })
    )
    const dialog = page.getByRole('dialog')
    await expect
        .element(dialog.getByRole('button', { name: 'Weight (kg): 150' }))
        .toBeVisible()
    await expect.element(dialog.getByText('Sex: Female')).toBeVisible()
    expect(dialog.getByRole('button', { name: 'Sex: Female' }).query()).toBe(
        null
    )
})
