import { defineRule } from '@oxlint/plugins'
import type { ESTree, Scope, SourceCode } from '@oxlint/plugins'

const runtime = '@dhis2/d2-i18n'
const translationPackages = new Set([
    runtime,
    '@dhis2/i18n',
    '@dhis2/app-runtime',
    'i18next',
    'react-i18next',
])

function importedRuntime(
    sourceCode: SourceCode,
    node: ESTree.Node & { name: string }
) {
    let scope: Scope | null = sourceCode.getScope(node)
    while (scope !== null) {
        const variable = scope.set.get(node.name)
        if (variable !== undefined) {
            return (
                variable.references.some(
                    (reference) => reference.identifier === node
                ) &&
                variable.defs.some(
                    (definition) =>
                        definition.type === 'ImportBinding' &&
                        definition.parent?.type === 'ImportDeclaration' &&
                        definition.parent.source.value === runtime
                )
            )
        }
        scope = scope.upper
    }
    return false
}

function propertyName(node: ESTree.MemberExpression) {
    if (!node.computed && node.property.type === 'Identifier') {
        return node.property.name
    }
    return node.property.type === 'Literal' ? node.property.value : null
}

function stringLiteral(node: ESTree.Node | undefined) {
    return node?.type === 'Literal' && typeof node.value === 'string'
}

function catalogueExpression(node: ESTree.Node): boolean {
    switch (node.type) {
        case 'TSAsExpression':
        case 'TSSatisfiesExpression':
        case 'ParenthesizedExpression':
            return catalogueExpression(node.expression)
        case 'CallExpression':
            return (
                node.callee.type === 'MemberExpression' &&
                propertyName(node.callee) === 't'
            )
        case 'ArrowFunctionExpression':
        case 'FunctionDeclaration':
        case 'FunctionExpression': {
            if (!node.body) return false
            if (node.body.type !== 'BlockStatement')
                return catalogueExpression(node.body)
            return (
                node.body.body.length === 1 &&
                node.body.body[0].type === 'ReturnStatement' &&
                node.body.body[0].argument !== null &&
                catalogueExpression(node.body.body[0].argument)
            )
        }
        case 'ObjectExpression':
            return (
                node.properties.length > 0 &&
                node.properties.every(
                    (property) =>
                        property.type === 'Property' &&
                        catalogueExpression(property.value)
                )
            )
        case 'ArrayExpression':
            return (
                node.elements.length > 0 &&
                node.elements.every((element) => {
                    if (!element) return false
                    if (
                        element.type === 'ArrayExpression' &&
                        element.elements.length === 2 &&
                        stringLiteral(element.elements[0] ?? undefined)
                    ) {
                        return (
                            element.elements[1] !== null &&
                            catalogueExpression(element.elements[1])
                        )
                    }
                    return catalogueExpression(element)
                })
            )
        case 'NewExpression':
            return (
                node.callee.type === 'Identifier' &&
                ['Map', 'Set'].includes(node.callee.name) &&
                node.arguments.length > 0 &&
                catalogueExpression(node.arguments[0])
            )
        default:
            return false
    }
}

// Descriptor objects with metadata and translated text are not string catalogues.
function storedCatalogue(node: ESTree.Node): boolean {
    let current = node
    while (current.parent) {
        const parent = current.parent
        if (parent.type === 'VariableDeclarator') {
            return (
                parent.init !== null &&
                parent.init.type !== 'CallExpression' &&
                catalogueExpression(parent.init)
            )
        }
        if (
            parent.type === 'FunctionDeclaration' ||
            parent.type === 'FunctionExpression' ||
            parent.type === 'ArrowFunctionExpression'
        ) {
            const container = parent.parent
            const name =
                parent.type === 'FunctionDeclaration'
                    ? parent.id?.name
                    : container?.type === 'VariableDeclarator' &&
                        container.id.type === 'Identifier'
                      ? container.id.name
                      : undefined
            const returned =
                parent.body?.type === 'BlockStatement'
                    ? parent.body.body.length === 1 &&
                      parent.body.body[0].type === 'ReturnStatement'
                        ? parent.body.body[0].argument
                        : null
                    : parent.body
            if (
                catalogueExpression(parent) &&
                ((name && /^use[A-Z]/.test(name)) ||
                    (returned &&
                        returned.type !== 'CallExpression' &&
                        catalogueExpression(returned)))
            )
                return true
            if (
                container?.type !== 'Property' &&
                container?.type !== 'ArrayExpression'
            ) {
                return false
            }
        }
        if (parent.type === 'ExportDefaultDeclaration')
            return catalogueExpression(parent.declaration)
        if (parent.type === 'Program') return true
        current = parent
    }
    return false
}

function moduleScope(node: ESTree.Node): boolean {
    let current = node.parent
    while (current) {
        if (
            current.type === 'FunctionDeclaration' ||
            current.type === 'FunctionExpression' ||
            current.type === 'ArrowFunctionExpression'
        )
            return false
        current = current.parent
    }
    return true
}

export const inlineTranslationsRule = defineRule({
    meta: {
        type: 'problem',
        docs: {
            description:
                'Use inline i18n.t string literals from @dhis2/d2-i18n, without translation wrappers or catalogues.',
        },
        schema: [],
        messages: {
            import: 'Import i18n directly: import i18n from "@dhis2/d2-i18n".',
            direct: 'Call i18n.t(...) directly; do not alias, destructure, export or pass the translator.',
            literal:
                'Use a string literal at the translation call site; interpolate values with {{name}} instead of dynamic messages.',
            options:
                'Keep translation options inline so plural/default messages can be extracted.',
            default:
                'Translation defaultValue and plural defaults must be inline string literals.',
            catalogue:
                'Translate where the text is used, not in a stored string catalogue or translator catalogue.',
        },
    },
    createOnce(context) {
        return {
            ImportDeclaration(node) {
                const source = node.source.value
                if (!translationPackages.has(source)) return
                if (source === '@dhis2/app-runtime') {
                    for (const specifier of node.specifiers) {
                        if (
                            specifier.type === 'ImportSpecifier' &&
                            ['i18n', 't', 'useTranslation'].includes(
                                specifier.imported.type === 'Identifier'
                                    ? specifier.imported.name
                                    : specifier.imported.value
                            )
                        )
                            context.report({
                                node: specifier,
                                messageId: 'import',
                            })
                    }
                    return
                }
                if (
                    source !== runtime ||
                    node.specifiers.length !== 1 ||
                    node.specifiers[0].type !== 'ImportDefaultSpecifier' ||
                    node.specifiers[0].local.name !== 'i18n'
                )
                    context.report({ node, messageId: 'import' })
            },
            ExportNamedDeclaration(node) {
                if (
                    node.source &&
                    translationPackages.has(node.source.value) &&
                    node.source.value !== '@dhis2/app-runtime'
                ) {
                    context.report({ node, messageId: 'direct' })
                }
            },
            ExportAllDeclaration(node) {
                if (
                    translationPackages.has(node.source.value) &&
                    node.source.value !== '@dhis2/app-runtime'
                ) {
                    context.report({ node, messageId: 'direct' })
                }
            },
            ImportExpression(node) {
                if (
                    node.source.type === 'Literal' &&
                    typeof node.source.value === 'string' &&
                    translationPackages.has(node.source.value)
                ) {
                    context.report({ node, messageId: 'import' })
                }
            },
            Identifier(node) {
                if (!importedRuntime(context.sourceCode, node)) return
                const parent = node.parent
                if (
                    parent?.type === 'ImportDefaultSpecifier' ||
                    parent?.type === 'ImportSpecifier'
                )
                    return
                if (
                    parent?.type === 'MemberExpression' &&
                    parent.object === node
                )
                    return
                context.report({ node, messageId: 'direct' })
            },
            MemberExpression(node) {
                if (node.object.type !== 'Identifier') return
                const isRuntime = importedRuntime(
                    context.sourceCode,
                    node.object
                )
                if (
                    isRuntime &&
                    ((node.computed && propertyName(node) !== 'language') ||
                        propertyName(node) === 'getFixedT' ||
                        propertyName(node) === 'default')
                ) {
                    context.report({ node, messageId: 'direct' })
                    return
                }
                const isTranslation = propertyName(node) === 't'
                if (
                    !isTranslation ||
                    (!isRuntime && node.object.name !== 'i18n')
                )
                    return
                if (!isRuntime) {
                    context.report({ node, messageId: 'import' })
                    return
                }
                if (
                    node.computed ||
                    node.optional ||
                    node.parent?.type !== 'CallExpression' ||
                    node.parent.callee !== node ||
                    node.parent.optional
                )
                    context.report({ node, messageId: 'direct' })
            },
            CallExpression(node) {
                const callee = node.callee
                if (
                    callee.type === 'Identifier' &&
                    callee.name === 'require' &&
                    node.arguments[0]?.type === 'Literal' &&
                    typeof node.arguments[0].value === 'string' &&
                    translationPackages.has(node.arguments[0].value)
                )
                    context.report({ node, messageId: 'import' })
                if (
                    callee.type !== 'MemberExpression' ||
                    callee.object.type !== 'Identifier' ||
                    propertyName(callee) !== 't' ||
                    !importedRuntime(context.sourceCode, callee.object)
                )
                    return
                if (!stringLiteral(node.arguments[0])) {
                    context.report({
                        node: node.arguments[0] ?? node,
                        messageId: 'literal',
                    })
                }
                const options = node.arguments[1]
                if (options) {
                    if (options.type !== 'ObjectExpression') {
                        context.report({ node: options, messageId: 'options' })
                    } else {
                        for (const property of options.properties) {
                            if (
                                property.type === 'SpreadElement' ||
                                property.computed
                            ) {
                                context.report({
                                    node: property,
                                    messageId: 'options',
                                })
                                continue
                            }
                            const key =
                                property.key.type === 'Identifier'
                                    ? property.key.name
                                    : property.key.type === 'Literal'
                                      ? property.key.value
                                      : null
                            if (
                                typeof key === 'string' &&
                                /^defaultValue(?:_|$)/.test(key) &&
                                !stringLiteral(property.value)
                            )
                                context.report({
                                    node: property.value,
                                    messageId: 'default',
                                })
                        }
                    }
                }
                if (moduleScope(node) || storedCatalogue(node))
                    context.report({ node, messageId: 'catalogue' })
            },
        }
    },
})
