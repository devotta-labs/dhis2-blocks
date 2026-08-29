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
    include?: string[]
    items?: RegistryItem[]
}

interface ResolvedRegistryItem {
    item: RegistryItem
    manifestPath: string
}

interface PackageManifest {
    dependencies: Record<string, string>
    peerDependencies: Record<string, string>
    sideEffects?: boolean | string[]
}

const repositoryRoot = path.resolve(__dirname, '../../../..')
const packageRoot = path.resolve(__dirname, '..')
const sourceRoot = path.join(packageRoot, 'src')
const rootRegistryPath = path.join(repositoryRoot, 'registry.json')
const packageRegistryPath = path.join(packageRoot, 'registry.json')

const readJson = <T>(filePath: string): T => {
    // SAFETY: These repository-owned manifests are exercised immediately by
    // exact shape and content assertions in this test suite.
    return JSON.parse(readFileSync(filePath, 'utf8')) as T
}

const resolveRegistryItems = (
    manifestPath: string,
    visitedManifestPaths = new Set<string>()
): ResolvedRegistryItem[] => {
    const normalizedManifestPath = path.resolve(manifestPath)

    if (visitedManifestPaths.has(normalizedManifestPath)) {
        throw new Error(
            `Registry manifest was included more than once: ${normalizedManifestPath}`
        )
    }

    visitedManifestPaths.add(normalizedManifestPath)
    const manifest = readJson<RegistryManifest>(normalizedManifestPath)
    const ownedItems = (manifest.items ?? []).map((item) => ({
        item,
        manifestPath: normalizedManifestPath,
    }))
    const includedItems = (manifest.include ?? []).flatMap((includePath) =>
        resolveRegistryItems(
            path.resolve(path.dirname(normalizedManifestPath), includePath),
            visitedManifestPaths
        )
    )

    return [...ownedItems, ...includedItems]
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

describe('resolved source registry', () => {
    const rootRegistry = readJson<RegistryManifest>(rootRegistryPath)
    const resolvedItems = resolveRegistryItems(rootRegistryPath)
    const workingListEntry = resolvedItems.find(
        ({ item }) => item.name === 'working-list'
    )

    it('composes the package-owned Working List manifest from the root', () => {
        expect(rootRegistry.items).toBeUndefined()
        expect(rootRegistry.include).toEqual([
            'packages/blocks/context-selector/registry.json',
            'packages/blocks/working-list/registry.json',
        ])
        expect(workingListEntry).toMatchObject({
            manifestPath: packageRegistryPath,
            item: {
                name: 'working-list',
                type: 'registry:block',
            },
        })
    })

    it('resolves unique items and existing package-relative source paths', () => {
        const itemNames = resolvedItems.map(({ item }) => item.name)
        expect(new Set(itemNames).size).toBe(itemNames.length)

        for (const { item, manifestPath } of resolvedItems) {
            for (const file of item.files ?? []) {
                expect(path.isAbsolute(file.path)).toBe(false)
                expect(
                    existsSync(
                        path.resolve(path.dirname(manifestPath), file.path)
                    )
                ).toBe(true)
            }
        }
    })

    it('prevents multiple resolved items from owning the same target', () => {
        const targetOwners = new Map<string, string>()
        const duplicateTargetOwners: string[] = []

        for (const { item } of resolvedItems) {
            for (const file of item.files ?? []) {
                if (!file.target) {
                    continue
                }

                const existingOwner = targetOwners.get(file.target)
                if (existingOwner) {
                    duplicateTargetOwners.push(
                        `${file.target}: ${existingOwner}, ${item.name}`
                    )
                } else {
                    targetOwners.set(file.target, item.name)
                }
            }
        }

        expect(duplicateTargetOwners).toEqual([])
    })

    it('enumerates every Working List production source with its target', () => {
        expect(workingListEntry).toBeDefined()
        const item = workingListEntry!.item
        const expectedPaths = listFiles(sourceRoot)
            .map((filePath) =>
                toPosixPath(path.relative(packageRoot, filePath))
            )
            .filter((filePath) =>
                isProductionSource(filePath.replace('src/', ''))
            )
            .sort()
        const declaredFiles = item.files ?? []
        const declaredPaths = declaredFiles.map((file) => file.path).sort()

        expect(declaredPaths).toEqual(expectedPaths)
        expect(new Set(declaredPaths).size).toBe(declaredPaths.length)

        for (const file of declaredFiles) {
            const relativePath = file.path.replace('src/', '')
            expect(file).toEqual({
                path: file.path,
                type: 'registry:file',
                target: `@components/working-list/${relativePath}`,
            })
        }
    })

    it('declares every Working List runtime and peer dependency', () => {
        expect(workingListEntry).toBeDefined()
        const packageManifest = readJson<PackageManifest>(
            path.join(packageRoot, 'package.json')
        )
        const expectedDependencies = Object.entries({
            ...packageManifest.dependencies,
            ...packageManifest.peerDependencies,
        })
            .map(([name, version]) => `${name}@${version}`)
            .sort()

        expect([...(workingListEntry!.item.dependencies ?? [])].sort()).toEqual(
            expectedDependencies
        )
    })

    it('ships Tailwind-styled source without CSS Module artifacts', () => {
        expect(workingListEntry).toBeDefined()
        const packageManifest = readJson<PackageManifest>(
            path.join(packageRoot, 'package.json')
        )
        const declaredPaths = (workingListEntry!.item.files ?? []).map(
            (file) => file.path
        )

        expect(declaredPaths).not.toContain('src/css-modules.d.ts')
        expect(
            declaredPaths.some((filePath) => filePath.endsWith('.module.css'))
        ).toBe(false)
        expect(packageManifest.sideEffects).toBeUndefined()
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
