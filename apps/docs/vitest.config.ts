import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'

export default defineConfig({
    // A lab server test checks its answers against the block's own schemas.
    resolve: {
        alias: {
            '@/components': fileURLToPath(
                new URL('../../packages/registry/blocks', import.meta.url)
            ),
        },
    },
    test: {
        include: ['server/**/*.test.mjs', 'src/playground/**/*.test.ts'],
        environment: 'node',
    },
})
