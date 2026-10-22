import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { buildUiRegistry, parseThemeTokens } from './buildUiRegistry.ts'

const UI_DIR = join(import.meta.dirname, '..')

const readJson = (path: string) => JSON.parse(readFileSync(path, 'utf8'))
const manifest = () => readJson(join(UI_DIR, 'registry.json'))
const item = (name: string) =>
    manifest().items.find(
        (candidate: { name: string }) => candidate.name === name
    )
const readThemeTokens = () =>
    parseThemeTokens(readFileSync(join(UI_DIR, 'src', 'theme.css'), 'utf8'))

test('committed registry.json equals the generated manifest', () => {
    expect(manifest()).toEqual(buildUiRegistry(UI_DIR))
})

test('combobox depends on its siblings and the theme', () => {
    const combobox = item('combobox')
    expect(combobox.registryDependencies).toEqual([
        'devotta-labs/dhis2-blocks/checkbox',
        'devotta-labs/dhis2-blocks/cn',
        'devotta-labs/dhis2-blocks/dhis2-theme',
        'devotta-labs/dhis2-blocks/input-group',
        'devotta-labs/dhis2-blocks/select',
    ])
    expect(combobox.dependencies).toEqual([
        '@base-ui/react@^1.9.0',
        '@dhis2/ui-icons@^10.17.0',
        'prop-types@^15.8.1',
    ])
})

test('theme item carries every theme.css token', () => {
    expect(item('dhis2-theme').cssVars.theme['color-dhis2-primary']).toBe(
        '#1565c0'
    )
    expect(Object.keys(item('dhis2-theme').cssVars.theme)).toHaveLength(
        readThemeTokens().length
    )
})

test('theme tokens keep their values, multi-line ones on a single line', () => {
    const { theme } = item('dhis2-theme').cssVars
    expect(theme['color-dhis2-overlay']).toBe('rgb(33 43 54 / 0.4)')
    expect(theme['shadow-dhis2-popover']).toBe(
        '0 4px 12px rgba(12, 14, 16, 0.15), 0 0 0 1px rgba(12, 14, 16, 0.05)'
    )
    expect(theme['dhis2-field-height-dense']).toBe('32px')
})

test('every source file is an item and tests are not', () => {
    const names = manifest().items.map(
        (candidate: { name: string }) => candidate.name
    )
    expect(names).toContain('button')
    expect(names).toContain('portal-root')
    expect(names).toHaveLength(26)
    expect(names).not.toContain('cn.test')
    expect(names).not.toContain('theme.test')
})

test('subpath imports collapse to their package and react is left to the host', () => {
    const dialog = item('dialog')
    expect(dialog.dependencies).toEqual([
        '@base-ui/react@^1.9.0',
        '@dhis2/ui-icons@^10.17.0',
        'class-variance-authority@^0.7.1',
        'prop-types@^15.8.1',
    ])
    for (const { dependencies = [] } of manifest().items) {
        for (const dependency of dependencies) {
            expect(dependency).not.toMatch(/^react(-dom)?@/)
            expect(dependency).toMatch(/^(?:@[^/@]+\/)?[^/@]+@/)
        }
    }
})

test('only icon consumers install the undeclared ui-icons runtime dependency', () => {
    const { items } = buildUiRegistry(UI_DIR)
    for (const { dependencies = [] } of items) {
        expect(dependencies.includes('prop-types@^15.8.1')).toBe(
            dependencies.some((dependency: string) =>
                dependency.startsWith('@dhis2/ui-icons@')
            )
        )
    }
})

test('theme parsing handles inline blocks, comments and semicolons inside values', () => {
    expect(
        parseThemeTokens(`
        :root { --outside: red; }
        /* @theme { --comment: red; } */
        @theme inline { --color-dhis2-primary: #1565c0; --font-dhis2: "a;b", sans-serif; }
        @theme {
            --shadow-dhis2-card: 0 1px 2px black,
                0 2px 4px grey;
        }
    `)
    ).toEqual([
        ['color-dhis2-primary', '#1565c0'],
        ['font-dhis2', '"a;b", sans-serif'],
        ['shadow-dhis2-card', '0 1px 2px black, 0 2px 4px grey'],
    ])
})

test('items install to the dhis2 ui folder and depend on the theme', () => {
    const [theme, ...primitives] = manifest().items
    expect(theme.files).toBeUndefined()
    for (const primitive of primitives) {
        expect(primitive.type).toBe('registry:ui')
        expect(primitive.files).toHaveLength(1)
        expect(primitive.files[0].target).toMatch(
            /^@components\/dhis2\/ui\/[\w-]+\.tsx?$/
        )
        expect(primitive.registryDependencies).toContain(
            'devotta-labs/dhis2-blocks/dhis2-theme'
        )
    }
})
