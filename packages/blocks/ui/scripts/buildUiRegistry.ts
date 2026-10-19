import { readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { basename, extname, join } from 'node:path'
import { pathToFileURL } from 'node:url'

const SCHEMA = 'https://ui.shadcn.com/schema/registry.json'
const ADDRESS_PREFIX = 'devotta-labs/dhis2-blocks/'
const TARGET_PREFIX = '@components/dhis2/ui/'
const THEME_ITEM = 'dhis2-theme'
const SOURCE_FILE = /^(?!.*\.test\.tsx?$).*\.tsx?$/
// Provided by the consumer app, never installed by an item.
const HOST_PACKAGES = new Set(['react', 'react-dom'])
const IMPORT_SPECIFIER =
    /(?:\b(?:import|export)\s[^'"]*?\bfrom|\bimport)\s*['"]([^'"]+)['"]/g

type RegistryItem = {
    name: string
    type: 'registry:theme' | 'registry:ui'
    dependencies?: string[]
    registryDependencies?: string[]
    files?: { path: string; type: 'registry:ui'; target: string }[]
    cssVars?: { theme: Record<string, string> }
}

export type RegistryManifest = { $schema: string; items: RegistryItem[] }

/**
 * The tokens declared in theme.css's `@theme` block, as `[name, value]` pairs:
 * the name without its leading `--`, the value on one line.
 */
export const parseThemeTokens = (css: string): [string, string][] => {
    const start = css.indexOf('@theme {')
    const block = css
        .slice(start, css.indexOf('\n}', start))
        .replace(/\/\*[\s\S]*?\*\//g, '')
    return [...block.matchAll(/^\s*--([\w*-]+)\s*:([^;]*);/gm)].map((match) => [
        match[1],
        match[2].replace(/\s+/g, ' ').trim(),
    ])
}

// `@base-ui/react/button` installs with `@base-ui/react`.
const packageName = (specifier: string) =>
    specifier
        .split('/')
        .slice(0, specifier.startsWith('@') ? 2 : 1)
        .join('/')

const readJson = (path: string) => JSON.parse(readFileSync(path, 'utf8'))

const buildItem = (
    file: string,
    siblings: Set<string>,
    versions: Record<string, string>,
    source: string
): RegistryItem => {
    const name = basename(file, extname(file))
    const specifiers = [...source.matchAll(IMPORT_SPECIFIER)].map(
        (match) => match[1]
    )
    const external = new Set<string>()
    const registryDependencies = new Set([ADDRESS_PREFIX + THEME_ITEM])
    for (const specifier of specifiers) {
        if (specifier.startsWith('./')) {
            const sibling = specifier.slice(2)
            if (!siblings.has(sibling)) {
                throw new Error(
                    `${file} imports ${specifier}, which is not a registry item`
                )
            }
            registryDependencies.add(ADDRESS_PREFIX + sibling)
        } else if (!HOST_PACKAGES.has(packageName(specifier))) {
            external.add(packageName(specifier))
        }
    }
    const dependencies = [...external].sort().map((dependency) => {
        const version = versions[dependency]
        if (!version) {
            throw new Error(
                `${file} imports ${dependency}, which is not in package.json dependencies`
            )
        }
        return `${dependency}@${version}`
    })
    return {
        name,
        type: 'registry:ui',
        ...(dependencies.length > 0 && { dependencies }),
        registryDependencies: [...registryDependencies].sort(),
        files: [
            {
                path: `src/${file}`,
                type: 'registry:ui',
                target: TARGET_PREFIX + file,
            },
        ],
    }
}

export const buildUiRegistry = (packageDir: string): RegistryManifest => {
    const sourceDir = join(packageDir, 'src')
    const files = readdirSync(sourceDir)
        .filter((file) => SOURCE_FILE.test(file))
        .sort()
    const siblings = new Set(files.map((file) => basename(file, extname(file))))
    const { dependencies: versions } = readJson(
        join(packageDir, 'package.json')
    )
    const tokens = parseThemeTokens(
        readFileSync(join(sourceDir, 'theme.css'), 'utf8')
    )
    return {
        $schema: SCHEMA,
        items: [
            {
                name: THEME_ITEM,
                type: 'registry:theme',
                cssVars: { theme: Object.fromEntries(tokens) },
            },
            ...files.map((file) =>
                buildItem(
                    file,
                    siblings,
                    versions,
                    readFileSync(join(sourceDir, file), 'utf8')
                )
            ),
        ],
    }
}

if (
    process.argv[1] &&
    import.meta.url === pathToFileURL(process.argv[1]).href
) {
    const packageDir = join(import.meta.dirname, '..')
    writeFileSync(
        join(packageDir, 'registry.json'),
        `${JSON.stringify(buildUiRegistry(packageDir), null, 4)}\n`
    )
}
