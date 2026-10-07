import { defineRule } from '@oxlint/plugins'
import type { ESTree, Scope } from '@oxlint/plugins'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const tailwindEntry = resolve(
    dirname(fileURLToPath(import.meta.url)),
    '../../../apps/web/src/index.css'
)

const stylesheetExtension =
    /\.(?:css|scss|sass|less|styl|stylus|pcss|postcss|sss)$/i

const isStylesheet = (value: string) => {
    let path = value.trim()

    try {
        path = decodeURIComponent(path)
    } catch {
        // A malformed URI still needs the ordinary extension check.
    }

    return (
        stylesheetExtension.test(
            path.split(/[?#]/, 1)[0].split('!').at(-1) ?? ''
        ) || /^data:text\/css[;,]/i.test(path)
    )
}

/** Reject authored stylesheets and stylesheet injection; allow only the checked Tailwind compiler entry. */
export const noStylesheetsRule = defineRule({
    meta: {
        type: 'problem',
        docs: {
            description:
                'Use inline Tailwind classes instead of loading or embedding authored stylesheets.',
        },
        schema: [],
        messages: {
            stylesheet:
                'Use inline Tailwind classes instead of loading or embedding a stylesheet. Only the checked Tailwind compiler entry may be imported for side effects.',
        },
    },
    create(context) {
        const reported = new Set<ESTree.Node>()

        const report = (node: ESTree.Node) => {
            if (reported.has(node)) return

            reported.add(node)
            context.report({ node, messageId: 'stylesheet' })
        }

        const text = (
            node: ESTree.Node | null | undefined,
            seen = new Set<ESTree.Node>()
        ): string | undefined => {
            if (!node || seen.has(node)) return undefined

            seen.add(node)

            const choose = (values: (string | undefined)[]) =>
                values.find(
                    (value) =>
                        value &&
                        (isStylesheet(value) ||
                            ['style', 'stylesheet', 'css'].includes(
                                value.toLowerCase()
                            ))
                ) ?? values.find((value) => value !== undefined)

            if (node.type === 'Literal') {
                // oxlint-disable-next-line anti-slop/no-runtime-typeof -- ESTree uses one node kind for all primitive literals.
                return typeof node.value === 'string' ? node.value : undefined
            }

            if (node.type === 'JSXExpressionContainer')
                return text(node.expression, seen)

            if (node.type === 'ConditionalExpression')
                return choose([
                    text(node.consequent, new Set(seen)),
                    text(node.alternate, new Set(seen)),
                ])

            if (node.type === 'LogicalExpression')
                return choose([
                    text(node.left, new Set(seen)),
                    text(node.right, new Set(seen)),
                ])

            if (
                node.type === 'TSAsExpression' ||
                node.type === 'TSSatisfiesExpression' ||
                node.type === 'TSNonNullExpression'
            )
                return text(node.expression, seen)

            if (node.type === 'TemplateLiteral') {
                return node.quasis
                    .map(
                        (quasi, index) =>
                            (quasi.value.cooked ?? quasi.value.raw) +
                            (index < node.expressions.length
                                ? (text(
                                      node.expressions[index],
                                      new Set(seen)
                                  ) ?? '__dynamic__')
                                : '')
                    )
                    .join('')
            }

            if (node.type === 'BinaryExpression' && node.operator === '+')
                return (
                    (text(node.left, new Set(seen)) ?? '__dynamic__') +
                    (text(node.right, new Set(seen)) ?? '__dynamic__')
                )

            if (node.type === 'Identifier') {
                let scope: Scope | null = context.sourceCode.getScope(node)

                while (scope) {
                    const variable = scope.set.get(node.name)

                    if (variable) {
                        return choose(
                            variable.references.map((reference) =>
                                text(reference.writeExpr, new Set(seen))
                            )
                        )
                    }

                    scope = scope.upper
                }
            }

            return undefined
        }

        const check = (
            node: ESTree.Node,
            source: ESTree.Node | null | undefined
        ) => {
            const value = text(source)

            if (value && isStylesheet(value)) report(node)
        }

        const isGlobal = (
            node: Extract<ESTree.Node, { type: 'Identifier' }>
        ) => {
            let scope: Scope | null = context.sourceCode.getScope(node)

            while (scope) {
                const variable = scope.set.get(node.name)

                if (variable) return variable.defs.length === 0

                scope = scope.upper
            }

            return true
        }

        const isCssAttribute = (attribute: ESTree.ImportAttribute) => {
            const key =
                attribute.key.type === 'Identifier'
                    ? attribute.key.name
                    : attribute.key.value

            return key === 'type' && attribute.value.value === 'css'
        }

        const propertyName = (node: ESTree.Node) =>
            node.type === 'Identifier' ? node.name : text(node)

        const hasCssOptions = (
            node: ESTree.Node | null | undefined
        ): boolean => {
            if (node?.type !== 'ObjectExpression') return false

            return node.properties.some(
                (property) =>
                    property.type === 'Property' &&
                    ((propertyName(property.key) === 'type' &&
                        text(property.value) === 'css') ||
                        (['with', 'assert'].includes(
                            propertyName(property.key) ?? ''
                        ) &&
                            hasCssOptions(property.value)))
            )
        }

        return {
            ImportDeclaration(node) {
                const source = node.source.value

                // This exact file is separately restricted to Tailwind imports/source directives.
                if (
                    node.specifiers.length === 0 &&
                    node.attributes.length === 0 &&
                    source.startsWith('.') &&
                    !/[!?#]/.test(source) &&
                    resolve(dirname(context.filename), source) === tailwindEntry
                )
                    return

                check(node, node.source)

                if (node.attributes.some(isCssAttribute)) report(node)
            },
            ExportNamedDeclaration(node) {
                check(node, node.source)

                if (node.attributes.some(isCssAttribute)) report(node)
            },
            ExportAllDeclaration(node) {
                check(node, node.source)

                if (node.attributes.some(isCssAttribute)) report(node)
            },
            ImportExpression(node) {
                check(node, node.source)

                if (hasCssOptions(node.options)) report(node)
            },
            CallExpression(node) {
                const callee = node.callee

                if (
                    callee.type === 'Identifier' &&
                    callee.name === 'require' &&
                    isGlobal(callee)
                )
                    check(node, node.arguments[0])

                if (callee.type !== 'MemberExpression') return

                const method = callee.computed
                    ? text(callee.property)
                    : callee.property.type === 'Identifier'
                      ? callee.property.name
                      : undefined

                if (
                    callee.object.type === 'Identifier' &&
                    callee.object.name === 'require' &&
                    isGlobal(callee.object) &&
                    method === 'resolve'
                )
                    check(node, node.arguments[0])

                if (
                    method === 'createElement' ||
                    method === 'createElementNS'
                ) {
                    const tag = text(
                        node.arguments[method === 'createElementNS' ? 1 : 0]
                    )

                    if (tag === 'style') report(node)

                    const props = node.arguments[1]

                    if (tag === 'link' && props?.type === 'ObjectExpression') {
                        for (const property of props.properties) {
                            if (property.type !== 'Property') continue

                            if (
                                propertyName(property.key) === 'rel' &&
                                text(property.value)
                                    ?.toLowerCase()
                                    .split(/\s+/)
                                    .includes('stylesheet')
                            )
                                report(node)

                            if (propertyName(property.key) === 'href')
                                check(node, property.value)
                        }
                    }
                }

                if (
                    method === 'setAttribute' &&
                    text(node.arguments[0]) === 'href'
                )
                    check(node, node.arguments[1])

                if (
                    method === 'setAttribute' &&
                    text(node.arguments[0]) === 'rel' &&
                    text(node.arguments[1])
                        ?.toLowerCase()
                        .split(/\s+/)
                        .includes('stylesheet')
                )
                    report(node)
            },
            NewExpression(node) {
                if (
                    node.callee.type === 'Identifier' &&
                    node.callee.name === 'URL' &&
                    isGlobal(node.callee)
                )
                    check(node, node.arguments[0])
            },
            JSXOpeningElement(node) {
                if (node.name.type !== 'JSXIdentifier') return

                if (node.name.name === 'style') report(node)

                if (node.name.name !== 'link') return

                for (const attribute of node.attributes) {
                    if (
                        attribute.type !== 'JSXAttribute' ||
                        attribute.name.type !== 'JSXIdentifier'
                    )
                        continue

                    if (
                        attribute.name.name === 'rel' &&
                        text(attribute.value)
                            ?.toLowerCase()
                            .split(/\s+/)
                            .includes('stylesheet')
                    )
                        report(node)

                    if (attribute.name.name === 'href')
                        check(node, attribute.value)
                }
            },
            AssignmentExpression(node) {
                if (node.left.type !== 'MemberExpression') return

                const property = node.left.computed
                    ? text(node.left.property)
                    : node.left.property.type === 'Identifier'
                      ? node.left.property.name
                      : undefined

                if (property === 'href') check(node, node.right)

                if (
                    property === 'rel' &&
                    text(node.right)
                        ?.toLowerCase()
                        .split(/\s+/)
                        .includes('stylesheet')
                )
                    report(node)
            },
        }
    },
})
