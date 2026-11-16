import { page } from 'vitest/browser'
import {
    CHILD_VISIT,
    childVisitProgram,
    SAVED_VISIT,
} from '../__tests__/childVisit'
import { renderForm } from '../__tests__/serve'

const weight = () => page.getByRole('textbox', { name: 'Weight (kg)' })

test('without write access the form is read-only', async () => {
    await renderForm({ program: childVisitProgram({ write: false }) })
    await expect
        .element(
            page
                .getByRole('status')
                .filter({ hasText: 'You cannot enter data in this stage' })
        )
        .toBeVisible()
    await expect.element(weight()).toHaveAttribute('readonly')
})

test('a completed event of a stage that blocks entry is locked, and cannot be completed', async () => {
    await renderForm(
        {
            program: childVisitProgram({ blockEntryForm: true }),
            event: { ...SAVED_VISIT, status: 'COMPLETED' },
        },
        { eventId: CHILD_VISIT.eventId }
    )
    await expect
        .element(
            page
                .getByRole('status')
                .filter({ hasText: 'This event is completed and locked' })
        )
        .toBeVisible()
    await expect.element(weight()).toHaveAttribute('readonly')
    await expect
        .element(page.getByRole('button', { name: 'Save' }))
        .toBeVisible()
    expect(
        page.getByRole('button', { name: 'Complete', exact: true }).query()
    ).toBeNull()
})

test('rules that fail to load leave the form read-only, saying so', async () => {
    await renderForm({ failing: ['programRules'] })
    await expect
        .element(page.getByRole('alert'))
        .toHaveTextContent(
            "Program rules didn't load, so the form is read-only"
        )
    await expect.element(weight()).toHaveAttribute('readonly')
})
