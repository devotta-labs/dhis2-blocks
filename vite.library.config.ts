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
        outDir: 'dist/working-list',
        emptyOutDir: true,
        lib: {
            entry: path.resolve(__dirname, 'src/working-list/index.ts'),
            formats: ['es'],
            fileName: () => 'index.mjs',
            cssFileName: 'style',
        },
        rollupOptions: {
            external: isExternalDependency,
        },
        sourcemap: true,
    },
})
