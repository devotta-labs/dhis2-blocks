import { expect, type Page } from '@playwright/test'

type AppCredentials = { username: string; password: string; serverUrl: string }

const shell = (page: Page) =>
    page.locator('[aria-label="Working list context"]').first()
const login = (page: Page) =>
    page.getByRole('dialog').filter({
        has: page.getByRole('heading', { name: 'Please sign in' }),
    })

export const authenticatedShellReady = async (page: Page, timeout = 30_000) => {
    await expect(shell(page)).toBeVisible({ timeout })
    await expect(page.getByTestId('working-list-heading')).toBeAttached({
        timeout,
    })
    await expect(
        page.locator('[data-test="program-selector-container"]')
    ).toBeVisible({ timeout })
    await expect(login(page)).toBeHidden({ timeout })
}

export const signInToApp = async (
    page: Page,
    credentials: AppCredentials,
    timeout = 30_000
) => {
    const dialog = login(page)
    await expect(dialog.or(shell(page)).first()).toBeVisible({ timeout })
    if (await dialog.isVisible()) {
        await dialog
            .getByRole('textbox', { name: 'Server' })
            .fill(credentials.serverUrl)
        await dialog
            .getByRole('textbox', { name: 'Username' })
            .fill(credentials.username)
        await dialog
            .getByRole('textbox', { name: 'Password' })
            .fill(credentials.password)
        await dialog.getByRole('button', { name: 'Sign in' }).click()
    }
    await authenticatedShellReady(page, timeout)
}
