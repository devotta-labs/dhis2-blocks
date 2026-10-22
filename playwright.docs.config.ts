import { defineConfig, devices } from '@playwright/test'

const environment = process.env

const appUrl = environment?.DOCS_APP_URL ?? 'http://localhost:3002'

const artifactRoot = 'e2e/artifacts/docs'

export default defineConfig({
    testDir: './e2e/specs-docs',
    outputDir: `${artifactRoot}/test-results`,
    webServer: {
        command:
            'mkdir -p "$DOCS_ARTIFACT_DIR" && exec pnpm preview --port "$DOCS_PORT" --strictPort --host localhost > "$DOCS_ARTIFACT_DIR/docs-server.log" 2>&1',
        cwd: './apps/docs',
        env: {
            DOCS_ARTIFACT_DIR: `../../${artifactRoot}`,
            DOCS_PORT: new URL(appUrl).port,
        },
        url: appUrl,
        timeout:
            Number(environment.DOCS_APP_STARTUP_TIMEOUT_SECONDS ?? 300) * 1000,
        reuseExistingServer: false,
        gracefulShutdown: { signal: 'SIGTERM', timeout: 5000 },
    },
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
        screenshot: 'only-on-failure',
        trace: 'retain-on-failure',
        video: 'retain-on-failure',
    },
    projects: [
        {
            name: 'chromium-docs',
            use: { ...devices['Desktop Chrome'] },
        },
    ],
})
