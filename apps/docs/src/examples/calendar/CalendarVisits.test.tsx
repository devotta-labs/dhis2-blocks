import { expect, it, vi } from 'vitest'
import { render } from 'vitest-browser-react'
import CalendarVisits from './CalendarVisits'

it('shows ANC names by default and lets readers explore another day', async () => {
    const view = await render(<CalendarVisits />)
    await expect
        .element(
            view.getByRole('button', { name: '10 November 2026, 3 records' })
        )
        .toHaveTextContent('Amina N. · ANC visit 2')
    await expect
        .element(
            view.getByRole('button', { name: '10 November 2026, 3 records' })
        )
        .toHaveTextContent('Grace A. · ANC visit 1')
    await expect
        .element(view.getByRole('button', { name: 'Counts', exact: true }))
        .not.toBeInTheDocument()
    await expect
        .element(view.getByRole('button', { name: 'Names', exact: true }))
        .not.toBeInTheDocument()
    await view
        .getByRole('button', {
            name: '12 November 2026, 1 record',
            exact: true,
        })
        .click()
    expect(
        view.container.querySelector('[data-slot="calendar-day-records"]')
    ).toHaveTextContent('Mary K. · ANC visit 4')
})

it('keeps Schedule illustrative without submitting or changing visits', async () => {
    const submit = vi.fn((event: React.FormEvent) => event.preventDefault())
    const view = await render(
        <form onSubmit={submit}>
            <CalendarVisits />
        </form>
    )
    const schedule = view.getByRole('button', { name: 'Schedule', exact: true })
    await expect.element(schedule).toBeEnabled()
    await schedule.click()
    expect(submit).not.toHaveBeenCalled()
    await expect
        .element(
            view.getByRole('button', { name: '10 November 2026, 3 records' })
        )
        .toHaveTextContent('Amina N. · ANC visit 2')
    expect(
        view.container.querySelector('[data-slot="calendar-day-records"]')
    ).toHaveTextContent('Amina N. · ANC visit 2')
    await expect.element(view.getByRole('dialog')).not.toBeInTheDocument()
})
