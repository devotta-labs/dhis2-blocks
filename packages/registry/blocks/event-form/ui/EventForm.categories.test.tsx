import { page, userEvent } from 'vitest/browser'
import {
    CHILD_VISIT,
    childVisitProgram,
    SAVED_FUNDED_VISIT,
} from '../__tests__/childVisit'
import { editable, renderForm } from '../__tests__/serve'

const funded = { program: childVisitProgram({ categories: true }) }
const radio = (name: string) => page.getByRole('radio', { name, exact: true })
const group = (name: string) => page.getByRole('radiogroup', { name })
const save = () => page.getByRole('button', { name: 'Save' })

interface SentEvent {
    attributeCategoryOptions?: string
    attributeOptionCombo?: string
}

const sentEvent = (request: { data?: unknown }): SentEvent =>
    // SAFETY: the form sends one event in a tracker import; the assertions check its parts.
    (request.data as { events: [SentEvent] }).events[0]

test('a program with the default combination shows no categories', async () => {
    const { to } = await renderForm()
    await editable()
    expect(group('Funding').query()).toBeNull()
    expect(to('organisationUnits')).toHaveLength(0)
})

test('each category is a required choice of the options that apply here', async () => {
    const { to } = await renderForm(funded)
    await editable()
    await expect.element(group('Funding')).toBeVisible()
    await expect.element(group('Outreach type')).toBeVisible()
    // The org unit's ancestors are asked for once.
    expect(to('organisationUnits')).toEqual([
        expect.objectContaining({
            id: CHILD_VISIT.orgUnitId,
            params: { fields: 'path' },
        }),
    ])
    await expect.element(radio('Government')).toBeVisible()
    await expect.element(radio('NGO partner')).toBeVisible()
    await expect.element(radio('Fixed site')).toBeVisible()
    expect(radio('Donor project').query()).toBeNull()
    expect(radio('Pilot grant').query()).toBeNull()
    expect(radio('Campaign').query()).toBeNull()
})

test('Save without the categories names them and sends nothing', async () => {
    const { to } = await renderForm(funded)
    await editable()
    await userEvent.fill(
        page.getByRole('textbox', { name: 'Weight (kg)' }),
        '12'
    )
    await save().click()
    await expect
        .element(page.getByRole('button', { name: 'Funding: Required' }))
        .toBeVisible()
    await expect
        .element(page.getByRole('button', { name: 'Outreach type: Required' }))
        .toBeVisible()
    await expect.element(radio('Government')).toHaveFocus()
    expect(to('tracker')).toHaveLength(0)
})

test('the choices make the form dirty and are sent as the event’s category options', async () => {
    const onDirtyChange = vi.fn()
    const onSaved = vi.fn()
    const { to } = await renderForm(funded, { onDirtyChange, onSaved })
    await editable()
    await userEvent.click(radio('NGO partner'))
    await expect.poll(() => onDirtyChange.mock.calls).toEqual([[true]])
    await userEvent.click(radio('Fixed site'))
    await userEvent.fill(
        page.getByRole('textbox', { name: 'Weight (kg)' }),
        '12'
    )
    await save().click()
    await expect.poll(() => onSaved.mock.calls).toHaveLength(1)
    const event = sentEvent(to('tracker')[0])
    expect(event.attributeCategoryOptions).toBe('labCoNgo001,labCoFixed1')
    expect(event).not.toHaveProperty('attributeOptionCombo')
})

test('an edit shows the options the event holds', async () => {
    await renderForm(
        { ...funded, event: SAVED_FUNDED_VISIT },
        { eventId: CHILD_VISIT.eventId }
    )
    await editable()
    await expect.element(radio('Government')).toBeChecked()
    await expect.element(radio('Fixed site')).toBeChecked()
})

test('an event date the chosen option does not cover keeps it, says why and blocks Save', async () => {
    const { to } = await renderForm(funded)
    await editable()
    await userEvent.click(radio('Government'))
    await userEvent.click(radio('Mobile clinic'))
    await userEvent.fill(
        page.getByRole('textbox', { name: 'Weight (kg)' }),
        '12'
    )
    await userEvent.fill(
        page.getByRole('textbox', { name: 'Visit date' }),
        '2025-12-31'
    )
    await userEvent.keyboard('{Tab}')
    await expect.element(radio('Mobile clinic')).toBeChecked()
    await expect
        .element(page.getByText('Error: Mobile clinic starts on Jan 1, 2026'))
        .toBeVisible()
    await save().click()
    await expect
        .element(
            page.getByRole('button', {
                name: 'Outreach type: Mobile clinic starts on Jan 1, 2026',
            })
        )
        .toBeVisible()
    expect(to('tracker')).toHaveLength(0)
})

test('a locked event shows its categories read-only', async () => {
    await renderForm(
        {
            program: childVisitProgram({
                categories: true,
                blockEntryForm: true,
            }),
            event: { ...SAVED_FUNDED_VISIT, status: 'COMPLETED' },
        },
        { eventId: CHILD_VISIT.eventId }
    )
    await expect.element(radio('Government'), { timeout: 10_000 }).toBeChecked()
    await expect
        .element(group('Funding'))
        .toHaveAttribute('aria-readonly', 'true')
})
