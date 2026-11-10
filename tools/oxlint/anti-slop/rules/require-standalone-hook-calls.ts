import { defineRule } from '@oxlint/plugins'
import type { ESTree } from '@oxlint/plugins'

const HOOK_NAME = /^use[A-Z0-9]/u

function unwrap(node: ESTree.Node): ESTree.Node {
    switch (node.type) {
        case 'ParenthesizedExpression':
        case 'ChainExpression':
        case 'TSAsExpression':
        case 'TSSatisfiesExpression':
        case 'TSTypeAssertion':
        case 'TSNonNullExpression':
        case 'TSInstantiationExpression':
            return unwrap(node.expression)
        default:
            return node
    }
}

function isHook(callee: ESTree.Node): boolean {
    const node = unwrap(callee)
    if (node.type === 'Identifier') return HOOK_NAME.test(node.name)
    if (node.type !== 'MemberExpression') return false
    const namespace = unwrap(node.object)
    if (namespace.type !== 'Identifier' || !/^[A-Z]/u.test(namespace.name)) {
        return false
    }
    if (!node.computed && node.property.type === 'Identifier') {
        return HOOK_NAME.test(node.property.name)
    }
    return node.computed && node.property.type === 'Literal'
        && typeof node.property.value === 'string' && HOOK_NAME.test(node.property.value)
}

function isStandalone(node: ESTree.CallExpression): boolean {
    let expression: ESTree.Node = node
    while (expression.parent !== null && unwrap(expression.parent) === node) {
        expression = expression.parent
    }

    let statement = expression.parent
    if (statement === null) return false
    if (statement.type === 'VariableDeclarator' && statement.init === expression) {
        statement = statement.parent
    } else if (statement.type === 'ArrowFunctionExpression' && statement.body === expression) {
        return true
    } else if (statement.type !== 'ExpressionStatement' && statement.type !== 'ReturnStatement') {
        return false
    }

    const body = statement.parent
    if (body?.type !== 'BlockStatement') return false
    const owner = body.parent
    return (owner?.type === 'FunctionDeclaration'
        || owner?.type === 'FunctionExpression'
        || owner?.type === 'ArrowFunctionExpression') && owner.body === body
}

export const requireStandaloneHookCallsRule = defineRule({
    meta: {
        type: 'suggestion',
        docs: {
            description: 'Require hook calls to be standalone at function-body level, without chaining or embedding them in other expressions.',
        },
        schema: [],
        messages: {
            standalone: 'Call hooks at the top level as a direct initializer, statement, or return. Destructure or store the result before reading properties or using it in another expression.',
        },
    },
    createOnce(context) {
        return {
            CallExpression(node) {
                if (!isHook(node.callee)) return
                const callee = unwrap(node.callee)
                const optional = node.optional || (callee.type === 'MemberExpression' && callee.optional)
                if (optional || !isStandalone(node)) {
                    context.report({ node, messageId: 'standalone' })
                }
            },
        }
    },
})
