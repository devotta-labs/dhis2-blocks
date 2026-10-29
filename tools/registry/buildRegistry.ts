import { execFileSync } from 'node:child_process'
import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { basename, dirname, extname, join, relative, sep } from 'node:path'
import postcss from 'postcss'
import type { Registry, RegistryItem } from 'shadcn/schema'
import { z } from 'zod'
import {
    HOST_PACKAGES,
    importedSpecifiers,
    isRelative,
    packageName,
} from './manifest.ts'

const REPO_ROOT = join(import.meta.dirname, '..', '..')
const SOURCE_ROOT = join(REPO_ROOT, 'packages', 'registry')
const COMPONENTS_DIR = join(SOURCE_ROOT, 'components')
const BLOCKS_DIR = join(SOURCE_ROOT, 'blocks')
const REGISTRY_PATH = join(REPO_ROOT, 'registry.json')

const ADDRESS_PREFIX = 'devotta-labs/dhis2-blocks/'
const THEME_ITEM = 'dhis2-theme'
// Source imports what an installed project imports, so the CLI's alias
// rewrite resolves every specifier directly.
const COMPONENT_IMPORT = '@/components/dhis2/ui/'
const COMPONENT_TARGET = '@components/dhis2/ui/'
const BLOCK_IMPORT = '@/components/'
const BLOCK_TARGET = '@components/'

const SOURCE_FILE = /\.(?:tsx?|css)$/
const TEST_FILE = /\.test\.tsx?$/
const NOT_SHIPPED_DIRECTORIES = new Set(['__tests__', 'type-tests'])
const RESOLVE_SUFFIXES = ['', '.ts', '.tsx', '/index.ts', '/index.tsx']

const blockMetadataSchema = z.strictObject({
    title: z.string(),
    description: z.string(),
    docs: z.string().optional(),
})

type SourceItem = {
    name: string
    kind: 'component' | 'block'
    metadata?: z.infer<typeof blockMetadataSchema>
    files: { source: string; target: string }[]
}

const toPosix = (path: string): string => path.split(sep).join('/')

/**
 * The tokens declared in theme.css's `@theme` block, as `[name, value]` pairs:
 * the name without its leading `--`, the value on one line.
 */
const parseThemeTokens = (css: string): [string, string][] => {
    const tokens: [string, string][] = []
    postcss.parse(css).walkAtRules('theme', (rule) => {
        rule.walkDecls(/^--/, ({ prop, value }) => {
            tokens.push([prop.slice(2), value.replace(/\s+/g, ' ').trim()])
        })
    })
    return tokens
}

const listSourceFiles = (directory: string): string[] =>
    readdirSync(directory, { withFileTypes: true })
        .flatMap((entry) => {
            const path = join(directory, entry.name)
            if (entry.isDirectory()) {
                return NOT_SHIPPED_DIRECTORIES.has(entry.name)
                    ? []
                    : listSourceFiles(path)
            }
            return SOURCE_FILE.test(entry.name) && !TEST_FILE.test(entry.name)
                ? [path]
                : []
        })
        .sort()

const componentItems = (): SourceItem[] =>
    listSourceFiles(COMPONENTS_DIR)
        .filter((source) => extname(source) !== '.css')
        .map((source) => ({
            name: basename(source, extname(source)),
            kind: 'component',
            files: [
                {
                    source,
                    target: COMPONENT_TARGET + relative(COMPONENTS_DIR, source),
                },
            ],
        }))

const blockItems = (): SourceItem[] =>
    readdirSync(BLOCKS_DIR, { withFileTypes: true })
        .filter((entry) => entry.isDirectory())
        .map((entry) => entry.name)
        .sort()
        .map((name) => {
            const directory = join(BLOCKS_DIR, name)
            const metadata = blockMetadataSchema.parse(
                JSON.parse(readFileSync(join(directory, 'block.json'), 'utf8'))
            )
            return {
                name,
                kind: 'block',
                metadata,
                files: listSourceFiles(directory).map((source) => ({
                    source,
                    target: `${BLOCK_TARGET}${name}/${toPosix(relative(directory, source))}`,
                })),
            }
        })

const resolveRelative = (from: string, specifier: string): string | undefined =>
    RESOLVE_SUFFIXES.map((suffix) =>
        join(dirname(from), specifier + suffix)
    ).find((path) => existsSync(path) && SOURCE_FILE.test(path))

const itemDependencies = (
    item: SourceItem,
    owners: Map<string, SourceItem>,
    names: Set<string>,
    versions: Record<string, string>,
    devVersions: Record<string, string>
): Pick<
    RegistryItem,
    'dependencies' | 'devDependencies' | 'registryDependencies'
> => {
    const external = new Set<string>()
    // Every item styles itself with the DHIS2 tokens.
    const internal = new Set<string>([THEME_ITEM])
    for (const { source } of item.files) {
        if (extname(source) === '.css') continue
        const file = toPosix(relative(REPO_ROOT, source))
        for (const specifier of importedSpecifiers(
            readFileSync(source, 'utf8')
        )) {
            if (isRelative(specifier)) {
                const resolved = resolveRelative(source, specifier)
                const owner = resolved && owners.get(resolved)
                if (!owner) {
                    throw new Error(
                        `${file} imports ${specifier}, which is not an installed file`
                    )
                }
                if (owner === item) continue
                // Components install side by side, so a sibling path holds;
                // anywhere else the relative path breaks once installed.
                if (item.kind !== 'component' || owner.kind !== 'component') {
                    throw new Error(
                        `${file} imports ${specifier} from ${owner.name}; import it as ${COMPONENT_IMPORT}${owner.name} or ${BLOCK_IMPORT}${owner.name}`
                    )
                }
                internal.add(owner.name)
            } else if (specifier.startsWith(COMPONENT_IMPORT)) {
                const name = specifier.slice(COMPONENT_IMPORT.length)
                if (!names.has(name)) {
                    throw new Error(`${file} imports unknown item ${specifier}`)
                }
                internal.add(name)
            } else if (specifier.startsWith(BLOCK_IMPORT)) {
                const name = specifier.slice(BLOCK_IMPORT.length).split('/')[0]
                if (!names.has(name)) {
                    throw new Error(`${file} imports unknown item ${specifier}`)
                }
                internal.add(name)
            } else if (specifier.startsWith('@/')) {
                throw new Error(
                    `${file} imports ${specifier}; only ${COMPONENT_IMPORT}* and ${BLOCK_IMPORT}<block> resolve once installed`
                )
            } else if (!HOST_PACKAGES.has(packageName(specifier))) {
                external.add(packageName(specifier))
            }
        }
    }
    if (external.has('@dhis2/ui-icons')) {
        // ui-icons imports prop-types without declaring it in its package metadata.
        external.add('prop-types')
    }
    const dependencies = [...external].sort().map((dependency) => {
        const version = versions[dependency]
        if (!version) {
            throw new Error(
                `${item.name} imports ${dependency}, which is not in packages/registry/package.json dependencies`
            )
        }
        return `${dependency}@${version}`
    })
    // A dependency that ships no types installs with its DefinitelyTyped package.
    const devDependencies = [...external].sort().flatMap((dependency) => {
        const types = `@types/${dependency.replace(/^@(.+)\//, '$1__')}`
        const version = devVersions[types]
        return version ? [`${types}@${version}`] : []
    })
    return {
        ...(dependencies.length > 0 && {
            dependencies,
        }),
        ...(devDependencies.length > 0 && {
            devDependencies,
        }),
        ...(internal.size > 0 && {
            registryDependencies: [...internal]
                .map((name) => ADDRESS_PREFIX + name)
                .sort(),
        }),
    }
}

const buildRegistry = (): Registry => {
    const sources = [...componentItems(), ...blockItems()]
    const names = new Set([THEME_ITEM, ...sources.map((item) => item.name)])
    if (names.size !== sources.length + 1) {
        throw new Error('registry item names must be unique')
    }
    const owners = new Map(
        sources.flatMap((item) =>
            item.files.map((file) => [file.source, item] as const)
        )
    )
    const { dependencies: versions, devDependencies: devVersions } = JSON.parse(
        readFileSync(join(SOURCE_ROOT, 'package.json'), 'utf8')
    )
    const tokens = parseThemeTokens(
        readFileSync(join(COMPONENTS_DIR, 'theme.css'), 'utf8')
    )
    return {
        $schema: 'https://ui.shadcn.com/schema/registry.json',
        name: 'dhis2-blocks',
        homepage: 'https://github.com/devotta-labs/dhis2-blocks',
        items: [
            {
                name: THEME_ITEM,
                type: 'registry:theme',
                cssVars: { theme: Object.fromEntries(tokens) },
            },
            ...sources.map((item): RegistryItem => {
                const fileType =
                    item.kind === 'component' ? 'registry:ui' : 'registry:file'
                return {
                    name: item.name,
                    type:
                        item.kind === 'component'
                            ? 'registry:ui'
                            : 'registry:block',
                    ...(item.metadata && {
                        title: item.metadata.title,
                        description: item.metadata.description,
                    }),
                    ...itemDependencies(
                        item,
                        owners,
                        names,
                        versions,
                        devVersions
                    ),
                    files: item.files.map(({ source, target }) => ({
                        path: toPosix(relative(REPO_ROOT, source)),
                        type: fileType,
                        target,
                    })),
                    ...(item.metadata?.docs !== undefined && {
                        docs: item.metadata.docs,
                    }),
                }
            }),
        ],
    }
}

const format = (json: string): string =>
    execFileSync(
        join(REPO_ROOT, 'node_modules', '.bin', 'oxfmt'),
        ['--stdin-filepath=registry.json'],
        { cwd: REPO_ROOT, input: json, encoding: 'utf8' }
    )

const main = (): void => {
    const generated = format(JSON.stringify(buildRegistry(), null, 4))
    if (!process.argv.includes('--check')) {
        writeFileSync(REGISTRY_PATH, generated)
        return
    }
    if (readFileSync(REGISTRY_PATH, 'utf8') !== generated) {
        console.error(
            'registry.json is out of date with packages/registry/; run `pnpm registry:write`'
        )
        process.exitCode = 1
    }
}

main()
