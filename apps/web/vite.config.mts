import tailwindcss from '@tailwindcss/vite'
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vite'

const viteConfig = defineConfig(({ mode }) => {
    return {
        // In dev environments, don't clear the terminal after files update
        clearScreen: mode !== 'development',
        plugins: [tailwindcss()],
        resolve: {
            alias: {
                '@/registry/dhis2/ui': fileURLToPath(
                    new URL('../../packages/blocks/ui/src', import.meta.url)
                ),
                '@/registry/dhis2/value-display': fileURLToPath(
                    new URL(
                        '../../packages/blocks/value-display/src',
                        import.meta.url
                    )
                ),
            },
        },
        // ...other config options here
    }
})

export default viteConfig
