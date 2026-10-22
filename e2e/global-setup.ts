import { expect, request } from '@playwright/test'
import type { FullConfig } from '@playwright/test'

export default async function globalSetup(config: FullConfig) {
    const context = await request.newContext({
        baseURL: config.projects[0].use.baseURL,
    })
    const timeout =
        Number(process.env.E2E_APP_STARTUP_TIMEOUT_SECONDS ?? 300) * 1000

    try {
        // The d2 app root responds before both generated entry modules are ready.
        for (const path of ['/src/D2App/AppWrapper.tsx', '/src/App.jsx']) {
            await expect
                .poll(async () => (await context.get(path)).status(), {
                    message: `Waiting for ${path}; see app-server.log`,
                    timeout,
                })
                .toBe(200)
        }
    } finally {
        await context.dispose()
    }
}
