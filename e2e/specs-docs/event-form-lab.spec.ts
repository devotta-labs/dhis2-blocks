import { expect, test } from './fixtures'

test.describe('event form lab', () => {
    test('says what a rule read outside the form, and where it came from, as text', async ({
        page,
    }) => {
        await page.goto(
            `/playground/event-form?preset=${encodeURIComponent('RMNCH First ANC')}`
        )
        await expect(
            page.getByText('Ask again about smoking before the birth.')
        ).toBeVisible({ timeout: 60_000 })
        await page
            .getByRole('button', { name: /^Required here, .*Smoking.*: why$/ })
            .click()
        const why = page.getByRole('dialog')
        await expect(why).toContainText(
            /Birth date \(from the enrolment\): \S.*1991/
        )
        await expect(why).toContainText(
            'WHOMCH Pregnancy outcome (Care at birth): not answered'
        )
        await expect(
            why.getByRole('button', { name: /Birth date|Pregnancy outcome/ })
        ).toHaveCount(0)
    })
})
