import path from 'node:path'
import { defineConfig } from 'vite'
import { libInjectCss } from 'vite-plugin-lib-inject-css'
import packageJson from './package.json'

const externalDependencies = [
    ...Object.keys(packageJson.dependencies),
    ...Object.keys(packageJson.peerDependencies),
]

const isExternalDependency = (id: string) =>
    externalDependencies.some(
        (dependency) => id === dependency || id.startsWith(`${dependency}/`)
    )

export default defineConfig(({ mode }) => {
    const isWatchMode = mode === 'development'

    return {
        plugins: [libInjectCss()],
        build: {
            outDir: 'dist',
            emptyOutDir: !isWatchMode,
            lib: {
                entry: path.resolve(__dirname, 'src/index.ts'),
                formats: ['es'],
                fileName: () => 'index.mjs',
            },
            rollupOptions: {
                external: isExternalDependency,
            },
            sourcemap: true,
        },
    }
})
