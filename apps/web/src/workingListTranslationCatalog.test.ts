import { readdirSync, readFileSync } from 'node:fs'
import { join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'
import ts from 'typescript'

const catalogPath = fileURLToPath(
    new URL('./workingListTranslationCatalog.ts', import.meta.url)
)
const blockSourceRoot = fileURLToPath(
    new URL('../../../packages/blocks/working-list/src', import.meta.url)
)

const isTestSource = (path: string) =>
    /\.(test|spec)\.tsx?$/.test(path) || path.includes('__tests__')

const listSources = (directory: string): string[] =>
    readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
        const path = join(directory, entry.name)
        if (entry.isDirectory()) {
            return listSources(path)
        }
        return /\.tsx?$/.test(entry.name) && !isTestSource(path) ? [path] : []
    })

/** Calls whose first argument is a message the block translates at runtime. */
const isTranslationCall = (node: ts.CallExpression | ts.NewExpression) => {
    const callee = node.expression
    if (ts.isNewExpression(node)) {
        return ts.isIdentifier(callee) && callee.text === 'ValueParseError'
    }
    if (ts.isIdentifier(callee)) {
        return callee.text === 'translate' || callee.text === 't'
    }
    return (
        ts.isPropertyAccessExpression(callee) &&
        ts.isIdentifier(callee.expression) &&
        callee.expression.text === 'i18n' &&
        callee.name.text === 't'
    )
}

const collectMessages = (path: string) => {
    const source = ts.createSourceFile(
        path,
        readFileSync(path, 'utf8'),
        ts.ScriptTarget.Latest,
        true
    )
    const messages: string[] = []
    const visit = (node: ts.Node) => {
        if (
            (ts.isCallExpression(node) || ts.isNewExpression(node)) &&
            isTranslationCall(node)
        ) {
            const [message] = node.arguments ?? []
            if (message && ts.isStringLiteralLike(message)) {
                messages.push(message.text)
            }
        }
        ts.forEachChild(node, visit)
    }
    visit(source)
    return messages
}

describe('workingListTranslationCatalog', () => {
    it('lists every literal message the working-list block translates', () => {
        const catalog = new Set(collectMessages(catalogPath))
        const missing = listSources(blockSourceRoot).flatMap((path) =>
            collectMessages(path)
                .filter((message) => !catalog.has(message))
                .map(
                    (message) =>
                        `${relative(blockSourceRoot, path)}: ${message}`
                )
        )

        expect(missing).toEqual([])
    })
})
