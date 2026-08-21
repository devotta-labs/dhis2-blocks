import tailwindcss from '@tailwindcss/vite'
import { defineConfig } from 'vite'

const viteConfig = defineConfig(({ mode }) => {
    return {
        // In dev environments, don't clear the terminal after files update
        clearScreen: mode !== 'development',
        resolve: {
            conditions:
                mode === 'development' ? ['@dhis2-blocks/development'] : [],
        },
        plugins: [tailwindcss()],
        // ...other config options here
    }
})

export default viteConfig
