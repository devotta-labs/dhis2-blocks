import { defineConfig, devices } from '@playwright/test'

const environment = process.env
const targetVersion = environment?.E2E_VERSION_SLUG ?? 'dev'
const appUrl = environment?.E2E_APP_URL ?? 'http://localhost:59444'
const artifactRoot = `e2e/artifacts/${targetVersion}`

export default defineConfig({
    testDir: './e2e/specs',
    outputDir: `${artifactRoot}/test-results`,
    globalSetup: './e2e/global-setup.ts',
    webServer: {
        command:
            'mkdir -p "$E2E_ARTIFACT_DIR" && exec pnpm exec d2-app-scripts start --port "$E2E_APP_PORT" --proxy "$E2E_DHIS2_URL" --proxyPort "$E2E_PROXY_PORT" --host localhost > "$E2E_ARTIFACT_DIR/app-server.log" 2>&1',
        cwd: './apps/web',
        env: {
            E2E_ARTIFACT_DIR: `../../${artifactRoot}`,
            E2E_APP_PORT: environment.E2E_APP_PORT ?? new URL(appUrl).port,
            E2E_DHIS2_URL:
                environment.E2E_DHIS2_URL ?? 'http://127.0.0.1:58444',
            E2E_PROXY_PORT: environment.E2E_PROXY_PORT ?? '60444',
        },
        url: appUrl,
        timeout:
            Number(environment.E2E_APP_STARTUP_TIMEOUT_SECONDS ?? 300) * 1000,
        reuseExistingServer: false,
        gracefulShutdown: { signal: 'SIGTERM', timeout: 5000 },
    },
    fullyParallel: true,
    workers: environment?.CI ? 2 : undefined,
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
