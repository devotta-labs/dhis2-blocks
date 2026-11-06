import ts from 'typescript'

interface ContentPage {
    path: string
    source: string
}

interface ContentCatalog {
    app: string
    pages: readonly ContentPage[]
    navigation: readonly string[]
    examples: readonly string[]
    items: readonly string[]
}

/** Checks curated routes and literal MDX component references, not prose links or code samples. */
export const contentErrors = (catalog: ContentCatalog): string[] => {
    const errors: string[] = []
    const routes = new Map<string, string>()
    const app = ts.createSourceFile(
        'App.tsx',
        catalog.app,
        ts.ScriptTarget.Latest,
        true,
        ts.ScriptKind.TSX
    )
    const visit = (node: ts.Node) => {
        if (
            ts.isCallExpression(node) &&
            node.expression.getText(app) === 'docRoute'
        ) {
            const [route, page] = node.arguments
            if (
                route &&
                page &&
                ts.isStringLiteral(route) &&
                ts.isStringLiteral(page)
            ) {
                routes.set(route.text, page.text)
            }
        }
        ts.forEachChild(node, visit)
    }
    visit(app)
    for (const href of catalog.navigation) {
        if (!routes.has(href)) errors.push(`Unknown navigation page: ${href}`)
    }
    for (const [route, path] of routes) {
        if (!catalog.pages.some((page) => page.path === path))
            errors.push(`Missing page: ${route} -> ${path}`)
    }
    for (const page of catalog.pages) {
        if (![...routes.values()].includes(page.path))
            errors.push(`Unmapped page: ${page.path}`)
        const prose = page.source.replace(
            /^(`{3,}|~{3,}).*\n[\s\S]*?^\1[^\n]*$/gm,
            ''
        )
        for (const match of prose.matchAll(
            /<(ExampleCard|InstallCommand)\b([^>]*?)\/?\s*>/gs
        )) {
            const [, component, attributes] = match
            const attribute = component === 'ExampleCard' ? 'slug' : 'item'
            const value = attributes.match(
                new RegExp(`\\b${attribute}\\s*=\\s*["']([^"']+)["']`)
            )?.[1]
            const known =
                component === 'ExampleCard' ? catalog.examples : catalog.items
            if (!value || !known.includes(value))
                errors.push(
                    `${page.path}: unknown ${component} ${attribute}: ${value ?? '(nonliteral)'}`
                )
        }
    }
    return errors
}

/** Copyable bundles must close over local imports; partial ?canvas snippets are not bundles. */
export const sourceBundleErrors = (
    files: readonly { name: string; code: string }[]
): string[] => {
    const names = files.map(({ name }) => name)
    const errors: string[] = []
    if (files.length === 0) errors.push('Empty source bundle')
    if (new Set(names).size !== names.length)
        errors.push('Duplicate source filename')
    for (const file of files) {
        for (const imported of ts.preProcessFile(file.code).importedFiles) {
            if (!imported.fileName.startsWith('.')) continue
            const base = new URL(
                imported.fileName,
                `file:///${file.name}`
            ).pathname.slice(1)
            if (
                ![
                    base,
                    `${base}.tsx`,
                    `${base}.ts`,
                    `${base}/index.tsx`,
                    `${base}/index.ts`,
                ].some((name) => names.includes(name))
            ) {
                errors.push(`${file.name}: missing ${imported.fileName}`)
            }
        }
    }
    return errors
}
