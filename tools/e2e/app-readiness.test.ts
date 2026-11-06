import assert from 'node:assert/strict'
import { test } from 'node:test'
import { chromium } from '@playwright/test'
import { signInToApp } from '../../e2e/fixtures/app-readiness.ts'

const credentials = {
    username: 'fixture-user',
    password: 'fixture-password',
    serverUrl: 'http://localhost',
}
const shell =
    '<h1 data-testid="working-list-heading">Working lists</h1><section aria-label="Working list context"><button data-test="program-selector-container">Choose a program</button></section>'
const dialog =
    '<div role="dialog"><h2>Please sign in</h2><label>Server<input></label><label>Username<input></label><label>Password<input></label><button>Sign in</button></div>'

test('readiness requires login or authenticated controls, handles delayed startup and rejects failed login', async () => {
    const browser = await chromium.launch()
    try {
        const page = await browser.newPage()
        await page.setContent(shell)
        await signInToApp(page, credentials)
        assert.equal(await page.locator('table').count(), 0)
        await page.setContent(dialog)
        await page.getByRole('button').evaluate((button, markup) => {
            button.addEventListener('click', () => {
                document.body.innerHTML = markup
            })
        }, shell)
        await signInToApp(page, credentials)
        await page.setContent('<button>Finish startup</button>')
        await page.getByRole('button').evaluate((button, markup) => {
            button.addEventListener('click', () => {
                document.body.innerHTML = markup
            })
        }, shell)
        const pending = signInToApp(page, credentials)
        await page.getByRole('button', { name: 'Finish startup' }).click()
        await pending
        await page.setContent('<body>Failed startup</body>')
        await assert.rejects(signInToApp(page, credentials, 250), /toBeVisible/)
        await page.setContent(dialog)
        await page.getByRole('button').evaluate((button) => {
            button.addEventListener('click', () => {
                document.body.insertAdjacentHTML(
                    'beforeend',
                    '<p role="alert">Invalid credentials</p>'
                )
            })
        })
        await assert.rejects(signInToApp(page, credentials, 250), /toBeVisible/)
        assert.equal(
            await page.getByRole('alert').textContent(),
            'Invalid credentials'
        )
    } finally {
        await browser.close()
    }
})
