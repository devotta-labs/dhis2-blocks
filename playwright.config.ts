import { defineConfig, devices } from '@playwright/test'

const environment = process.env
const targetVersion = environment?.E2E_VERSION_SLUG ?? 'dev'
const appUrl = environment?.E2E_APP_URL ?? 'http://localhost:59444'
const artifactRoot = `e2e/artifacts/${targetVersion}`

export default defineConfig({
    testDir: './e2e/specs',
    outputDir: `${artifactRoot}/test-results`,
    fullyParallel: false,
    workers: 1,
    forbidOnly: Boolean(environment?.CI),
    retries: environment?.CI ? 1 : 0,
    timeout: 60_000,
    expect: {
        timeout: 10_000,
    },
    reporter: [
        ['list'],
        [
            'html',
            {
                outputFolder: `${artifactRoot}/html-report`,
                open: 'never',
            },
        ],
    ],
    use: {
        baseURL: appUrl,
        httpCredentials: {
            username: environment?.E2E_DHIS2_USERNAME ?? 'admin',
            password: environment?.E2E_DHIS2_PASSWORD ?? 'district',
        },
        screenshot: 'only-on-failure',
        trace: 'retain-on-failure',
        video: 'retain-on-failure',
    },
    projects: [
        {
            name: `chromium-dhis2-${targetVersion}`,
            use: { ...devices['Desktop Chrome'] },
        },
    ],
})
