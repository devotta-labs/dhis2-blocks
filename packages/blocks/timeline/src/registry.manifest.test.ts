import { readdirSync, readFileSync } from 'node:fs'
import { join, relative } from 'node:path'
import { registryItemSchema } from 'shadcn/schema'
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
const VALUE_DISPLAY = '@/registry/dhis2/value-display'
const isValueDisplay = (specifier: string) =>
    specifier === VALUE_DISPLAY || specifier.startsWith(`${VALUE_DISPLAY}/`)
const THEME_ITEM = `${ADDRESS_PREFIX}dhis2-theme`
const VALUE_DISPLAY_ITEM = `${ADDRESS_PREFIX}dhis2-value-display`
const ITEM = 'timeline'
const TARGET_PREFIX = '@components/timeline/'
// Test-only data and helpers.
const FIXTURES = '/__fixtures__/'

const readJson = (path: string) => JSON.parse(readFileSync(path, 'utf8'))

const item = () => {
    const items = registryItemSchema
        .array()
        .parse(readJson(join(PACKAGE_DIR, 'registry.json')).items)
    const found = items.find((candidate) => candidate.name === ITEM)
    if (found === undefined) {
        throw new Error(`registry.json has no ${ITEM} item`)
    }
    return {
        ...found,
        files: found.files ?? [],
        dependencies: found.dependencies ?? [],
    }
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
            (file) => !/\.test\.tsx?$/.test(file) && !file.includes(FIXTURES)
        )

const itemPaths = (): string[] => item().files.map((file) => file.path).sort()

const specifiers = (): string[] =>
    itemPaths().flatMap((file) =>
        importedSpecifiers(readFileSync(join(PACKAGE_DIR, file), 'utf8'))
    )

test('every non-test source file is shipped by the item', () => {
    expect(itemPaths()).toEqual(nonTestSourceFiles().sort())
})

test('the item installs into one directory, mirroring src', () => {
    expect(item().type).toBe('registry:block')
    for (const file of item().files) {
        expect(file).toEqual({
            path: file.path,
            type: 'registry:file',
            target: file.path.replace(/^src\//, TARGET_PREFIX),
        })
    }
})

test('the item depends on the theme, value display and every shared primitive it imports', () => {
    const imported = specifiers()
        .filter((specifier) => specifier.startsWith(SHARED_UI_PREFIX))
        .map((specifier) => ADDRESS_PREFIX + specifier.split('/').pop())
    expect(imported.length).toBeGreaterThan(0)
    expect(
        specifiers().some(isValueDisplay)
    ).toBe(true)
    expect(item().registryDependencies).toEqual(
        [...new Set([...imported, THEME_ITEM, VALUE_DISPLAY_ITEM])].sort()
    )
})

test('imports nothing from another block', () => {
    const foreign = specifiers().filter(
        (specifier) =>
            specifier.startsWith('@/') &&
            !specifier.startsWith(SHARED_UI_PREFIX) &&
            !isValueDisplay(specifier)
    )
    expect(foreign).toEqual([])
})

test('dependencies are exactly the packages the item imports', () => {
    const versions = {
        ...readJson(join(PACKAGE_DIR, '..', 'ui', 'package.json')).dependencies,
        ...readJson(join(PACKAGE_DIR, 'package.json')).dependencies,
    }
    const external = new Set(
        specifiers()
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
    expect([...item().dependencies].sort()).toEqual(expected.sort())
})

test('the item ships no theme of its own', () => {
    expect(item().cssVars).toBeUndefined()
})
