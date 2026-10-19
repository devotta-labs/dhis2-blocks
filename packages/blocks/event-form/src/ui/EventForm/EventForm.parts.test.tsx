import { page, userEvent } from 'vitest/browser'
import { RMNCH, renderEventForm, textbox } from './eventFormTestSupport'

describe('EventForm parts', () => {
    it('the section nav lists the visible sections and moves focus to the one picked', async () => {
        await renderEventForm()
        const nav = page.getByRole('navigation', { name: 'Sections' })
        await expect.element(nav).toBeVisible()
        expect(
            nav
                .getByRole('button')
                .elements()
                .map((button) => button.textContent)
        ).toEqual([
            'Pre-existing conditions',
            'Current pregnancy',
            'Lab/testing',
            'Management',
        ])
        await nav.getByRole('button', { name: 'Lab/testing' }).click()
        await expect
            .element(page.getByRole('heading', { name: 'Lab/testing' }))
            .toHaveFocus()
    })

    it('feedback lists the display texts and key-value pairs the rules give', async () => {
        await renderEventForm()
        await expect
            .element(page.getByRole('region', { name: 'Feedback' }))
            .not.toBeInTheDocument()

        await userEvent.fill(textbox(RMNCH.diastolic), '80')
        await userEvent.tab()

        const feedback = page.getByRole('region', { name: 'Feedback' })
        await expect.element(feedback).toBeVisible()
        await expect
            .element(feedback.getByText('# 1. Score 1', { exact: true }))
            .toBeVisible()
        await expect
            .element(feedback.getByText('80%', { exact: true }))
            .toBeVisible()
        await expect.element(feedback.getByText(/Header 1/)).toBeVisible()
    })

    it('notes show the existing ones newest first, read-only, above a box for a new one', async () => {
        await renderEventForm({
            eventId: RMNCH.eventId,
            event: (event) => ({
                ...event,
                notes: [
                    {
                        note: 'noteOlder01',
                        value: 'Older note',
                        storedAt: '2026-03-01T10:00:00.000',
                        createdBy: { uid: 'xE7jOejl9FI', username: 'admin' },
                    },
                    {
                        note: 'noteNewer01',
                        value: 'Newer note',
                        storedAt: '2026-03-12T10:00:00.000',
                        createdBy: {
                            uid: 'xE7jOejl9FI',
                            displayName: 'John Traore',
                        },
                    },
                ],
            }),
        })
        const notes = page
            .getByRole('listitem')
            .filter({ hasText: /(Newer|Older) note/ })
        await expect.element(notes.first()).toHaveTextContent('Newer note')
        await expect
            .element(notes.first())
            .toHaveTextContent('John Traore 2026-03-12')
        await expect.element(notes.last()).toHaveTextContent('admin 2026-03-01')
        await expect
            .element(page.getByLabelText('Notes about this event'))
            .toHaveValue('')
    })
})
