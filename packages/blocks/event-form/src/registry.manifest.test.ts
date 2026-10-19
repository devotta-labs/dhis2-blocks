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
const PROGRAM_RULES_PREFIX = '@/registry/program-rules/'
// Event Form uses dhis2 tokens directly, beyond what the primitives pull in.
const THEME_ITEM = `${ADDRESS_PREFIX}dhis2-theme`
// Event Form reaches program rules only through the hook, which brings the lib with it.
const USE_PROGRAM_RULES_ITEM = `${ADDRESS_PREFIX}use-program-rules`
// Repository-only: fixtures and the helpers the tests render through.
const NOT_SHIPPED = /(?:\.test\.tsx?|TestSupport\.tsx?)$|(?:^|\/)__fixtures__\//

const readJson = (path: string) => JSON.parse(readFileSync(path, 'utf8'))

const eventFormItem = () =>
    readJson(join(PACKAGE_DIR, 'registry.json')).items.find(
        (item: { name: string }) => item.name === 'event-form'
    )

const listFiles = (directory: string): string[] =>
    readdirSync(directory, { withFileTypes: true }).flatMap((entry) =>
        entry.isDirectory()
            ? listFiles(join(directory, entry.name))
            : [join(directory, entry.name)]
    )

const shippedSourceFiles = (): string[] =>
    listFiles(SOURCE_DIR)
        .map((file) => relative(PACKAGE_DIR, file))
        .filter((file) => !NOT_SHIPPED.test(file))

const shippedSpecifiers = (): string[] =>
    shippedSourceFiles().flatMap((file) =>
        importedSpecifiers(readFileSync(join(PACKAGE_DIR, file), 'utf8'))
    )

test('every shared primitive Event Form imports is a registry dependency', () => {
    const specifiers = shippedSpecifiers()
    const primitives = specifiers
        .filter((specifier) => specifier.startsWith(SHARED_UI_PREFIX))
        .map((specifier) => ADDRESS_PREFIX + specifier.split('/').pop())
    expect(primitives.length).toBeGreaterThan(0)
    expect(eventFormItem().registryDependencies).toEqual(
        [...new Set([...primitives, THEME_ITEM, USE_PROGRAM_RULES_ITEM])].sort()
    )
})

test('program rules are imported through the hook only', () => {
    // The installer rewrites `@/registry/<item>/<file>` by file name, and
    // `index` is shared by every item, so only `use-program-rules` resolves.
    const imported = shippedSpecifiers().filter((specifier) =>
        specifier.startsWith(PROGRAM_RULES_PREFIX)
    )
    expect(imported.length).toBeGreaterThan(0)
    expect(new Set(imported)).toEqual(
        new Set([`${PROGRAM_RULES_PREFIX}use-program-rules`])
    )
})

test('every non-test source file is shipped', () => {
    expect(
        eventFormItem()
            .files.map((file: { path: string }) => file.path)
            .sort()
    ).toEqual(shippedSourceFiles().sort())
})

test('every shipped file installs under components/event-form', () => {
    for (const file of eventFormItem().files) {
        expect(file).toEqual({
            path: file.path,
            type: 'registry:file',
            target: file.path.replace(/^src\//, '@components/event-form/'),
        })
    }
})

test('dependencies are exactly the packages the shipped source imports', () => {
    const versions = {
        ...readJson(join(PACKAGE_DIR, '..', 'ui', 'package.json')).dependencies,
        ...readJson(join(PACKAGE_DIR, 'package.json')).dependencies,
    }
    const external = new Set(
        shippedSpecifiers()
            .filter(
                (specifier) =>
                    !isRelative(specifier) &&
                    !specifier.startsWith('@/') &&
                    !HOST_PACKAGES.has(packageName(specifier))
            )
            .map(packageName)
    )
    const expected = [...external].map((name) => {
        expect(versions[name]).toBeDefined()
        return `${name}@${versions[name]}`
    })
    expect([...eventFormItem().dependencies].sort()).toEqual(expected.sort())
})

test('Event Form ships no theme of its own', () => {
    expect(eventFormItem().cssVars).toBeUndefined()
})
