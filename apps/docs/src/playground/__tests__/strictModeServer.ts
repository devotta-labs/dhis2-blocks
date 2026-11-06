import { resolve } from 'node:path'
import { createServer } from 'vite'

// Keep the Vite dependency in the docs workspace; E2E normally uses its production preview.
export const createStrictModeServer = (root: string) => {
    return createServer({
        root,
        configFile: resolve(root, 'vite.config.ts'),
        logLevel: 'error',
        server: { host: '127.0.0.1', port: 0, strictPort: true },
    })
}
