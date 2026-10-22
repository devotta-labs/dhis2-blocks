import { readdirSync, readFileSync } from 'node:fs'
import { join, relative } from 'node:path'
import {
    HOST_PACKAGES,
    importedSpecifiers,
    isRelative,
    packageName,
} from '../../../../tools/registry/manifest.ts'

const PACKAGE_DIR = join(import.meta.dirname, '..')
const SOURCE_DIR = join(PACKAGE_DIR, 'src')
const ADDRESS_PREFIX = 'devotta-labs/dhis2-blocks/'
const SHARED_UI_PREFIX = '@/registry/dhis2/ui/'
const THEME_ITEM = `${ADDRESS_PREFIX}dhis2-theme`
const HOOK_ITEM = 'use-tracked-entity-observations'
const BLOCK_ITEM = 'observation-cards'
// Both items install side by side, so their relative imports keep working.
const TARGET_PREFIX = '@components/observation-cards/'
// Test-only recordings of DHIS2 responses.
const FIXTURES = 'src/hooks/__fixtures__/'

interface RegistryItem {
    name: string
    type: string
    dependencies: string[]
    registryDependencies?: string[]
    cssVars?: unknown
    files: { path: string; type: string; target: string }[]
}

const readJson = (path: string) => JSON.parse(readFileSync(path, 'utf8'))

const item = (name: string): RegistryItem => {
    const found = readJson(join(PACKAGE_DIR, 'registry.json')).items.find(
        (candidate: RegistryItem) => candidate.name === name
    )
    if (found === undefined) {
        throw new Error(`registry.json has no ${name} item`)
    }
    return found
}

const listFiles = (directory: string): string[] =>
    readdirSync(directory, { withFileTypes: true }).flatMap((entry) =>
        entry.isDirectory()
            ? listFiles(join(directory, entry.name))
            : [join(directory, entry.name)]
    )

const nonTestSourceFiles = (): string[] =>
    listFiles(SOURCE_DIR)
        .map((file) => relative(PACKAGE_DIR, file))
        .filter(
            (file) => !/\.test\.tsx?$/.test(file) && !file.startsWith(FIXTURES)
        )

const isHookFile = (file: string): boolean =>
    file === 'src/use-tracked-entity-observations.ts' ||
    file.startsWith('src/hooks/')

const itemPaths = (name: string): string[] =>
    item(name)
        .files.map((file) => file.path)
        .sort()

const specifiersOf = (files: string[]): string[] =>
    files.flatMap((file) =>
        importedSpecifiers(readFileSync(join(PACKAGE_DIR, file), 'utf8'))
    )

test('every non-test source file is shipped by exactly one item', () => {
    expect([...itemPaths(HOOK_ITEM), ...itemPaths(BLOCK_ITEM)].sort()).toEqual(
        nonTestSourceFiles().sort()
    )
})

test('the hook item holds the hook and its internals, the block item the cards', () => {
    const files = nonTestSourceFiles()
    expect(itemPaths(HOOK_ITEM)).toEqual(files.filter(isHookFile).sort())
    expect(itemPaths(BLOCK_ITEM)).toEqual(
        files.filter((file) => !isHookFile(file)).sort()
    )
    expect(item(HOOK_ITEM).type).toBe('registry:hook')
    expect(item(BLOCK_ITEM).type).toBe('registry:block')
})

test('both items install into one directory, mirroring src', () => {
    for (const name of [HOOK_ITEM, BLOCK_ITEM]) {
        for (const file of item(name).files) {
            expect(file).toEqual({
                path: file.path,
                type: 'registry:file',
                target: file.path.replace(/^src\//, TARGET_PREFIX),
            })
        }
    }
})

test('the block depends on the hook, the theme and every shared primitive it imports', () => {
    const imported = specifiersOf(itemPaths(BLOCK_ITEM))
        .filter((specifier) => specifier.startsWith(SHARED_UI_PREFIX))
        .map((specifier) => ADDRESS_PREFIX + specifier.split('/').pop())
    expect(imported.length).toBeGreaterThan(0)
    expect(item(BLOCK_ITEM).registryDependencies).toEqual(
        [
            ...new Set([
                ...imported,
                THEME_ITEM,
                `${ADDRESS_PREFIX}${HOOK_ITEM}`,
            ]),
        ].sort()
    )
})

test('the hook item needs no other registry item', () => {
    expect(item(HOOK_ITEM).registryDependencies).toBeUndefined()
    expect(
        specifiersOf(itemPaths(HOOK_ITEM)).filter((specifier) =>
            specifier.startsWith('@/')
        )
    ).toEqual([])
})

test('dependencies are exactly the packages each item imports', () => {
    const versions = {
        ...readJson(join(PACKAGE_DIR, '..', 'ui', 'package.json')).dependencies,
        ...readJson(join(PACKAGE_DIR, 'package.json')).dependencies,
    }
    for (const name of [HOOK_ITEM, BLOCK_ITEM]) {
        const external = new Set(
            specifiersOf(itemPaths(name))
                .filter(
                    (specifier) =>
                        !isRelative(specifier) &&
                        !specifier.startsWith('@/') &&
                        !HOST_PACKAGES.has(packageName(specifier))
                )
                .map(packageName)
        )
        const expected = [...external].map((dependency) => {
            expect(versions[dependency]).toBeDefined()
            return `${dependency}@${versions[dependency]}`
        })
        expect([...item(name).dependencies].sort(), name).toEqual(
            expected.sort()
        )
    }
})

test('neither item ships a theme of its own', () => {
    expect(item(HOOK_ITEM).cssVars).toBeUndefined()
    expect(item(BLOCK_ITEM).cssVars).toBeUndefined()
})
