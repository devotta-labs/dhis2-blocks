import { registryAliases } from '../../tools/registry/layout'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig } from 'vite'

const viteConfig = defineConfig(({ mode }) => {
    return {
        clearScreen: mode !== 'development',
        plugins: [tailwindcss()],
        resolve: {
            alias: registryAliases(),
        },
    }
})

export default viteConfig
