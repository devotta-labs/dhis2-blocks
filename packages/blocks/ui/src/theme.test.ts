import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'
import { parseThemeTokens } from '../scripts/buildUiRegistry.ts'

const REPO_ROOT = fileURLToPath(new URL('../../../../', import.meta.url))
const THIS_FILE = fileURLToPath(import.meta.url)
const THEME_CSS = fileURLToPath(new URL('./theme.css', import.meta.url))

const PALETTE = '(?:grey|blue|teal|red|yellow|green)-\\d{3}'
const SEMANTIC =
    '(?:background|foreground|card-foreground|card|popover-foreground|popover|primary-foreground|primary|secondary-foreground|secondary|muted-foreground|muted|accent-foreground|accent|destructive|border|input|ring|overlay)'
const COLOR_PREFIX =
    '(?:bg|text|border(?:-[xytrblse])?|ring-offset|ring|outline|fill|stroke|divide|placeholder|decoration|caret|accent|from|via|to|shadow)'
const RADIUS_SIDE = '(?:-(?:[trblse]|tl|tr|br|bl|ss|se|es|ee))?'

// A Tailwind utility (after any variants) or CSS variable that still points at
// a pre-namespace DHIS2 token. Tailwind drops unknown classes silently, so a
// missed rename would otherwise render unstyled without failing anything.
const LEGACY_TOKEN_UTILITY = new RegExp(
    [
        `(?<![\\w-])(?:${COLOR_PREFIX}-(?:${PALETTE}|${SEMANTIC})|rounded${RADIUS_SIDE}-(?:sm|md|lg)|shadow-(?:popover|card)|font-sans)(?:/[\\w.%\\[\\]-]+)?(?![\\w-])`,
        `--(?:color-(?:${PALETTE}|${SEMANTIC})|radius-(?:sm|md|lg)|shadow-(?:popover|card)|font-sans)(?![\\w-])`,
        '(?<!dhis2-)--field-height-dense',
    ].join('|')
)

const readThemeCss = () => readFileSync(THEME_CSS, 'utf8')

const readThemeTokens = () =>
    parseThemeTokens(readThemeCss()).map(([name]) => name)

const SOURCE_FILE = /\.(?:ts|tsx|css)$/

const sourceFiles = (directory: string): string[] =>
    readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
        const path = join(directory, entry.name)
        if (entry.isDirectory()) {
            return entry.name === 'node_modules' ? [] : sourceFiles(path)
        }
        return SOURCE_FILE.test(entry.name) ? [path] : []
    })

// Roots are repo-relative; a `*` segment matches every directory at that level.
// A match without the rest of the path (a block with no `src/`) is skipped.
const expandRoot = (root: string): string[] =>
    root
        .split('/')
        .reduce<string[]>(
            (directories, segment) =>
                segment === '*'
                    ? directories.flatMap((directory) =>
                          readdirSync(directory, { withFileTypes: true })
                              .filter((entry) => entry.isDirectory())
                              .map((entry) => join(directory, entry.name))
                      )
                    : directories.map((directory) => join(directory, segment)),
            [REPO_ROOT]
        )
        .filter(existsSync)

const scanSources = (roots: string[], pattern: RegExp) =>
    roots
        .flatMap(expandRoot)
        .flatMap(sourceFiles)
        .filter((file) => file !== THIS_FILE)
        .flatMap((file) =>
            readFileSync(file, 'utf8')
                .split('\n')
                .flatMap((line, index) =>
                    [...line.matchAll(new RegExp(pattern.source, 'g'))].map(
                        (match) =>
                            `${relative(REPO_ROOT, file)}:${index + 1}: ${match[0]}`
                    )
                )
        )

test('every theme token is namespaced', () => {
    const tokens = readThemeTokens()
    expect(tokens.length).toBeGreaterThan(80)
    for (const name of tokens)
        expect(name).toMatch(/^(color|radius|shadow|font)-dhis2(-|$)|^dhis2-/)
})

test('theme does not reset the host palette', () => {
    expect(readThemeCss()).not.toMatch(/--color-\*\s*:\s*initial/)
})

test('no block or app source uses an un-namespaced DHIS2 token utility', () => {
    const hits = scanSources(
        ['packages/blocks/*/src', 'apps/web/src'],
        LEGACY_TOKEN_UTILITY
    )
    expect(hits).toEqual([])
})

test('the legacy token pattern flags old token names and nothing else', () => {
    const legacy = [
        'bg-grey-200',
        'hover:bg-grey-500/5',
        'data-[slot=x]:border-ring',
        'focus-visible:outline-ring/35',
        'after:border-b-grey-600',
        'text-popover-foreground',
        'rounded-sm',
        'shadow-popover',
        'font-sans',
        'shadow-[inset_0_0_0_2px_var(--color-ring)]',
        'min-h-(--field-height-dense)',
    ]
    const current = [
        'bg-dhis2-grey-200',
        'hover:bg-dhis2-grey-500/5',
        'focus-visible:outline-dhis2-ring/35',
        'rounded-dhis2-sm',
        'shadow-dhis2-popover',
        'font-dhis2',
        'shadow-[inset_0_0_0_2px_var(--color-dhis2-ring)]',
        'min-h-(--dhis2-field-height-dense)',
        'bg-white',
        'text-sm',
        'shadow-sm',
        'rounded',
        'border',
    ]
    for (const utility of legacy) expect(utility).toMatch(LEGACY_TOKEN_UTILITY)
    for (const utility of current)
        expect(utility).not.toMatch(LEGACY_TOKEN_UTILITY)
})
