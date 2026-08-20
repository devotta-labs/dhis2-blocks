import path from 'node:path'
import { defineConfig } from 'vite'
import packageJson from './package.json'

const externalDependencies = [
    ...Object.keys(packageJson.dependencies),
    ...Object.keys(packageJson.peerDependencies),
]

const isExternalDependency = (id: string) =>
    externalDependencies.some(
        (dependency) => id === dependency || id.startsWith(`${dependency}/`)
    )

export default defineConfig({
    build: {
        outDir: 'dist',
        emptyOutDir: false,
        lib: {
            entry: path.resolve(__dirname, 'src/url-state.ts'),
            formats: ['cjs'],
            fileName: () => 'url-state.cjs',
        },
        rollupOptions: {
            external: isExternalDependency,
        },
        sourcemap: true,
    },
})
