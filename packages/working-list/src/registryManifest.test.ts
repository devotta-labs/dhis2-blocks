import { readdirSync, readFileSync } from 'node:fs'
import path from 'node:path'

interface RegistryFile {
    path: string
    type: string
    target: string
}

interface RegistryItem {
    name: string
    type: string
    dependencies: string[]
    files: RegistryFile[]
}

interface RegistryManifest {
    items: RegistryItem[]
}

interface PackageManifest {
    dependencies: Record<string, string>
    peerDependencies: Record<string, string>
}

const repositoryRoot = path.resolve(__dirname, '../../..')
const sourceRoot = path.join(repositoryRoot, 'packages/working-list/src')

const readJson = <T>(filePath: string): T => {
    // SAFETY: These repository-owned manifests are exercised immediately by
    // exact shape and content assertions in this test suite.
    return JSON.parse(readFileSync(filePath, 'utf8')) as T
}

const listFiles = (directory: string): string[] =>
    readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
        const entryPath = path.join(directory, entry.name)
        return entry.isDirectory() ? listFiles(entryPath) : [entryPath]
    })

const toPosixPath = (filePath: string) => filePath.split(path.sep).join('/')

const isProductionSource = (relativePath: string) =>
    relativePath !== 'development.ts' &&
    relativePath !== 'ui/reactActEnvironment.d.ts' &&
    !relativePath.includes('/__tests__/') &&
    !/\.test\.(ts|tsx)$/.test(relativePath)

describe('working-list source registry', () => {
    const registry = readJson<RegistryManifest>(
        path.join(repositoryRoot, 'registry.json')
    )
    const packageManifest = readJson<PackageManifest>(
        path.join(repositoryRoot, 'packages/working-list/package.json')
    )

    it('publishes one source-owned Working List block', () => {
        expect(registry.items).toHaveLength(1)
        expect(registry.items[0]).toMatchObject({
            name: 'working-list',
            type: 'registry:block',
        })
    })

    it('enumerates every production source file with its explicit target', () => {
        const item = registry.items[0]
        const expectedPaths = listFiles(sourceRoot)
            .map((filePath) =>
                toPosixPath(path.relative(repositoryRoot, filePath))
            )
            .filter((filePath) =>
                isProductionSource(
                    filePath.replace('packages/working-list/src/', '')
                )
            )
            .sort()
        const declaredPaths = item.files.map((file) => file.path).sort()

        expect(declaredPaths).toEqual(expectedPaths)
        expect(new Set(declaredPaths).size).toBe(declaredPaths.length)

        for (const file of item.files) {
            const relativePath = file.path.replace(
                'packages/working-list/src/',
                ''
            )
            expect(file).toEqual({
                path: file.path,
                type: 'registry:file',
                target: `@components/working-list/${relativePath}`,
            })
        }
    })

    it('declares every workspace runtime and peer dependency', () => {
        const expectedDependencies = Object.entries({
            ...packageManifest.dependencies,
            ...packageManifest.peerDependencies,
        })
            .map(([name, version]) => `${name}@${version}`)
            .sort()

        expect([...registry.items[0].dependencies].sort()).toEqual(
            expectedDependencies
        )
    })

    it('does not rely on repository-only DHIS2 UI patches', () => {
        const workspaceManifest = readFileSync(
            path.join(repositoryRoot, 'pnpm-workspace.yaml'),
            'utf8'
        )

        expect(workspaceManifest).not.toContain('@dhis2-ui/sharing-dialog')
        expect(workspaceManifest).not.toContain('@dhis2-ui/transfer')
    })
})
