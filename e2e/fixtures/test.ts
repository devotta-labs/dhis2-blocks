import {
    test as base,
    expect,
    type APIRequestContext,
    type Page,
} from '@playwright/test'

import { signInToApp } from './app-readiness'
import { withBrowserDiagnostics } from './browser-diagnostics'
import { unexpectedWebDiagnostics } from './web-diagnostic-policy'

type WorkingListFixtures = {
    allowSharingTypeWarning: boolean
    allowOfflineRequestFailures: boolean
    dhis2: APIRequestContext
    e2eCredentials: E2ECredentials
    page: Page
}

const environment = process.env
const username = environment?.E2E_DHIS2_USERNAME ?? 'admin'
const password = environment?.E2E_DHIS2_PASSWORD ?? 'district'

export type E2ECredentials = {
    username: string
    password: string
}

export const e2eEnvironment = {
    appUrl: environment?.E2E_APP_URL,
    dhis2Url: environment?.E2E_DHIS2_URL,
    proxyUrl: environment?.E2E_PROXY_URL,
}

export const test = base.extend<WorkingListFixtures>({
    allowOfflineRequestFailures: [false, { option: true }],
    allowSharingTypeWarning: [false, { option: true }],
    e2eCredentials: [{ username, password }, { option: true }],
    dhis2: async ({ playwright }, use) => {
        const baseURL = environment?.E2E_DHIS2_URL
        if (!baseURL) {
            throw new Error(
                'E2E_DHIS2_URL is required. Start a target with scripts/e2e/up.sh first.'
            )
        }

        const api = await playwright.request.newContext({
            baseURL,
            extraHTTPHeaders: {
                Accept: 'application/json',
                Authorization: `Basic ${globalThis.btoa(`${username}:${password}`)}`,
            },
        })

        await use(api)
        await api.dispose()
    },
    page: async (
        {
            allowOfflineRequestFailures,
            allowSharingTypeWarning,
            e2eCredentials,
            page,
        },
        use,
        testInfo
    ) =>
        withBrowserDiagnostics({
            page,
            testInfo,
            unexpected: (diagnostics) =>
                unexpectedWebDiagnostics(diagnostics, {
                    allowOfflineRequestFailures,
                    allowSharingTypeWarning,
                }),
            run: async () => {
                const response = await page.goto('/')
                if (!response?.ok()) {
                    throw new Error(
                        `The app shell returned HTTP ${response?.status() ?? 'unknown'} at ${page.url()}`
                    )
                }
                const serverUrl =
                    e2eEnvironment.proxyUrl ?? e2eEnvironment.dhis2Url
                if (!serverUrl)
                    throw new Error(
                        'E2E_PROXY_URL or E2E_DHIS2_URL is required.'
                    )
                await signInToApp(page, { ...e2eCredentials, serverUrl })
                await use(page)
            },
        }),
})

export const testFromDhis2Version = (minimumVersion: number) => {
    const targetMajor = Number(environment?.E2E_EXPECTED_MAJOR)
    return !Number.isFinite(targetMajor) || targetMajor >= minimumVersion
        ? test
        : test.skip
}

export { expect }
