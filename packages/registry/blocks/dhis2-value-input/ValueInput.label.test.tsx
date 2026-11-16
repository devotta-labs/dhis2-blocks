import { page, userEvent } from 'vitest/browser'
import { render } from 'vitest-browser-react'
import type { Field } from '@/components/dhis2-value-types'
import { ValueInput } from './ValueInput'
import type { ValueInputProps } from './ValueInput'

const NUMBER: Field = { valueType: 'NUMBER' }
const LABEL = 'Temperature'

const mount = async (props: Partial<ValueInputProps>) => {
    await render(
        <ValueInput
            field={NUMBER}
            settings={{ calendar: 'gregorian', dateFormat: 'YYYY-MM-DD' }}
            label={LABEL}
            value={undefined}
            onChange={() => {}}
            {...props}
        />
    )
    return { input: page.getByRole('textbox', { name: LABEL }) }
}

test('a read-only reason given as described only is not shown, and still describes the control', async () => {
    const { input } = await mount({
        value: '12',
        readOnly: 'Assigned by a rule',
        readOnlyReason: 'described',
    })
    await expect
        .element(input)
        .toHaveAccessibleDescription('Assigned by a rule')
    await expect
        .element(page.getByText('Assigned by a rule'))
        .toHaveClass('sr-only')
})

test('Tab passes a control whose read-only reason is described only, to the host’s marker, and a script can still focus it', async () => {
    const draw = (label: string, props: Partial<ValueInputProps> = {}) => (
        <ValueInput
            field={NUMBER}
            settings={{ calendar: 'gregorian', dateFormat: 'YYYY-MM-DD' }}
            label={label}
            value="300"
            onChange={() => {}}
            {...props}
        />
    )
    await render(
        <>
            {draw('Before')}
            {draw('Dose', {
                readOnly: 'Set by a rule',
                readOnlyReason: 'described',
                labelAside: <button type="button">Set automatically</button>,
            })}
            {draw('Pregnant', {
                field: { valueType: 'BOOLEAN' },
                value: 'false',
                readOnly: 'Set by a rule',
                readOnlyReason: 'described',
            })}
            {draw('Total', { readOnly: 'Set by a rule' })}
        </>
    )
    await userEvent.click(page.getByRole('textbox', { name: 'Before' }))
    await userEvent.keyboard('{Tab}')
    await expect
        .element(page.getByRole('button', { name: 'Set automatically' }))
        .toHaveFocus()
    await userEvent.keyboard('{Tab}')
    // A reason shown under the field keeps the control in the Tab order.
    await expect
        .element(page.getByRole('textbox', { name: 'Total' }))
        .toHaveFocus()
    const dose = page.getByRole('textbox', { name: 'Dose' })
    dose.element().focus()
    await expect.element(dose).toHaveFocus()
})

test.each([
    ['a date', { valueType: 'DATE' }, '2026-11-02'],
    ['a coordinate', { valueType: 'COORDINATE' }, '[-11.42,8.47]'],
] satisfies Array<[string, Field, string]>)(
    '%s held read-only keeps its look, its reason only described, and cannot be changed',
    async (_kind, field, value) => {
        const draw = (props: Partial<ValueInputProps>) => (
            <ValueInput
                field={field}
                settings={{ calendar: 'gregorian', dateFormat: 'YYYY-MM-DD' }}
                label={LABEL}
                value={value}
                onChange={() => {}}
                {...props}
            />
        )
        const screen = await render(draw({}))
        const height = screen.container.getBoundingClientRect().height
        const boxes = screen.container.querySelectorAll('input').length
        await screen.rerender(
            draw({ readOnly: 'Saving', readOnlyReason: 'held' })
        )
        expect(screen.container.getBoundingClientRect().height).toBe(height)
        expect(screen.container.querySelectorAll('input')).toHaveLength(boxes)
        await expect
            .element(page.getByText('Saving', { exact: true }))
            .toHaveClass('sr-only')
        for (const input of screen.container.querySelectorAll('input')) {
            expect(input.readOnly || input.closest('[inert]') !== null).toBe(
                true
            )
        }
    }
)

test.each([
    [
        'a text box',
        NUMBER,
        () => page.getByRole('textbox', { name: LABEL, exact: true }),
    ],
    [
        'radios',
        {
            valueType: 'TEXT',
            options: [
                { code: 'A', name: 'Alpha' },
                { code: 'B', name: 'Beta' },
            ],
        } satisfies Field,
        () => page.getByRole('radiogroup', { name: LABEL, exact: true }),
    ],
    [
        'a checkbox',
        { valueType: 'TRUE_ONLY' } satisfies Field,
        () => page.getByRole('checkbox', { name: LABEL, exact: true }),
    ],
])(
    'labelAside shows on the label row of %s, outside its name',
    async (_, field, control) => {
        await mount({
            field,
            labelAside: <button type="button">Marker</button>,
        })
        await expect.element(control()).toBeInTheDocument()
        const marker = page.getByRole('button', { name: 'Marker' })
        await expect.element(marker).toBeVisible()
        // The row: the label's text, then the marker.
        expect(marker.element().parentElement?.textContent).toBe(
            `${LABEL}Marker`
        )
    }
)
