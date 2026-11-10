import { page } from 'vitest/browser'
import { render } from 'vitest-browser-react'
import type { ValueSettings } from '@/components/dhis2-value-types'
import { ValueInput } from './ValueInput'
import type { ValueInputProps } from './ValueInput'

/** How each kind is laid out as a field, a fieldset or a checkbox beside its label, and what it says as rules change. */

const SETTINGS: ValueSettings = {
    calendar: 'gregorian',
    dateFormat: 'YYYY-MM-DD',
}
const LABEL = 'Temperature'

const mount = async (props: Partial<ValueInputProps> = {}) => {
    const base: ValueInputProps = {
        field: { valueType: 'NUMBER' },
        settings: SETTINGS,
        label: LABEL,
        value: undefined,
        onChange: vi.fn(),
        ...props,
    }
    const screen = await render(<ValueInput {...base} />)
    return {
        rerender: (more: Partial<ValueInputProps>) =>
            screen.rerender(<ValueInput {...base} {...more} />),
    }
}

/** What the house announcer's live regions say now. */
const spoken = () =>
    [...document.querySelectorAll('[aria-live]')]
        .map(({ textContent }) => textContent)
        .join('|')

test("a rule's error or warning that appears later is said; one the field opens with, and information, are not", async () => {
    const opening = { tone: 'error', text: 'Too high' } as const
    const { rerender } = await mount({ messages: [opening] })
    await new Promise((resolve) => setTimeout(resolve, 300))
    expect(spoken()).not.toContain('Too high')

    await rerender({
        messages: [
            opening,
            { tone: 'warning', text: 'Check the unit' },
            { tone: 'info', text: 'BMI 22' },
        ],
    })
    await expect.poll(spoken).toContain('Warning: Check the unit')
    expect(spoken()).not.toContain('Too high')
    expect(spoken()).not.toContain('BMI')

    await rerender({ messages: [{ tone: 'error', text: 'Too low' }] })
    await expect.poll(spoken).toContain('Error: Too low')
})

test('a long text is a field named by its label, not a group', async () => {
    await mount({ field: { valueType: 'LONG_TEXT' } })
    await expect
        .element(page.getByRole('textbox', { name: LABEL }))
        .toBeVisible()
    expect(page.getByRole('group', { name: LABEL }).elements()).toHaveLength(0)
})

test('a short multi-select is a group of boxes named by its label, each marked invalid by an error', async () => {
    await mount({
        field: {
            valueType: 'MULTI_TEXT',
            options: [
                { code: 'FEVER', name: 'Fever' },
                { code: 'COUGH', name: 'Cough' },
            ],
        },
        messages: [{ tone: 'error', text: 'Choose at least one' }],
    })
    const group = page.getByRole('group', { name: LABEL })
    await expect
        .element(group)
        .toHaveAccessibleDescription('Error: Choose at least one')
    await expect
        .element(group.getByRole('checkbox', { name: 'Cough' }))
        .toHaveAttribute('aria-invalid', 'true')
})

test("a yes-only field's description sits under its label, beside the box", async () => {
    await mount({
        field: { valueType: 'TRUE_ONLY' },
        description: 'Signed by the patient',
    })
    await expect
        .element(page.getByRole('checkbox', { name: LABEL }))
        .toHaveAccessibleDescription('Signed by the patient')
    const label = page
        .getByText(LABEL, { exact: true })
        .element()
        .getBoundingClientRect()
    const text = page
        .getByText('Signed by the patient')
        .element()
        .getBoundingClientRect()
    expect(text.left).toBe(label.left)
    expect(text.top).toBeGreaterThan(label.top)
})
