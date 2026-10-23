import { page } from 'vitest/browser'
import { renderFindPerson } from './findPersonSupport'

// Runs in the `browser-production` project, built with
// `process.env.NODE_ENV` set to "production" as an app's production build is.

describe('FindPerson in production', () => {
    afterEach(() => {
        vi.restoreAllMocks()
    })

    it('logs no setup problem in production when the forms swap', async () => {
        const error = vi.spyOn(console, 'error').mockImplementation(() => {})
        renderFindPerson()
        await expect
            .element(page.getByLabelText('Unique ID'))
            .not.toBeDisabled()

        await page.getByRole('button', { name: 'No ID?' }).click()
        await expect.element(page.getByLabelText('First name')).toBeVisible()
        await page.getByRole('button', { name: 'Search by ID instead' }).click()
        await expect.element(page.getByLabelText('Unique ID')).toBeVisible()

        // A form's fields register after its first render; that render
        // must not be judged as a form with no fields.
        expect(error).not.toHaveBeenCalled()
        await expect.element(page.getByRole('alert')).not.toBeInTheDocument()
    })
})
