import { defineConfig } from 'vitest/config'

export default defineConfig({
    test: {
        globals: true,
        passWithNoTests: false,
        environment: 'node',
        include: ['src/**/*.test.ts'],
    },
})
