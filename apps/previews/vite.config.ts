import { fileURLToPath, URL } from 'node:url'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig } from 'vite'

export default defineConfig({
    base: '/previews/',
    plugins: [tailwindcss()],
    resolve: {
        dedupe: ['react', 'react-dom', '@dhis2/app-runtime', 'styled-jsx'],
    },
    build: {
        rollupOptions: {
            input: fileURLToPath(
                new URL('./working-list/basic/index.html', import.meta.url)
            ),
        },
    },
})
