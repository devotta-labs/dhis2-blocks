import { readFile } from 'node:fs/promises'
import ts from 'typescript'
import type { Plugin } from 'vite'
import type { CanvasSource, PropReference } from './src/playground/canvasSource'

/** Resolve prop references at build time, never evaluating code in the browser. */
export const inspectCanvas = (
    code: string,
    filename = 'Canvas.tsx'
): Omit<CanvasSource, 'props'> => {
    const options = { noLib: true, noResolve: true, jsx: ts.JsxEmit.Preserve }
    const file = ts.createSourceFile(
        filename,
        code,
        ts.ScriptTarget.Latest,
        true,
        ts.ScriptKind.TSX
    )
    const host = ts.createCompilerHost(options)
    host.getSourceFile = (name) => (name === filename ? file : undefined)
    const checker = ts.createProgram([filename], options, host).getTypeChecker()
    const bindings = new Map<ts.Symbol, string[]>()
    const references: PropReference[] = []

    const bind = (name: ts.BindingName, path: string[]) => {
        if (ts.isIdentifier(name)) {
            const symbol = checker.getSymbolAtLocation(name)
            if (symbol) {
                bindings.set(symbol, path)
                references.push({
                    start: name.getStart(file),
                    end: name.end,
                    path,
                })
            }
        } else if (ts.isObjectBindingPattern(name)) {
            for (const element of name.elements) {
                const key = element.propertyName ?? element.name
                if (
                    !element.dotDotDotToken &&
                    (ts.isIdentifier(key) || ts.isStringLiteral(key))
                ) {
                    bind(element.name, [...path, key.text])
                }
            }
        }
    }

    const pathOf = (node: ts.Node): string[] | undefined => {
        if (ts.isIdentifier(node)) {
            const symbol = ts.isShorthandPropertyAssignment(node.parent)
                ? checker.getShorthandAssignmentValueSymbol(node.parent)
                : checker.getSymbolAtLocation(node)
            return symbol ? bindings.get(symbol) : undefined
        }
        if (ts.isPropertyAccessExpression(node)) {
            const path = pathOf(node.expression)
            return path && [...path, node.name.text]
        }
        if (
            ts.isElementAccessExpression(node) &&
            (ts.isStringLiteral(node.argumentExpression) ||
                ts.isNumericLiteral(node.argumentExpression))
        ) {
            const path = pathOf(node.expression)
            return path && [...path, node.argumentExpression.text]
        }
    }

    const visit = (node: ts.Node) => {
        const path = pathOf(node)
        if (path) {
            references.push({ start: node.getStart(file), end: node.end, path })
            return
        }
        ts.forEachChild(node, visit)
    }

    for (const statement of file.statements) {
        if (
            !ts.isVariableStatement(statement) ||
            !statement.modifiers?.some(
                (modifier) => modifier.kind === ts.SyntaxKind.ExportKeyword
            )
        )
            continue
        for (const declaration of statement.declarationList.declarations) {
            const component = declaration.initializer
            if (!component || !ts.isArrowFunction(component)) continue
            for (const parameter of component.parameters) {
                if (ts.isObjectBindingPattern(parameter.name))
                    bind(parameter.name, [])
            }
            visit(component.body)
        }
    }
    return { code, references }
}

export const canvasSourcePlugin = (): Plugin => ({
    name: 'canvas-source',
    async resolveId(id, importer) {
        if (!id.endsWith('?canvas')) return
        const resolved = await this.resolve(id.slice(0, -7), importer)
        if (resolved) return `${resolved.id}?canvas`
    },
    async load(id) {
        if (!id.endsWith('?canvas')) return
        const filename = id.slice(0, -7)
        this.addWatchFile(filename)
        const source = inspectCanvas(await readFile(filename, 'utf8'), filename)
        return `export default ${JSON.stringify(source)}`
    },
})
