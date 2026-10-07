import { defineRule } from '@oxlint/plugins'
import type { ESTree, Scope } from '@oxlint/plugins'

const isClassName = (name: string) =>
    /(?:^class$|classes$|className(?:s)?$)/i.test(name)

const classHelpers = new Set([
    'cn',
    'cx',
    'clsx',
    'classnames',
    'classNames',
    'twMerge',
    'twJoin',
    'cva',
])

const propertyName = (node: ESTree.Node) => {
    if (node.type === 'Identifier' || node.type === 'JSXIdentifier')
        return node.name

    if (node.type === 'Literal') return String(node.value)

    return undefined
}

/** Keep class composition at its use site, while allowing host props and imported CSS modules. */
export const inlineClassnamesRule = defineRule({
    meta: {
        type: 'suggestion',
        docs: {
            description:
                'Require class strings and their composition to be inline instead of stored in local variables.',
        },
        schema: [],
        messages: {
            extracted:
                'Inline the classes stored in "{{name}}" at their use site. Do not extract class strings or class composition into variables or functions.',
        },
    },
    create(context) {
        const reported = new Set<ESTree.Node>()

        const report = (node: ESTree.Node, name: string) => {
            if (reported.has(node)) return

            reported.add(node)
            context.report({ node, messageId: 'extracted', data: { name } })
        }

        const isForwardedHostClass = (
            node: ESTree.Node | null | undefined
        ): boolean => {
            if (
                node?.type !== 'MemberExpression' ||
                !isClassName(propertyName(node.property) ?? '') ||
                node.object.type !== 'Identifier'
            )
                return false

            let scope: Scope | null = context.sourceCode.getScope(node.object)

            while (scope) {
                const variable = scope.set.get(node.object.name)

                // A host prop arrives through a parameter; a locally defined
                // object makes the member access extracted composition.
                if (variable)
                    return !variable.defs.some(
                        (definition) =>
                            definition.type === 'Variable' ||
                            definition.type === 'FunctionName'
                    )

                scope = scope.upper
            }

            return true
        }

        const inspectIdentifier = (node: ESTree.Node) => {
            if (node.type !== 'Identifier') return

            let scope: Scope | null = context.sourceCode.getScope(node)

            while (scope) {
                const variable = scope.set.get(node.name)

                if (variable) {
                    for (const definition of variable.defs) {
                        if (
                            definition.type === 'Variable' ||
                            definition.type === 'FunctionName'
                        ) {
                            if (
                                definition.node.type === 'VariableDeclarator' &&
                                isForwardedHostClass(definition.node.init)
                            )
                                continue

                            report(definition.name, node.name)
                        }
                    }

                    break
                }

                scope = scope.upper
            }
        }

        const inspect = (node: ESTree.Node | null | undefined) => {
            if (!node) return

            switch (node.type) {
                case 'Identifier':
                    inspectIdentifier(node)

                    break
                case 'TemplateLiteral':
                    for (const expression of node.expressions)
                        inspect(expression)

                    break
                case 'ConditionalExpression':
                    inspect(node.consequent)
                    inspect(node.alternate)

                    break
                case 'LogicalExpression':
                    if (node.operator !== '&&') inspect(node.left)

                    inspect(node.right)

                    break
                case 'BinaryExpression':
                    if (node.operator === '+') {
                        inspect(node.left)
                        inspect(node.right)
                    }

                    break
                case 'MemberExpression':
                    inspect(node.object)

                    break
                case 'CallExpression': {
                    const isCva =
                        node.callee.type === 'Identifier' &&
                        node.callee.name === 'cva'

                    if (
                        node.callee.type === 'Identifier' &&
                        !classHelpers.has(node.callee.name)
                    )
                        inspectIdentifier(node.callee)
                    else if (node.callee.type === 'MemberExpression')
                        inspect(node.callee.object)

                    for (const argument of node.arguments) {
                        if (argument.type !== 'ObjectExpression')
                            inspect(argument)
                        else if (isCva)
                            // cva variant maps hold class strings, not conditions.
                            inspectVariantDictionary(argument)
                        else {
                            // Class-helper dictionary values are conditions, not class strings.
                            for (const property of argument.properties) {
                                if (property.type === 'SpreadElement')
                                    inspect(property.argument)
                                else if (property.computed)
                                    inspect(property.key)
                            }
                        }
                    }

                    break
                }

                case 'ArrayExpression':
                    for (const element of node.elements) inspect(element)

                    break
                case 'SpreadElement':
                    inspect(node.argument)

                    break
                case 'TSAsExpression':
                case 'TSSatisfiesExpression':
                case 'TSNonNullExpression':
                    inspect(node.expression)

                    break
            }
        }

        const inspectVariantValue = (node: ESTree.Node) => {
            if (node.type === 'ObjectExpression') {
                inspectVariantDictionary(node)
            } else if (node.type === 'ArrayExpression') {
                for (const element of node.elements) {
                    if (element) inspectVariantValue(element)
                }
            } else {
                inspect(node)
            }
        }

        const inspectVariantDictionary = (
            node: ESTree.ObjectExpression
        ): void => {
            for (const property of node.properties) {
                if (property.type === 'SpreadElement')
                    inspect(property.argument)
                else {
                    if (property.computed) inspect(property.key)

                    inspectVariantValue(property.value)
                }
            }
        }

        return {
            VariableDeclarator(node) {
                if (
                    node.id.type === 'Identifier' &&
                    isClassName(node.id.name) &&
                    node.init &&
                    node.init.type !== 'ArrowFunctionExpression' &&
                    node.init.type !== 'FunctionExpression' &&
                    !isForwardedHostClass(node.init)
                )
                    report(node.id, node.id.name)
            },
            JSXAttribute(node) {
                if (
                    node.name.type !== 'JSXIdentifier' ||
                    !isClassName(node.name.name)
                )
                    return

                if (
                    node.value?.type === 'JSXExpressionContainer' &&
                    node.value.expression.type !== 'JSXEmptyExpression'
                )
                    inspect(node.value.expression)
            },
            Property(node) {
                const name = propertyName(node.key)

                if (name && isClassName(name)) inspect(node.value)
            },
            CallExpression(node) {
                if (
                    node.callee.type === 'Identifier' &&
                    classHelpers.has(node.callee.name)
                ) {
                    inspect(node)
                }

                if (node.callee.type !== 'MemberExpression') return

                const method = propertyName(node.callee.property)

                if (
                    method === 'setAttribute' &&
                    node.arguments[0]?.type === 'Literal' &&
                    node.arguments[0].value === 'class'
                )
                    inspect(node.arguments[1])

                const owner = node.callee.object

                if (
                    owner.type === 'MemberExpression' &&
                    propertyName(owner.property) === 'classList' &&
                    ['add', 'remove', 'toggle', 'replace'].includes(
                        method ?? ''
                    )
                ) {
                    const argumentsToInspect =
                        method === 'toggle'
                            ? node.arguments.slice(0, 1)
                            : node.arguments

                    for (const argument of argumentsToInspect) inspect(argument)
                }
            },
            AssignmentExpression(node) {
                if (
                    node.left.type === 'MemberExpression' &&
                    isClassName(propertyName(node.left.property) ?? '')
                )
                    inspect(node.right)
            },
        }
    },
})
