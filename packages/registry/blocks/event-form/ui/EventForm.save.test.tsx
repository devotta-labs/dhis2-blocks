import { page, userEvent } from 'vitest/browser'
import { liveRegion } from '../../../test/liveRegion'
import {
    CHILD_VISIT,
    CHILD_VISIT_RULES,
    childVisitProgram,
    SAVED_VISIT,
} from '../__tests__/childVisit'
import { editable, renderForm } from '../__tests__/serve'

const weight = () => page.getByRole('textbox', { name: 'Weight (kg)' })
const save = () => page.getByRole('button', { name: 'Save' })
const complete = () =>
    page.getByRole('button', { name: 'Complete', exact: true })
/** The status by the buttons; the live region says it too. */
const savedStatus = () =>
    page
        .elementLocator(document.querySelector('form') ?? document.body)
        .getByText('Saved', { exact: true })
const alertSaying = (text: string) =>
    page.getByRole('alert').filter({ hasText: text })

interface SentEvent {
    event: string
    status: string
    scheduledAt?: string
    geometry?: unknown
    dataValues: Array<{ dataElement: string; value: string | null }>
}

const sentEvent = (request: { data?: unknown }): SentEvent =>
    // SAFETY: the form sends one event in a tracker import; the assertions check its parts.
    (request.data as { events: [SentEvent] }).events[0]

test('Save while a field has focus sends its value with what the rules set', async () => {
    const onSaved = vi.fn()
    const onDirtyChange = vi.fn()
    const { to } = await renderForm({}, { onSaved, onDirtyChange })
    await editable()
    await userEvent.click(weight())
    await userEvent.keyboard('150')
    await save().click()
    await expect.poll(() => onSaved.mock.calls).toHaveLength(1)

    const [request] = to('tracker')
    expect(to('tracker')).toHaveLength(1)
    expect(request.params).toMatchObject({ atomicMode: 'ALL' })
    const event = sentEvent(request)
    expect(event.dataValues).toEqual(
        expect.arrayContaining([
            { dataElement: 'labWeight01', value: '150' },
            { dataElement: 'labDoseMg01', value: '300' },
            { dataElement: 'labDailyMg1', value: '1200' },
        ])
    )
    expect(onSaved).toHaveBeenCalledWith({
        eventId: event.event,
        status: 'ACTIVE',
    })
    expect(onDirtyChange.mock.calls).toEqual([[true], [false]])
})

test("an edit that empties a field deletes its value and keeps the event's own fields", async () => {
    const { to } = await renderForm({}, { eventId: CHILD_VISIT.eventId })
    await editable()
    await userEvent.clear(
        page.getByRole('textbox', { name: 'Temperature (°C)' })
    )
    await save().click()
    await expect.poll(() => to('tracker')).toHaveLength(1)
    const event = sentEvent(to('tracker')[0])
    expect(event.dataValues).toContainEqual({
        dataElement: 'labTempC001',
        value: null,
    })
    expect(event.scheduledAt).toBe('2026-11-01T00:00:00.000')
    expect(event.geometry).toEqual({
        type: 'Point',
        coordinates: [-11.42, 8.47],
    })
})

test('a failed Save lists what to fix and puts focus in the first field', async () => {
    const { to } = await renderForm()
    await editable()
    await save().click()
    await expect.element(alertSaying('Fix these before saving')).toBeVisible()
    const fix = page.getByRole('button', { name: 'Weight (kg): Required' })
    await expect.element(fix).toBeVisible()
    await expect.element(weight()).toHaveFocus()
    expect(to('tracker')).toHaveLength(0)

    await userEvent.click(page.getByRole('textbox', { name: 'Visit date' }))
    await fix.click()
    await expect.element(weight()).toHaveFocus()
})

test('Complete with a warning on completing asks first', async () => {
    const { to } = await renderForm()
    await editable()
    await userEvent.click(weight())
    await userEvent.keyboard('120')
    await complete().click()
    const dialog = page.getByRole('alertdialog', { name: 'Complete anyway?' })
    await expect
        .element(dialog)
        .toHaveTextContent('Check the weight: over 100 kg for a child')
    expect(to('tracker')).toHaveLength(0)
    await dialog.getByRole('button', { name: 'Complete anyway' }).click()
    await expect.poll(() => to('tracker')).toHaveLength(1)
    expect(sentEvent(to('tracker')[0]).status).toBe('COMPLETED')
})

test('under ON_COMPLETE, Save skips the required check and Complete does not', async () => {
    const { to } = await renderForm({
        program: childVisitProgram({ validationStrategy: 'ON_COMPLETE' }),
    })
    await editable()
    await save().click()
    await expect.poll(() => to('tracker')).toHaveLength(1)
    await complete().click()
    await expect
        .element(alertSaying('Fix these before completing'))
        .toBeVisible()
    expect(to('tracker')).toHaveLength(1)
})

test('a refused save puts its errors on their field and in the alert', async () => {
    const { to } = await renderForm({
        refuse: {
            status: 'ERROR',
            validationReport: {
                errorReports: [
                    // As DHIS2 2.42 words them: a refused value by its value type, never its data element.
                    {
                        errorCode: 'E1302',
                        message:
                            'DataElement `NUMBER` is not valid: `Value type is NUMBER but the value `150` is not.`.',
                        uid: 'labVisit001',
                        args: [
                            'NUMBER',
                            'Value type is NUMBER but the value `150` is not.',
                        ],
                    },
                    {
                        errorCode: 'E1303',
                        message:
                            'Mandatory DataElement `labFollowUp` is not present.',
                        uid: 'labVisit001',
                    },
                    {
                        errorCode: 'E1303',
                        message:
                            'Mandatory DataElement `labNoSect01` is not present.',
                        uid: 'labVisit001',
                    },
                    {
                        errorCode: 'E1000',
                        message:
                            'User: `labUser0001` has no write access to OrganisationUnit: `labOrgUnit1`.',
                        uid: 'labVisit001',
                    },
                ],
            },
        },
    })
    await editable()
    await userEvent.click(weight())
    await userEvent.keyboard('150{Tab}')
    await save().click()
    const failed = alertSaying("Didn't save")
    await expect.element(failed).toHaveTextContent('has no write access')
    // Fields not on screen: the hidden Follow-up section, and a field in no section.
    await expect.element(failed).toHaveTextContent('labFollowUp')
    await expect.element(failed).toHaveTextContent('labNoSect01')
    await expect
        .element(weight())
        .toHaveAccessibleDescription(
            /DataElement `Weight \(kg\)` is not valid: `Value type is NUMBER but the value `150` is not.`/
        )
    await failed
        .getByRole('button', {
            name: 'Weight (kg): DataElement `Weight (kg)` is not valid',
        })
        .click()
    await expect.element(weight()).toHaveFocus()

    await userEvent.click(weight())
    await userEvent.keyboard('{Backspace}{Tab}')
    await expect
        .element(weight())
        .not.toHaveAccessibleDescription(/Value type is NUMBER/)
    await save().click()
    await expect.poll(() => to('tracker')).toHaveLength(2)
})

test('a value held in DHIS2 that the rules clear at open is deleted on Save', async () => {
    const { to } = await renderForm(
        {
            rules: {
                programRules: CHILD_VISIT_RULES.programRules.filter(
                    ({ name }) => name !== 'Pregnancy is no for men'
                ),
            },
            event: {
                ...SAVED_VISIT,
                dataValues: [
                    ...SAVED_VISIT.dataValues.filter(
                        ({ dataElement }) =>
                            dataElement !== 'labSexCode1' &&
                            dataElement !== 'labPregnant'
                    ),
                    { dataElement: 'labSexCode1', value: 'M' },
                    { dataElement: 'labPregnant', value: 'true' },
                ],
            },
        },
        { eventId: CHILD_VISIT.eventId }
    )
    await editable()
    await save().click()
    await expect.poll(() => to('tracker')).toHaveLength(1)
    expect(sentEvent(to('tracker')[0]).dataValues).toContainEqual({
        dataElement: 'labPregnant',
        value: null,
    })
})

test('a second Complete anyway while saving sends nothing more', async () => {
    const { to, release } = await renderForm({ held: ['tracker'] })
    await editable()
    await userEvent.click(weight())
    await userEvent.keyboard('120')
    await complete().click()
    const dialog = page.getByRole('alertdialog', { name: 'Complete anyway?' })
    await dialog.getByRole('button', { name: 'Complete anyway' }).dblClick()
    await expect.poll(() => to('tracker')).toHaveLength(1)
    release()
    await expect
        .element(page.getByRole('button', { name: 'Save' }))
        .toBeEnabled()
    expect(to('tracker')).toHaveLength(1)
})

test('while DHIS2 has not answered, every field is read-only without a line, the form busy; a refusal unlocks it as typed', async () => {
    const { to, release } = await renderForm({
        held: ['tracker'],
        refuse: { status: 'ERROR', validationReport: { errorReports: [] } },
    })
    await editable()
    await userEvent.click(weight())
    await userEvent.keyboard('150{Tab}')
    await userEvent.click(page.getByRole('textbox', { name: 'Add a note' }))
    await userEvent.keyboard('Seen.')
    const form = document.querySelector('form')
    const top = () => weight().element().getBoundingClientRect().top
    const before = top()
    await save().click()
    await expect.poll(() => to('tracker')).toHaveLength(1)

    const saving = page.getByRole('button', { name: 'Saving…' })
    await expect.element(saving).toHaveFocus()
    expect(form?.getAttribute('aria-busy')).toBe('true')
    for (const name of ['Weight (kg)', 'Visit date', 'Add a note']) {
        const box = page.getByRole('textbox', { name })
        await expect.element(box).toHaveAttribute('readonly')
        await expect.element(box).toHaveAccessibleDescription(/Saving/)
    }
    await expect.element(weight()).not.toBeDisabled()
    await expect.element(weight()).toHaveValue('150')
    expect(page.getByText('Saving', { exact: true }).elements()).not.toEqual([])
    for (const each of page.getByText('Saving', { exact: true }).elements()) {
        expect(each).toHaveClass('sr-only')
    }
    // The event date above keeps its lines, so the fields below it stay where they were.
    expect(top()).toBe(before)

    release()
    await expect
        .element(page.getByRole('alert').filter({ hasText: "Didn't save" }))
        .toBeVisible()
    expect(form?.getAttribute('aria-busy')).toBe('false')
    await expect.element(weight()).not.toHaveAttribute('readonly')
    await expect.element(weight()).toHaveValue('150')
    await expect
        .element(page.getByRole('textbox', { name: 'Add a note' }))
        .toHaveValue('Seen.')
})

test('after 15 seconds unanswered the form offers to stop waiting, then ignores the late answer; a later Save updates the same event', async () => {
    const onSaved = vi.fn()
    const { to, release } = await renderForm({ held: ['tracker'] }, { onSaved })
    await editable()
    await userEvent.click(weight())
    await userEvent.keyboard('12')
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
    try {
        await save().click()
        await expect.poll(() => to('tracker')).toHaveLength(1)
        vi.advanceTimersByTime(14_999)
        await new Promise(requestAnimationFrame)
        expect(document.querySelector('form')?.textContent).not.toContain(
            'Still saving…'
        )
        vi.advanceTimersByTime(1)
    } finally {
        vi.useRealTimers()
    }
    await expect
        .element(page.getByText('Still saving…', { exact: true }).first())
        .toBeVisible()
    await expect.poll(() => liveRegion().textContent).toBe('Still saving…')
    await page.getByRole('button', { name: 'Stop waiting' }).click()
    await expect.element(save()).toBeEnabled()
    await expect.element(save()).toHaveFocus()
    expect(document.querySelector('form')?.textContent).not.toContain(
        'Still saving…'
    )
    await expect.element(weight()).not.toHaveAttribute('readonly')

    await userEvent.tripleClick(weight())
    await userEvent.keyboard('13')
    await save().click()
    await expect.poll(() => to('tracker')).toHaveLength(2)
    release()
    await expect.poll(() => onSaved.mock.calls).toHaveLength(1)
    const [first, second] = to('tracker').map(sentEvent)
    expect(second.event).toBe(first.event)
    expect(onSaved).toHaveBeenCalledWith({
        eventId: first.event,
        status: 'ACTIVE',
    })
    // The late answer to the first did not take the second's values as saved.
    await expect.element(savedStatus()).toBeVisible()
})

test('a save shows "Saved" by the buttons, announced, until the next edit; the next Save updates the same event', async () => {
    const { to } = await renderForm()
    await editable()
    await userEvent.click(weight())
    await userEvent.keyboard('12')
    await save().click()
    const saved = savedStatus()
    await expect.element(saved).toBeVisible()
    await expect.poll(() => liveRegion().textContent).toBe('Saved')
    await userEvent.tripleClick(weight())
    await userEvent.keyboard('13{Tab}')
    await expect.element(saved).not.toBeInTheDocument()
    await save().click()
    await expect.poll(() => to('tracker')).toHaveLength(2)
    const [first, second] = to('tracker').map(sentEvent)
    expect(second.event).toBe(first.event)
})

test('with confirmSaved="off" a save says nothing of itself', async () => {
    const onSaved = vi.fn()
    await renderForm({}, { confirmSaved: 'off', onSaved })
    await editable()
    await userEvent.click(weight())
    await userEvent.keyboard('12')
    await save().click()
    await expect.poll(() => onSaved.mock.calls).toHaveLength(1)
    expect(savedStatus().query()).toBeNull()
})

const FUTURE = 'A date in the future is not allowed'
const followUp = () => page.getByRole('textbox', { name: 'Follow-up date' })
/** `SAVED_VISIT` referred to a clinic, so its follow-up shows, with these values. */
const referred = (
    ...dataValues: Array<{ dataElement: string; value: string }>
) => ({
    ...SAVED_VISIT,
    dataValues: [
        ...SAVED_VISIT.dataValues.filter(
            ({ dataElement }) => dataElement !== 'labOutcome1'
        ),
        { dataElement: 'labOutcome1', value: 'CLINIC' },
        ...dataValues,
    ],
})

test('an event opened with a future date the stage refuses shows it under the field and does not save', async () => {
    const { to } = await renderForm(
        {
            program: childVisitProgram({ futureFollowUp: false }),
            event: referred({
                dataElement: 'labFollowUp',
                value: '2999-01-01',
            }),
        },
        { eventId: CHILD_VISIT.eventId }
    )
    await editable()
    await expect.element(page.getByText(FUTURE)).toBeVisible()
    await save().click()
    await expect
        .element(
            page.getByRole('button', { name: `Follow-up date: ${FUTURE}` })
        )
        .toBeVisible()
    await expect.element(followUp()).toHaveFocus()
    expect(to('tracker')).toHaveLength(0)
})

test('a future date the stage allows saves', async () => {
    const onSaved = vi.fn()
    const { to } = await renderForm(
        { event: referred() },
        { eventId: CHILD_VISIT.eventId, onSaved }
    )
    await editable()
    await userEvent.fill(followUp(), '2999-01-01')
    await userEvent.tab()
    await save().click()
    await expect.poll(() => onSaved.mock.calls).toHaveLength(1)
    expect(page.getByText(FUTURE).query()).toBeNull()
    expect(sentEvent(to('tracker')[0]).dataValues).toContainEqual({
        dataElement: 'labFollowUp',
        value: '2999-01-01',
    })
})

test('a refusal of the program says so in plain words, by the program’s name', async () => {
    await renderForm(
        {
            refuse: {
                status: 'ERROR',
                validationReport: {
                    errorReports: [
                        {
                            errorCode: 'E1091',
                            message: `User: \`labUser0001\` has no data write access to Program: \`${CHILD_VISIT.programId}\`.`,
                            uid: 'labVisit001',
                        },
                    ],
                },
            },
        },
        { eventId: CHILD_VISIT.eventId }
    )
    await editable()
    await save().click()
    await expect
        .element(alertSaying("Didn't save"))
        .toHaveTextContent(
            'You do not have access to enter data for Child visit. (E1091)'
        )
})
