import { page, userEvent } from 'vitest/browser'
import { liveRegion } from '../../../test/liveRegion'
import refusals from '../__tests__/fixtures/refusals-2.42.json'
import {
    CHILD_VISIT,
    childVisitProgram,
    SAVED_VISIT,
} from '../__tests__/childVisit'
import { editable, renderForm } from '../__tests__/serve'

const weight = () => page.getByRole('textbox', { name: 'Weight (kg)' })
const save = () => page.getByRole('button', { name: 'Save' })
const reopen = () => page.getByRole('button', { name: /^Reopen/ })
const locked = () =>
    page
        .getByRole('status')
        .filter({ hasText: 'This event is completed and locked' })

const completed = { ...SAVED_VISIT, status: 'COMPLETED' }
const MAY_REOPEN = ['F_UNCOMPLETE_EVENT']

interface SentEvent {
    event: string
    status: string
    dataValues: Array<{ dataElement: string; value: string | null }>
    notes?: unknown
}

const sentEvent = (request: { data?: unknown }): SentEvent =>
    // SAFETY: the form sends one event in a tracker import; the assertions check its parts.
    (request.data as { events: [SentEvent] }).events[0]

const stored = SAVED_VISIT.dataValues.map(({ dataElement, value }) => ({
    dataElement,
    value,
}))

test('on a stage that blocks entry, Reopen is the one action; it sends the event as held, active, and unlocks the form', async () => {
    const onSaved = vi.fn()
    const { to, release } = await renderForm(
        {
            program: childVisitProgram({ blockEntryForm: true }),
            event: completed,
            authorities: MAY_REOPEN,
            held: ['tracker'],
        },
        { eventId: CHILD_VISIT.eventId, onSaved }
    )
    await expect.element(locked()).toBeVisible()
    await expect.element(reopen()).toBeEnabled()
    await expect.element(save()).toBeDisabled()
    await expect.element(weight()).toHaveAttribute('readonly')

    await reopen().click()
    await expect.element(reopen()).toHaveTextContent('Reopening…')
    await expect.element(reopen()).toBeDisabled()
    await expect.poll(() => to('tracker')).toHaveLength(1)
    const event = sentEvent(to('tracker')[0])
    expect(event.status).toBe('ACTIVE')
    expect(event.dataValues).toEqual(expect.arrayContaining(stored))
    expect(event.dataValues).toHaveLength(stored.length)

    release()
    await expect.element(weight()).not.toHaveAttribute('readonly')
    expect(locked().query()).toBeNull()
    expect(reopen().query()).toBeNull()
    await expect.element(save()).toHaveFocus()
    await expect
        .element(page.getByRole('button', { name: 'Complete', exact: true }))
        .toBeEnabled()
    expect(onSaved).toHaveBeenCalledWith({
        eventId: CHILD_VISIT.eventId,
        status: 'ACTIVE',
    })
    await expect.poll(() => liveRegion().textContent).toBe('Reopened')
})

test('a user who may not reopen sees no Reopen', async () => {
    await renderForm(
        {
            program: childVisitProgram({ blockEntryForm: true }),
            event: completed,
        },
        { eventId: CHILD_VISIT.eventId }
    )
    await expect.element(locked()).toBeVisible()
    await expect.element(save()).toBeDisabled()
    expect(reopen().query()).toBeNull()
})

test('on a stage that does not block entry, Reopen sits with Save and leaves what is typed unsaved', async () => {
    const onDirtyChange = vi.fn()
    const { to } = await renderForm(
        { event: completed, authorities: MAY_REOPEN },
        { eventId: CHILD_VISIT.eventId, onDirtyChange }
    )
    await editable()
    await expect.element(reopen()).toBeEnabled()
    await expect.element(save()).toBeEnabled()
    await userEvent.tripleClick(weight())
    await userEvent.keyboard('13{Tab}')

    await reopen().click()
    await expect.poll(() => to('tracker')).toHaveLength(1)
    const event = sentEvent(to('tracker')[0])
    expect(event.status).toBe('ACTIVE')
    expect(event.dataValues).toContainEqual({
        dataElement: 'labWeight01',
        value: '12',
    })
    expect(event.notes).toBeUndefined()
    await expect.poll(() => reopen().query()).toBeNull()
    await expect.element(weight()).toHaveValue('13')
    expect(onDirtyChange.mock.calls).toEqual([[true]])

    await save().click()
    await expect.poll(() => to('tracker')).toHaveLength(2)
    expect(sentEvent(to('tracker')[1])).toMatchObject({ status: 'ACTIVE' })
    expect(sentEvent(to('tracker')[1]).dataValues).toContainEqual({
        dataElement: 'labWeight01',
        value: '13',
    })
})

test('a refused reopen says so with DHIS2’s reason and leaves the event completed and locked', async () => {
    const onSaved = vi.fn()
    await renderForm(
        {
            program: childVisitProgram({ blockEntryForm: true }),
            event: completed,
            authorities: MAY_REOPEN,
            refuse: {
                status: 'ERROR',
                validationReport: {
                    errorReports: [
                        { ...refusals.E1083, uid: CHILD_VISIT.eventId },
                    ],
                },
            },
        },
        { eventId: CHILD_VISIT.eventId, onSaved }
    )
    await reopen().click()
    const failed = page.getByRole('alert').filter({ hasText: "Didn't reopen" })
    await expect.element(failed).toHaveTextContent(refusals.E1083.message)
    await expect.element(locked()).toBeVisible()
    await expect.element(weight()).toHaveAttribute('readonly')
    await expect.element(reopen()).toBeEnabled()
    expect(onSaved).not.toHaveBeenCalled()
})
