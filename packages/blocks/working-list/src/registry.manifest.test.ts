import { readdirSync, readFileSync } from 'node:fs'
import { join, relative } from 'node:path'

const PACKAGE_DIR = join(import.meta.dirname, '..')
const SOURCE_DIR = join(PACKAGE_DIR, 'src')
const ADDRESS_PREFIX = 'devotta-labs/dhis2-blocks/'
const SHARED_UI_PREFIX = '@/registry/dhis2/ui/'
// Working List uses dhis2 tokens directly, beyond what the primitives pull in.
const THEME_ITEM = `${ADDRESS_PREFIX}dhis2-theme`
// Provided by the consumer app, never installed by an item.
const HOST_PACKAGES = new Set(['react', 'react-dom'])
// Repository-only: the demo entry point and a test-environment declaration.
const NOT_SHIPPED = new Set([
    'src/development.ts',
    'src/ui/reactActEnvironment.d.ts',
])
const IMPORT_SPECIFIER =
    /(?:\b(?:import|export)\s[^'"]*?\bfrom|\bimport)\s*['"]([^'"]+)['"]/g

const readJson = (path: string) => JSON.parse(readFileSync(path, 'utf8'))

const workingListItem = () =>
    readJson(join(PACKAGE_DIR, 'registry.json')).items.find(
        (item: { name: string }) => item.name === 'working-list'
    )

const listFiles = (directory: string): string[] =>
    readdirSync(directory, { withFileTypes: true }).flatMap((entry) =>
        entry.isDirectory()
            ? listFiles(join(directory, entry.name))
            : [join(directory, entry.name)]
    )

const nonTestSourceFiles = (): string[] =>
    listFiles(SOURCE_DIR)
        .map((file) => relative(PACKAGE_DIR, file))
        .filter((file) => !/\.test\.tsx?$/.test(file) && !NOT_SHIPPED.has(file))

const importedSpecifiers = (): string[] =>
    nonTestSourceFiles().flatMap((file) =>
        [
            ...readFileSync(join(PACKAGE_DIR, file), 'utf8').matchAll(
                IMPORT_SPECIFIER
            ),
        ].map((match) => match[1])
    )

// `zustand/vanilla` installs with `zustand`; `@dhis2/ui` is scoped.
const packageName = (specifier: string) =>
    specifier
        .split('/')
        .slice(0, specifier.startsWith('@') ? 2 : 1)
        .join('/')

test('every shared primitive Working List imports is a registry dependency', () => {
    const imported = importedSpecifiers()
        .filter((specifier) => specifier.startsWith(SHARED_UI_PREFIX))
        .map((specifier) => ADDRESS_PREFIX + specifier.split('/').pop())
    expect(imported.length).toBeGreaterThan(0)
    expect(workingListItem().registryDependencies).toEqual(
        [...new Set([...imported, THEME_ITEM])].sort()
    )
})

test('every non-test source file is shipped', () => {
    expect(
        workingListItem()
            .files.map((file: { path: string }) => file.path)
            .sort()
    ).toEqual(nonTestSourceFiles().sort())
})

test('dependencies are exactly the packages the shipped source imports', () => {
    const versions = {
        ...readJson(join(PACKAGE_DIR, '..', 'ui', 'package.json')).dependencies,
        ...readJson(join(PACKAGE_DIR, 'package.json')).dependencies,
    }
    const external = new Set(
        importedSpecifiers()
            .filter(
                (specifier) =>
                    !specifier.startsWith('.') &&
                    !specifier.startsWith('@/') &&
                    !HOST_PACKAGES.has(packageName(specifier))
            )
            .map(packageName)
    )
    const expected = [...external].map((name) => {
        expect(versions[name]).toBeDefined()
        return `${name}@${versions[name]}`
    })
    expect([...workingListItem().dependencies].sort()).toEqual(expected.sort())
})

test('Working List ships no theme of its own', () => {
    expect(workingListItem().cssVars).toBeUndefined()
})
