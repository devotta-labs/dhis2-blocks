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
const ITEM = 'dhis2-value-display'
const TARGET_PREFIX = '@components/dhis2/value-display/'

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
        .filter((file) => !/\.test\.tsx?$/.test(file))

const itemPaths = (): string[] =>
    item()
        .files.map((file) => file.path)
        .sort()

const specifiers = (): string[] =>
    itemPaths().flatMap((file) =>
        importedSpecifiers(readFileSync(join(PACKAGE_DIR, file), 'utf8'))
    )

test('every non-test source file is shipped by the item', () => {
    expect(itemPaths()).toEqual(nonTestSourceFiles().sort())
})

test('the item is a lib that installs into one directory, mirroring src', () => {
    expect(item().type).toBe('registry:lib')
    for (const file of item().files) {
        expect(file).toEqual({
            path: file.path,
            type: 'registry:file',
            target: file.path.replace(/^src\//, TARGET_PREFIX),
        })
    }
})

test('the item needs no other registry item', () => {
    expect(item().registryDependencies).toBeUndefined()
    expect(
        specifiers().filter((specifier) => specifier.startsWith('@/'))
    ).toEqual([])
})

test('the item imports nothing relative outside src', () => {
    for (const file of itemPaths()) {
        const directory = join(PACKAGE_DIR, file, '..')
        for (const specifier of importedSpecifiers(
            readFileSync(join(PACKAGE_DIR, file), 'utf8')
        ).filter(isRelative)) {
            expect(
                relative(SOURCE_DIR, join(directory, specifier)).startsWith(
                    '..'
                ),
                `${file} imports ${specifier}`
            ).toBe(false)
        }
    }
})

test('dependencies are exactly the packages the item imports', () => {
    const versions = readJson(join(PACKAGE_DIR, 'package.json')).dependencies
    const external = new Set(
        specifiers()
            .filter(
                (specifier) =>
                    !isRelative(specifier) &&
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

test('the item ships no theme', () => {
    expect(item().cssVars).toBeUndefined()
})
