import { readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { basename, extname, join } from 'node:path'
import { pathToFileURL } from 'node:url'
import postcss from 'postcss'
import type { Registry, RegistryItem } from 'shadcn/schema'
import {
    HOST_PACKAGES,
    importedSpecifiers,
    isRelative,
    packageName,
} from '../../../../tools/registry/manifest.ts'

const SCHEMA = 'https://ui.shadcn.com/schema/registry.json'
const ADDRESS_PREFIX = 'devotta-labs/dhis2-blocks/'
const TARGET_PREFIX = '@components/dhis2/ui/'
const THEME_ITEM = 'dhis2-theme'
const SOURCE_FILE = /^(?!.*\.test\.tsx?$).*\.tsx?$/

/**
 * The tokens declared in theme.css's `@theme` block, as `[name, value]` pairs:
 * the name without its leading `--`, the value on one line.
 */
export const parseThemeTokens = (css: string): [string, string][] => {
    const tokens: [string, string][] = []
    postcss.parse(css).walkAtRules('theme', (rule) => {
        rule.walkDecls(/^--/, ({ prop, value }) => {
            tokens.push([prop.slice(2), value.replace(/\s+/g, ' ').trim()])
        })
    })
    return tokens
}

const readJson = (path: string) => JSON.parse(readFileSync(path, 'utf8'))

const buildItem = (
    file: string,
    siblings: Set<string>,
    versions: Record<string, string>,
    source: string
): RegistryItem => {
    const name = basename(file, extname(file))
    const external = new Set<string>()
    const registryDependencies = new Set([ADDRESS_PREFIX + THEME_ITEM])
    for (const specifier of importedSpecifiers(source)) {
        if (isRelative(specifier)) {
            const sibling = specifier.startsWith('./')
                ? specifier.slice(2)
                : undefined
            if (sibling === undefined || !siblings.has(sibling)) {
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
    if (external.has('@dhis2/ui-icons')) {
        // ui-icons imports prop-types without declaring it in its package metadata.
        dependencies.push('prop-types@^15.8.1')
        dependencies.sort()
    }
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

export const buildUiRegistry = (
    packageDir: string
): Pick<Registry, '$schema' | 'items'> => {
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
