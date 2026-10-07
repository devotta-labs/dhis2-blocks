import { defineRule } from '@oxlint/plugins'
import type { ESTree, Scope, Variable } from '@oxlint/plugins'

const isClassName = (name: string) =>
    /(?:^class$|classes$|className(?:s)?$)/i.test(name)

const propertyName = (node: ESTree.Node) => {
    if (node.type === 'Identifier' || node.type === 'JSXIdentifier')
        return node.name

    // oxlint-disable-next-line anti-slop/no-runtime-typeof -- ESTree uses one node kind for all primitive literals.
    if (node.type === 'Literal' && typeof node.value === 'string')
        return node.value

    return undefined
}

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

/** Classes must resolve cascade conflicts without exclamation marks. No safe autofix exists. */
export const noTailwindImportantRule = defineRule({
    meta: {
        type: 'problem',
        docs: {
            description:
                'Disallow exclamation marks in class strings; fix the cascade or component composition instead.',
        },
        schema: [],
        messages: {
            important:
                'Class "{{token}}" contains "!". Fix the CSS cascade or component composition instead of forcing an override.',
        },
    },
    create(context) {
        const visited = new Set<ESTree.Node>()

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

        const isClassHelper = (node: ESTree.IdentifierReference) => {
            if (classHelpers.has(node.name)) return true

            return (
                binding(node)?.defs.some((definition) => {
                    const declaration = definition.parent

                    return (
                        definition.type === 'ImportBinding' &&
                        declaration?.type === 'ImportDeclaration' &&
                        [
                            'clsx',
                            'classnames',
                            'tailwind-merge',
                            'class-variance-authority',
                        ].includes(String(declaration.source.value))
                    )
                }) ?? false
            )
        }

        const report = (node: ESTree.Node, value: string) => {
            for (const className of value.split(/\s+/)) {
                if (className.includes('!')) {
                    context.report({
                        node,
                        messageId: 'important',
                        data: { token: className },
                    })
                }
            }
        }

        const inspect = (node: ESTree.Node | null | undefined) => {
            if (!node || visited.has(node)) return

            visited.add(node)

            switch (node.type) {
                case 'Literal':
                    // oxlint-disable-next-line anti-slop/no-runtime-typeof -- Validate the literal supplied by the parser before reading class tokens.
                    if (typeof node.value === 'string') report(node, node.value)

                    break
                case 'TemplateLiteral':
                    for (const quasi of node.quasis)
                        report(quasi, quasi.value.cooked ?? quasi.value.raw)

                    for (const expression of node.expressions)
                        inspect(expression)

                    break
                case 'Identifier': {
                    const variable = binding(node)

                    for (const definition of variable?.defs ?? []) {
                        if (definition.node.type === 'VariableDeclarator')
                            inspect(definition.node.init)
                        else if (definition.node.type === 'FunctionDeclaration')
                            inspect(definition.node.body)
                    }

                    for (const reference of variable?.references ?? [])
                        inspect(reference.writeExpr)

                    break
                }

                case 'JSXExpressionContainer':
                    if (node.expression.type !== 'JSXEmptyExpression')
                        inspect(node.expression)

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
                case 'ArrayExpression':
                    for (const element of node.elements) inspect(element)

                    break
                case 'SpreadElement':
                    inspect(node.argument)

                    break
                case 'ObjectExpression':
                    for (const property of node.properties) {
                        if (property.type === 'SpreadElement')
                            inspect(property.argument)
                        else {
                            inspect(property.key)
                            inspect(property.value)
                        }
                    }

                    break
                case 'MemberExpression':
                    inspect(node.object)

                    break
                case 'CallExpression':
                    if (node.callee.type === 'MemberExpression')
                        inspect(node.callee.object)
                    else if (node.callee.type === 'Identifier')
                        inspect(node.callee)

                    for (const argument of node.arguments) {
                        if (
                            argument.type === 'ObjectExpression' &&
                            node.callee.type === 'Identifier' &&
                            isClassHelper(node.callee) &&
                            node.callee.name !== 'cva'
                        ) {
                            // Dictionary values enable classes; their text is not a class token.
                            for (const property of argument.properties) {
                                if (property.type === 'SpreadElement')
                                    inspect(property.argument)
                                else inspect(property.key)
                            }
                        } else inspect(argument)
                    }

                    break
                case 'ArrowFunctionExpression':
                case 'FunctionExpression':
                    inspect(node.body)

                    break
                case 'BlockStatement':
                    for (const statement of node.body) inspect(statement)

                    break
                case 'ReturnStatement':
                    inspect(node.argument)

                    break
                case 'IfStatement':
                    inspect(node.consequent)
                    inspect(node.alternate)

                    break
                case 'SwitchStatement':
                    for (const switchCase of node.cases)
                        for (const statement of switchCase.consequent)
                            inspect(statement)

                    break
                case 'TSAsExpression':
                case 'TSSatisfiesExpression':
                case 'TSNonNullExpression':
                    inspect(node.expression)

                    break
            }
        }

        return {
            JSXAttribute(node) {
                if (
                    node.name.type === 'JSXIdentifier' &&
                    isClassName(node.name.name)
                )
                    inspect(node.value)
            },
            Property(node) {
                const name = propertyName(node.key)

                if (name && isClassName(name)) inspect(node.value)
            },
            VariableDeclarator(node) {
                if (node.id.type === 'Identifier' && isClassName(node.id.name))
                    inspect(node.init)
            },
            AssignmentExpression(node) {
                const name =
                    node.left.type === 'MemberExpression'
                        ? propertyName(node.left.property)
                        : propertyName(node.left)

                if (name && isClassName(name)) inspect(node.right)
            },
            CallExpression(node) {
                if (
                    node.callee.type === 'Identifier' &&
                    isClassHelper(node.callee)
                ) {
                    inspect(node)
                }

                if (node.callee.type !== 'MemberExpression') return

                const method = propertyName(node.callee.property)

                if (
                    method === 'setAttribute' &&
                    node.arguments[0]?.type === 'Literal' &&
                    node.arguments[0].value === 'class'
                ) {
                    inspect(node.arguments[1])
                }

                const owner = node.callee.object

                if (
                    owner.type === 'MemberExpression' &&
                    propertyName(owner.property) === 'classList' &&
                    ['add', 'toggle', 'replace', 'remove'].includes(
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
        }
    },
})
