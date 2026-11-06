import { readFileSync, readdirSync } from 'node:fs'
import ts from 'typescript'
import { describe, expect, it } from 'vitest'
import {
    contentErrors,
    sourceBundleErrors,
} from '../../examples/contentContract'
import { docsNavigation } from '../../navigation'
import registry from '../../../../../registry.json'

const sourceRoot = new URL('../../', import.meta.url)
const read = (path: string) => readFileSync(new URL(path, sourceRoot), 'utf8')
const definition = ts.createSourceFile(
    'registry.ts',
    read('examples/registry.ts'),
    ts.ScriptTarget.Latest,
    true
)
const rawImports = new Map<string, string>()
const examples: {
    slug: string
    entry: string
    sourceFiles: { name: string; code: string }[]
}[] = []
const property = (node: ts.ObjectLiteralExpression, name: string) =>
    node.properties.find(
        (item): item is ts.PropertyAssignment =>
            ts.isPropertyAssignment(item) &&
            item.name.getText(definition) === name
    )?.initializer
const collect = (node: ts.Node) => {
    if (
        ts.isImportDeclaration(node) &&
        ts.isStringLiteral(node.moduleSpecifier) &&
        node.moduleSpecifier.text.endsWith('?raw')
    ) {
        rawImports.set(
            node.importClause!.name!.text,
            read(
                `examples/${node.moduleSpecifier.text.replace('./', '').replace('?raw', '')}`
            )
        )
    }
    if (ts.isObjectLiteralExpression(node)) {
        const slug = property(node, 'slug')
        const sources = property(node, 'sourceFiles')
        if (slug && ts.isStringLiteral(slug)) {
            if (!sources || !ts.isArrayLiteralExpression(sources))
                throw new Error(`${slug.text}: missing sourceFiles`)
            const sourceFiles = sources.elements.map((element) => {
                if (!ts.isObjectLiteralExpression(element))
                    throw new Error('Expected a named source')
                const name = property(element, 'name')
                const code = property(element, 'code')
                if (
                    !name ||
                    !ts.isStringLiteral(name) ||
                    !code ||
                    !ts.isIdentifier(code) ||
                    !rawImports.has(code.text)
                )
                    throw new Error('Expected a named raw source import')
                return { name: name.text, code: rawImports.get(code.text)! }
            })
            const entry = property(node, 'Component')
                ?.getText(definition)
                .match(/import\(['"](\.[^'"]+)['"]\)/)?.[1]
            if (!entry)
                throw new Error(`${slug.text}: missing component import`)
            examples.push({
                slug: slug.text,
                entry: `${entry}.tsx`,
                sourceFiles,
            })
        }
    }
    ts.forEachChild(node, collect)
}
collect(definition)
const pages = readdirSync(new URL('pages', sourceRoot), { recursive: true })
    .filter((path) => String(path).endsWith('.mdx'))
    .map((path) => ({ path: `./pages/${path}`, source: read(`pages/${path}`) }))
const catalog = {
    app: read('App.tsx'),
    pages,
    navigation: docsNavigation
        .flatMap((section) =>
            'links' in section
                ? section.links
                : section.categories.flatMap(({ links }) => links)
        )
        .map(({ href }) => href),
    examples: examples.map(({ slug }) => slug),
    items: registry.items.map(({ name }) => name),
}

describe('curated docs content contracts', () => {
    it('resolves all literal MDX references, page mappings and navigation', () => {
        expect(contentErrors(catalog)).toEqual([])
    })

    it.each([
        ['example', '<ExampleCard slug="not-an-example" />'],
        ['item', '<InstallCommand item="not-an-item" />'],
    ])('rejects an unknown %s', (_, source) => {
        expect(
            contentErrors({
                ...catalog,
                pages: [{ ...pages[0], source }, ...pages.slice(1)],
            })
        ).toContainEqual(expect.stringContaining('unknown'))
    })

    it('rejects absent pages and navigation destinations', () => {
        expect(
            contentErrors({ ...catalog, pages: pages.slice(1) })
        ).toContainEqual(expect.stringContaining('Missing page:'))
        expect(
            contentErrors({ ...catalog, navigation: ['/missing'] })
        ).toContain('Unknown navigation page: /missing')
    })

    it('does not validate code samples or arbitrary prose URLs', () => {
        const source =
            '```tsx\n<ExampleCard slug="illustration" />\n```\n[External](https://example.org)'
        expect(
            contentErrors({
                ...catalog,
                pages: [{ ...pages[0], source }, ...pages.slice(1)],
            })
        ).toEqual([])
    })

    it('keeps compatibility redirects', () => {
        expect(catalog.app).toMatch(
            /path: '\/getting-started',[\s\S]*?<Navigate to="\/installation" replace/
        )
        expect(catalog.app).toMatch(
            /path: '\/blocks\/working-list-calendar',[\s\S]*?to="\/blocks\/working-list#calendar-view"/
        )
    })

    it.each(examples)(
        '$slug has named sources and every relative dependency',
        (example) => {
            expect(sourceBundleErrors(example.sourceFiles)).toEqual([])
            expect(example.sourceFiles[0]).toEqual({
                name: example.entry.split('/').at(-1),
                code: read(`examples/${example.entry}`),
            })
        }
    )

    it('keeps host-only placeholders out of independent copy bundles', () => {
        for (const example of examples.filter(
            ({ slug }) => slug !== 'working-list/program-picker'
        )) {
            expect(
                example.sourceFiles.map(({ name }) => name).join()
            ).not.toMatch(/Placeholder/)
        }
    })

    it('detects a missing local import instead of silently publishing a partial recipe', () => {
        expect(
            sourceBundleErrors([
                { name: 'Main.tsx', code: "import './Missing'" },
            ])
        ).toEqual(['Main.tsx: missing ./Missing'])
    })
})
