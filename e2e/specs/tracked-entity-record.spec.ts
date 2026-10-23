import { AxeBuilder } from '@axe-core/playwright'
import type { APIRequestContext, Page } from '@playwright/test'
import { expect, test } from '../fixtures/test'

const PERSON = 'TrE2eTei001'
const INACTIVE_PERSON = 'TrE2eTei002'
const DELETED_ENROLLMENT_PERSON = 'TrE2eTei003'
const OPEN_PROGRAM = 'TrE2ePrg001'
const ENROLL_ONCE_PROGRAM = 'TrE2ePrg002'
const PROTECTED_PROGRAM = 'TrE2ePrg003'

const openRecord = async (page: Page, id: string, programs?: string[]) => {
    const parameters = new URLSearchParams({ trackedEntity: id })
    if (programs) {
        parameters.set('programs', programs.join(','))
    }
    await page.goto(`/#/tracked-entity-record?${parameters.toString()}`)
}

const programView = (page: Page, id: string) =>
    page.getByTestId(`program-view-${id}`)

const ACTIVE_ENROLLMENT = 'TrE2eEnr002'

/** The enrollment as the server holds it, read as the admin. */
const readEnrollment = async (dhis2: APIRequestContext) => {
    const response = await dhis2.get(
        `/api/tracker/enrollments/${ACTIVE_ENROLLMENT}`,
        { params: { fields: 'followUp,notes[value]' } }
    )
    expect(response.ok()).toBe(true)
    const body: { followUp: boolean; notes: { value: string }[] } =
        await response.json()
    return body
}

test.describe('tracked entity record demo as a restricted nurse', () => {
    test.use({
        e2eCredentials: {
            username: 'ter_e2e_nurse',
            password: 'TrackedEntity123!',
        },
    })

    test("shows P1's programs, with Prg003 unavailable", async ({ page }) => {
        await openRecord(page, PERSON)

        await expect(page.getByTestId('person-header')).toContainText('Amara')
        const switcher = page.getByTestId('program-switcher')
        await expect(
            switcher.getByRole('button', { name: 'TER E2E open program' })
        ).toBeVisible()
        await expect(
            switcher.getByRole('button', {
                name: 'TER E2E enroll-once program',
            })
        ).toBeVisible()

        await switcher.getByRole('button', { name: PROTECTED_PROGRAM }).click()
        await expect(
            programView(page, PROTECTED_PROGRAM).getByTestId(
                'unavailable-notice'
            )
        ).toContainText("You don't have access to this program's records")
    })

    test('opens Prg001 on the ACTIVE enrollment and offers the older one', async ({
        page,
    }) => {
        await openRecord(page, PERSON, [OPEN_PROGRAM])

        const active = page.getByTestId('enrollment-TrE2eEnr002')
        const older = page.getByTestId('enrollment-TrE2eEnr001')
        await expect(active).toHaveAttribute('aria-pressed', 'true')
        await expect(older).toHaveAttribute('aria-pressed', 'false')
        await expect(page.getByTestId('visit-TrE2eEvt004')).toBeVisible()
        await expect(page.getByTestId('visit-TrE2eEvt008')).toHaveCount(0)

        await older.click()
        await expect(older).toHaveAttribute('aria-pressed', 'true')
        await expect(page.getByTestId('visit-TrE2eEvt008')).toBeVisible()
        await expect(page.getByTestId('visit-TrE2eEvt004')).toHaveCount(0)
    })

    test('labels the past scheduled visit overdue and the future one upcoming', async ({
        page,
    }) => {
        await openRecord(page, PERSON, [OPEN_PROGRAM])

        await expect(page.getByTestId('visit-TrE2eEvt004')).toContainText(
            'Overdue'
        )
        await expect(page.getByTestId('visit-TrE2eEvt005')).toContainText(
            'Upcoming'
        )
        // The latest value per data element comes from the newest event that has one.
        const latest = page.getByTestId('latest-values')
        await expect(latest).toContainText('37.8')
        await expect(latest).toContainText('Mild')
    })

    test('does not show Stg002 visits', async ({ page }) => {
        await openRecord(page, PERSON, [OPEN_PROGRAM])

        await expect(page.getByTestId('visit-TrE2eEvt005')).toBeVisible()
        await expect(page.getByTestId('visit-TrE2eEvt007')).toHaveCount(0)
        await expect(page.getByTestId('visits')).not.toContainText(
            'restricted stage'
        )
    })

    test('Prg002 says the person can only be enrolled once', async ({
        page,
    }) => {
        await openRecord(page, PERSON, [ENROLL_ONCE_PROGRAM])

        await expect(
            programView(page, ENROLL_ONCE_PROGRAM).getByTestId(
                'enrollment-allowance'
            )
        ).toContainText('can only be enrolled once')
    })

    test('P3 is not enrolled in Prg001', async ({ page }) => {
        await openRecord(page, DELETED_ENROLLMENT_PERSON, [OPEN_PROGRAM])

        const view = programView(page, OPEN_PROGRAM)
        await expect(view).toContainText('Not enrolled in this program')
        await expect(view.getByTestId('enrollment-allowance')).toContainText(
            'can be enrolled'
        )
        await expect(view.getByTestId('visits')).toHaveCount(0)
    })

    test('P2 is read-only', async ({ page }) => {
        await openRecord(page, INACTIVE_PERSON, [OPEN_PROGRAM])

        const view = programView(page, OPEN_PROGRAM)
        await expect(page.getByTestId('person-header')).toContainText('Bea')
        await expect(view.getByTestId('read-only-notice')).toBeVisible()
        await expect(view.getByTestId('add-note')).toHaveCount(0)
    })

    test.describe('a missing person', () => {
        test.use({ allowTrackedEntityNotFound: true })

        test('an unknown id shows the unavailable message', async ({
            page,
        }) => {
            await openRecord(page, 'TrE2eNobody')

            await expect(page.getByTestId('unavailable-notice')).toContainText(
                'This person is not available'
            )
        })
    })

    test.describe('notes on the active enrollment', () => {
        // Both write to one enrollment; 2.41 answers 500 to concurrent writes.
        test.describe.configure({ mode: 'serial' })

        test('adding a note refreshes every view', async ({ page, dhis2 }) => {
            const note = `E2E note ${Date.now()}`
            // The seeded enrollment is marked for follow-up; the note must not clear it.
            expect((await readEnrollment(dhis2)).followUp).toBe(true)
            await openRecord(page, PERSON, [OPEN_PROGRAM])

            const view = programView(page, OPEN_PROGRAM)
            const notes = view.getByTestId('notes')
            await expect(notes).toContainText(
                'Enrolled again after the first course ended.'
            )

            // Hold the refetch back so the fetching indicator is on screen long enough to see.
            await page.route(
                new RegExp(`/tracker/trackedEntities/${PERSON}(\\?|$)`),
                async (route) => {
                    await new Promise((resolve) => setTimeout(resolve, 1_500))
                    await route.continue()
                }
            )
            await view.getByTestId('add-note-text').fill(note)
            await view.getByTestId('add-note').click()

            await expect(page.getByTestId('record-fetching')).toBeVisible()
            await expect(view.getByTestId('latest-values')).toBeVisible()
            await expect(notes).toContainText(note)
            await expect(notes).toContainText(
                'Enrolled again after the first course ended.'
            )
            await expect(page.getByTestId('record-fetching')).toHaveCount(0)
            await expect(view.getByTestId('add-note-text')).toHaveValue('')
            await expect(view.getByRole('status')).toContainText('Note added.')
            expect((await readEnrollment(dhis2)).followUp).toBe(true)
        })

        test('a note saved before a failed refresh says so and is not offered again', async ({
            page,
            dhis2,
        }) => {
            const note = `E2E unrefreshed note ${Date.now()}`
            await openRecord(page, PERSON, [OPEN_PROGRAM])

            const view = programView(page, OPEN_PROGRAM)
            await expect(view.getByTestId('notes')).toBeVisible()

            // The refetch answers something the block's schema rejects: refresh()
            // fails after the note is saved, without an HTTP error.
            await page.route(
                new RegExp(`/tracker/trackedEntities/${PERSON}(\\?|$)`),
                (route) => route.fulfill({ json: {} })
            )
            await view.getByTestId('add-note-text').fill(note)
            await view.getByTestId('add-note').click()

            await expect(
                view.getByTestId('add-note-not-refreshed')
            ).toContainText('Saved, but the record could not be refreshed.')
            await expect(view.getByTestId('add-note-text')).toHaveValue('')
            await expect(
                view.getByText('The note could not be added.')
            ).toHaveCount(0)
            // The record stays on screen, and the note is saved once.
            await expect(view.getByTestId('latest-values')).toBeVisible()
            const saved = (await readEnrollment(dhis2)).notes.filter(
                ({ value }) => value === note
            )
            expect(saved).toHaveLength(1)
        })
    })

    test('shows two programs side by side from one record', async ({
        page,
    }) => {
        await openRecord(page, PERSON, [OPEN_PROGRAM, ENROLL_ONCE_PROGRAM])

        await expect(programView(page, ENROLL_ONCE_PROGRAM)).toHaveCount(0)
        await page.getByTestId('view-mode-side-by-side').click()

        await expect(programView(page, OPEN_PROGRAM)).toBeVisible()
        await expect(programView(page, ENROLL_ONCE_PROGRAM)).toBeVisible()
        await expect(page.getByTestId('program-switcher')).toHaveCount(0)
    })

    test('has no axe violations', async ({ page }) => {
        await openRecord(page, PERSON, [OPEN_PROGRAM])
        await expect(page.getByTestId('latest-values')).toBeVisible()

        const accessibility = await new AxeBuilder({ page })
            .include('[data-testid="tracked-entity-record-demo"]')
            .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
            .analyze()
        expect(accessibility.violations).toEqual([])
    })
})
