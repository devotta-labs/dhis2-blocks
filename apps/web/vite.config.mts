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
                '@/components/dhis2/ui': fileURLToPath(
                    new URL(
                        '../../packages/registry/components',
                        import.meta.url
                    )
                ),
                '@/components': fileURLToPath(
                    new URL('../../packages/registry/blocks', import.meta.url)
                ),
            },
        },
        // ...other config options here
    }
})

export default viteConfig
