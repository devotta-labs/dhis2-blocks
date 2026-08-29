import { existsSync, readdirSync, readFileSync } from 'node:fs'
import path from 'node:path'

interface RegistryFile {
    path: string
    type: string
    target?: string
}

interface RegistryItem {
    name: string
    type: string
    dependencies?: string[]
    files?: RegistryFile[]
}

interface RegistryManifest {
    items?: RegistryItem[]
}

interface PackageManifest {
    dependencies: Record<string, string>
    peerDependencies: Record<string, string>
    sideEffects?: boolean | string[]
}

const packageRoot = path.resolve(__dirname, '..')
const sourceRoot = path.join(packageRoot, 'src')
const registryPath = path.join(packageRoot, 'registry.json')

// SAFETY: Repository-owned JSON is immediately validated by exact manifest assertions.
const readJson = <T>(filePath: string): T =>
    JSON.parse(readFileSync(filePath, 'utf8')) as T

const listFiles = (directory: string): string[] =>
    readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
        const entryPath = path.join(directory, entry.name)
        return entry.isDirectory() ? listFiles(entryPath) : [entryPath]
    })

const toPosixPath = (filePath: string) => filePath.split(path.sep).join('/')

describe('context-selector package registry', () => {
    const registry = readJson<RegistryManifest>(registryPath)
    const item = registry.items?.find(
        (candidate) => candidate.name === 'context-selector'
    )

    it('declares one package-owned block with existing source files', () => {
        expect(registry.items).toHaveLength(1)
        expect(item).toMatchObject({
            name: 'context-selector',
            type: 'registry:block',
        })

        for (const file of item?.files ?? []) {
            expect(file.type).toBe('registry:file')
            expect(path.isAbsolute(file.path)).toBe(false)
            expect(existsSync(path.resolve(packageRoot, file.path))).toBe(true)
        }
    })

    it('enumerates every production source with a package target', () => {
        const expectedPaths = listFiles(sourceRoot)
            .map((filePath) =>
                toPosixPath(path.relative(packageRoot, filePath))
            )
            .filter((filePath) => !/\.test\.(ts|tsx)$/.test(filePath))
            .filter((filePath) => !filePath.includes('/__screenshots__/'))
            .sort()
        const declaredFiles = item?.files ?? []

        expect(declaredFiles.map((file) => file.path).sort()).toEqual(
            expectedPaths
        )
        expect(new Set(declaredFiles.map((file) => file.path)).size).toBe(
            declaredFiles.length
        )
        for (const file of declaredFiles) {
            expect(file.target).toBe(
                `@components/context-selector/${file.path.replace('src/', '')}`
            )
        }
    })

    it('declares all runtime and peer dependencies and Tailwind source', () => {
        const packageManifest = readJson<PackageManifest>(
            path.join(packageRoot, 'package.json')
        )
        const dependencies = Object.entries({
            ...packageManifest.dependencies,
            ...packageManifest.peerDependencies,
        })
            .map(([name, version]) => `${name}@${version}`)
            .sort()

        expect([...(item?.dependencies ?? [])].sort()).toEqual(dependencies)
        expect(
            item?.files?.some((file) => file.path.endsWith('.module.css'))
        ).toBe(false)
        expect(packageManifest.sideEffects).toBeUndefined()
    })
})
