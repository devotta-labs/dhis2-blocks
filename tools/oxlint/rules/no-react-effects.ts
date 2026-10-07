import { defineRule } from '@oxlint/plugins'
import type { ESTree, Scope, Variable } from '@oxlint/plugins'

const effectHooks = new Set([
    'useEffect',
    'useLayoutEffect',
    'useInsertionEffect',
])

type ReactValue = 'namespace' | 'effect'

/** Effects are opt-in escape hatches, justified at the individual call site. */
export const noReactEffectsRule = defineRule({
    meta: {
        type: 'problem',
        docs: {
            description:
                'Reject React effects unless an adjacent EFFECT comment names the external system and explains the synchronization.',
        },
        schema: [],
        messages: {
            effect: 'Avoid React effects: derive values during render, update state in event handlers, or use useSyncExternalStore for subscriptions. For necessary external synchronization, put `EFFECT: <external-system> -- <why an effect is needed>` immediately above this call.',
            escape: 'Do not export or pass React effect hooks as values. Keep necessary effects at a documented call site so aliases and wrappers cannot hide them.',
        },
    },
    create(context) {
        const binding = (node: ESTree.Node): Variable | undefined => {
            if (node.type !== 'Identifier') return undefined
            let scope: Scope | null = context.sourceCode.getScope(node)

            while (scope) {
                const variable = scope.set.get(node.name)

                if (variable) return variable
                scope = scope.upper
            }

            return undefined
        }

        const unwrap = (node: ESTree.Node): ESTree.Node => {
            while (
                node.type === 'ChainExpression' ||
                node.type === 'TSAsExpression' ||
                node.type === 'TSTypeAssertion' ||
                node.type === 'TSNonNullExpression' ||
                node.type === 'TSSatisfiesExpression'
            )
                node = node.expression

            return node
        }

        const names = (
            input: ESTree.Node,
            computed: boolean,
            seen = new Set<Variable>()
        ): string[] => {
            const node = unwrap(input)

            if (!computed && node.type === 'Identifier') return [node.name]

            if (node.type === 'Literal') return [String(node.value)]

            if (
                node.type === 'TemplateLiteral' &&
                node.expressions.length === 0
            ) {
                const cooked = node.quasis[0]?.value.cooked ?? undefined

                return cooked === undefined ? [] : [cooked]
            }

            if (node.type === 'BinaryExpression' && node.operator === '+') {
                const left = names(node.left, true, new Set(seen))
                const right = names(node.right, true, new Set(seen))

                return left.flatMap((l) => right.map((r) => l + r))
            }

            if (computed && node.type === 'Identifier') {
                const variable = binding(node)

                if (!variable || seen.has(variable)) return []
                seen.add(variable)

                const found: string[] = []

                for (const definition of variable.defs) {
                    if (
                        definition.type === 'Variable' &&
                        definition.node.type === 'VariableDeclarator' &&
                        definition.node.init
                    )
                        found.push(
                            ...names(definition.node.init, true, new Set(seen))
                        )
                }

                // A reassigned key may hold an effect hook even when the
                // initializer does not.
                for (const reference of variable.references) {
                    if (reference.init || !reference.writeExpr) continue

                    found.push(
                        ...names(reference.writeExpr, true, new Set(seen))
                    )
                }

                return found
            }

            return []
        }

        const value = (
            input: ESTree.Node | null | undefined,
            seen = new Set<Variable>()
        ): ReactValue | undefined => {
            if (!input) return undefined
            const node = unwrap(input)

            if (node.type === 'AwaitExpression')
                return value(node.argument, seen)

            if (
                node.type === 'ConditionalExpression' ||
                node.type === 'LogicalExpression'
            ) {
                const possibilities =
                    node.type === 'ConditionalExpression'
                        ? [
                              value(node.consequent, new Set(seen)),
                              value(node.alternate, new Set(seen)),
                          ]
                        : [
                              value(node.left, new Set(seen)),
                              value(node.right, new Set(seen)),
                          ]

                return possibilities.includes('effect')
                    ? 'effect'
                    : possibilities.find((candidate) => candidate !== undefined)
            }

            if (node.type === 'SequenceExpression')
                return value(node.expressions.at(-1), seen)

            if (
                node.type === 'ImportExpression' &&
                node.source.type === 'Literal' &&
                node.source.value === 'react'
            )
                return 'namespace'

            if (
                node.type === 'CallExpression' &&
                node.callee.type === 'Identifier' &&
                node.callee.name === 'require' &&
                !binding(node.callee)?.defs.length &&
                node.arguments[0]?.type === 'Literal' &&
                node.arguments[0].value === 'react'
            )
                return 'namespace'

            if (
                node.type === 'MemberExpression' &&
                value(node.object, new Set(seen)) === 'namespace'
            ) {
                const members = names(node.property, node.computed)

                if (members.some((member) => effectHooks.has(member)))
                    return 'effect'

                if (members.includes('default')) return 'namespace'
            }

            if (
                node.type === 'MemberExpression' &&
                value(node.object, new Set(seen)) === 'effect' &&
                names(node.property, node.computed).some((member) =>
                    ['call', 'apply', 'bind'].includes(member)
                )
            )
                return 'effect'

            if (node.type !== 'Identifier') return undefined
            const variable = binding(node)

            if (!variable || seen.has(variable)) return undefined
            seen.add(variable)

            for (const definition of variable.defs) {
                if (
                    definition.type === 'ImportBinding' &&
                    definition.parent?.type === 'ImportDeclaration' &&
                    definition.parent.source.value === 'react' &&
                    definition.parent.importKind !== 'type'
                ) {
                    const specifier = definition.node

                    if (
                        specifier.type === 'ImportNamespaceSpecifier' ||
                        specifier.type === 'ImportDefaultSpecifier'
                    )
                        return 'namespace'

                    if (
                        specifier.type === 'ImportSpecifier' &&
                        specifier.importKind !== 'type' &&
                        names(specifier.imported, false).includes('default')
                    )
                        return 'namespace'

                    if (
                        specifier.type === 'ImportSpecifier' &&
                        specifier.importKind !== 'type' &&
                        names(specifier.imported, false).some((member) =>
                            effectHooks.has(member)
                        )
                    )
                        return 'effect'
                }

                if (
                    definition.type !== 'Variable' ||
                    definition.node.type !== 'VariableDeclarator'
                )
                    continue
                const declaration = definition.node
                const source = value(declaration.init, new Set(seen))

                if (declaration.id.type === 'Identifier' && source)
                    return source

                if (
                    declaration.id.type !== 'ObjectPattern' ||
                    source !== 'namespace'
                )
                    continue

                for (const property of declaration.id.properties) {
                    if (property.type !== 'Property') continue

                    const target =
                        property.value.type === 'AssignmentPattern'
                            ? property.value.left
                            : property.value

                    if (
                        target.type !== 'Identifier' ||
                        target.name !== node.name
                    )
                        continue
                    const members = names(property.key, property.computed)

                    if (members.some((member) => effectHooks.has(member)))
                        return 'effect'

                    if (members.includes('default')) return 'namespace'
                }
            }

            for (const reference of variable.references) {
                if (reference.init) continue
                const assigned = value(reference.writeExpr, new Set(seen))

                if (assigned) return assigned
            }

            return undefined
        }

        const justified = (node: ESTree.CallExpression) => {
            let owner: ESTree.Node = node

            while (
                owner.parent.type !== 'Program' &&
                owner.type !== 'ExpressionStatement' &&
                owner.type !== 'VariableDeclaration' &&
                owner.type !== 'ReturnStatement' &&
                owner.type !== 'ArrowFunctionExpression' &&
                owner.type !== 'FunctionExpression' &&
                owner.type !== 'FunctionDeclaration' &&
                owner.parent.type !== 'BlockStatement'
            )
                owner = owner.parent

            const directCall =
                owner.type === 'ExpressionStatement'
                    ? unwrap(owner.expression) === node
                    : owner.type === 'ReturnStatement'
                      ? owner.argument !== null &&
                        unwrap(owner.argument) === node
                      : owner.type === 'VariableDeclaration' &&
                        owner.declarations.length === 1 &&
                        owner.declarations[0].init !== null &&
                        unwrap(owner.declarations[0].init) === node

            if (!directCall) return false
            const comment = context.sourceCode.getCommentsBefore(owner).at(-1)

            if (
                !comment ||
                context.sourceCode
                    .getText()
                    .slice(comment.end, owner.start)
                    .trim()
            )
                return false

            if (owner.loc.start.line - comment.loc.end.line > 1) return false

            return /^\s*EFFECT:\s*[a-zA-Z][\w./:-]*\s+--\s+(?!TODO\b|FIXME\b|TBD\b)\S[^\n]*\S\s*$/.test(
                comment.value
            )
        }

        const reportEscape = (node: ESTree.Node) =>
            context.report({ node, messageId: 'escape' })

        return {
            CallExpression(node) {
                if (
                    node.callee.type === 'MemberExpression' &&
                    value(node.callee.object) === 'effect' &&
                    names(node.callee.property, node.callee.computed).includes(
                        'bind'
                    )
                ) {
                    reportEscape(node)

                    return
                }

                if (value(node.callee) === 'effect' && !justified(node))
                    context.report({ node, messageId: 'effect' })

                for (const argument of node.arguments) {
                    if (value(argument) === 'effect') reportEscape(argument)
                }
            },
            ExportAllDeclaration(node) {
                if (node.source.value === 'react' && node.exportKind !== 'type')
                    reportEscape(node)
            },
            ExportNamedDeclaration(node) {
                if (node.exportKind === 'type') return

                for (const specifier of node.specifiers) {
                    if (specifier.exportKind === 'type') continue

                    if (
                        node.source?.value === 'react'
                            ? names(specifier.local, false).some((member) =>
                                  effectHooks.has(member)
                              )
                            : value(specifier.local) === 'effect'
                    )
                        reportEscape(specifier)
                }

                if (node.declaration?.type === 'VariableDeclaration') {
                    for (const declaration of node.declaration.declarations) {
                        if (value(declaration.init) === 'effect')
                            reportEscape(declaration)
                    }
                }
            },
            ExportDefaultDeclaration(node) {
                if (value(node.declaration) === 'effect') reportEscape(node)
            },
            Property(node) {
                if (
                    node.parent.type === 'ObjectExpression' &&
                    value(node.value) === 'effect'
                )
                    reportEscape(node)
            },
            ArrayExpression(node) {
                for (const element of node.elements)
                    if (element && value(element) === 'effect')
                        reportEscape(element)
            },
            ReturnStatement(node) {
                if (value(node.argument) === 'effect') reportEscape(node)
            },
            ArrowFunctionExpression(node) {
                if (node.expression && value(node.body) === 'effect')
                    reportEscape(node.body)
            },
            AssignmentExpression(node) {
                if (
                    node.left.type === 'MemberExpression' &&
                    value(node.right) === 'effect'
                )
                    reportEscape(node)
            },
        }
    },
})
