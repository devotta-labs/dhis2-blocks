import { expect, it } from 'vitest'
import { render } from 'vitest-browser-react'
import ChildHealthVisits from './ChildHealthVisits'

it('groups the visits by phase under named sections', async () => {
    const view = await render(<ChildHealthVisits />)
    await expect
        .element(view.getByRole('region', { name: 'Child health visits' }))
        .toBeVisible()
    for (const group of ['Overdue', 'Upcoming', 'Past']) {
        await expect
            .element(view.getByRole('region', { name: group }))
            .toBeVisible()
    }
    await expect
        .element(view.getByRole('region', { name: 'Overdue' }))
        .toHaveTextContent('9-month visitDue 28 Oct 2026Overdue')
})

it('opens a past visit’s facts and notes from its Details button', async () => {
    const view = await render(<ChildHealthVisits />)
    const past = view.getByRole('region', { name: 'Past' })
    const triggers = past.getByRole('button', { name: 'Details' })
    await expect
        .element(triggers.first())
        .toHaveAttribute('aria-expanded', 'true')
    await expect.element(past.getByText('7.4 kg')).toBeVisible()
    await expect.element(past.getByText('Unavailable')).toBeVisible()

    const partial = triggers.nth(1)
    await expect.element(partial).toHaveAttribute('aria-expanded', 'false')
    await partial.click()
    await expect.element(partial).toHaveAttribute('aria-expanded', 'true')
    await expect.element(past.getByText('Not recorded')).toBeVisible()
    await expect
        .element(past.getByText('Scale out of order; weigh at the next visit.'))
        .toBeVisible()
})

it('keeps Schedule visit illustrative', async () => {
    const view = await render(<ChildHealthVisits />)
    await view.getByRole('button', { name: 'Schedule visit' }).click()
    expect(
        view.container.querySelectorAll('[data-slot="visit-item"]')
    ).toHaveLength(4)
})
