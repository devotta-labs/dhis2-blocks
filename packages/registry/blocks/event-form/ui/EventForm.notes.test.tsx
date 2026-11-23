import { page, userEvent } from 'vitest/browser'
import { CHILD_VISIT, childVisitProgram } from '../test/childVisit'
import { editable, recorded, renderForm } from '../test/serve'

const notes = () => page.getByRole('group', { name: 'Notes' })
const box = () => page.getByRole('textbox', { name: 'Add a note' })
const save = () => page.getByRole('button', { name: 'Save' })

const sentNotes = (request: { data?: unknown }) =>
    // SAFETY: the form sends one event in a tracker import; the assertions check its notes.
    (request.data as { events: [{ notes?: unknown }] }).events[0].notes

test("an edit lists the event's notes oldest first, with who wrote each and when", async () => {
    await renderForm({}, { eventId: CHILD_VISIT.eventId })
    await editable()
    const items = notes().getByRole('listitem')
    await expect
        .element(items.nth(0))
        .toHaveTextContent(
            'Mother reports fever since Sunday.Aminata Sesay · Nov 2, 2026 09:41'
        )
    await expect
        .element(items.nth(1))
        .toHaveTextContent(
            'Weighed again after feeding.clerk · Nov 2, 2026 10:05'
        )
    await expect.element(box()).toBeVisible()
})

test('a new event shows only the heading and the box', async () => {
    await renderForm()
    await editable()
    await expect.element(box()).toBeVisible()
    expect(notes().getByRole('list').query()).toBeNull()
})

test('a typed note is an unsaved change, goes with Save under its own id, then is listed and the box empties', async () => {
    const {
        callback: onDirtyChange,
        values: dirtyWith,
        until: dirtied,
    } = recorded<boolean>()
    const { to } = await renderForm(
        {},
        { eventId: CHILD_VISIT.eventId, onDirtyChange }
    )
    await editable()
    await userEvent.click(box())
    await userEvent.keyboard('Gave ORS.')
    await dirtied((values) => values.length > 0)
    expect(dirtyWith).toEqual([true])
    await save().click()
    await expect.poll(() => to('tracker')).toHaveLength(1)
    expect(sentNotes(to('tracker')[0])).toEqual([
        {
            note: expect.stringMatching(/^[A-Za-z][A-Za-z0-9]{10}$/),
            value: 'Gave ORS.',
        },
    ])
    await expect
        .element(notes().getByRole('listitem').nth(2))
        .toHaveTextContent(/^Gave ORS\.You · /)
    await expect.element(box()).toHaveValue('')
    await dirtied((values) => values.length > 1)
    expect(dirtyWith).toEqual([true, false])

    await save().click()
    await expect.poll(() => to('tracker')).toHaveLength(2)
    expect(sentNotes(to('tracker')[1])).toBeUndefined()
})

test('a refused save keeps the note, and the next Save sends it with the same id', async () => {
    const { to } = await renderForm({
        refuse: { status: 'ERROR', validationReport: { errorReports: [] } },
    })
    await editable()
    await userEvent.click(page.getByRole('textbox', { name: 'Weight (kg)' }))
    await userEvent.keyboard('12')
    await userEvent.click(box())
    await userEvent.keyboard('Seen twice.')
    await save().click()
    await expect
        .element(page.getByRole('alert').filter({ hasText: "Didn't save" }))
        .toBeVisible()
    await expect.element(box()).toHaveValue('Seen twice.')
    await save().click()
    await expect.poll(() => to('tracker')).toHaveLength(2)
    expect(sentNotes(to('tracker')[1])).toEqual(sentNotes(to('tracker')[0]))
})

test('a read-only form lists the notes without the box', async () => {
    await renderForm(
        { program: childVisitProgram({ write: false }) },
        { eventId: CHILD_VISIT.eventId }
    )
    await expect
        .element(notes().getByText('Mother reports fever since Sunday.'))
        .toBeVisible()
    expect(box().query()).toBeNull()
})
