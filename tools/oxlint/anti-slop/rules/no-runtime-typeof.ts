import { defineRule } from "@oxlint/plugins";

import { resolveArrayBinding, unwrapArrayExpression } from "../shared/array-method.ts";

import type { ESTree, SourceCode, Variable } from "@oxlint/plugins";

type RuntimeFunction = ESTree.ArrowFunctionExpression | ESTree.Function;

function isRuntimeFunction(node: ESTree.Node): node is RuntimeFunction {
	return (
		node.type === "ArrowFunctionExpression" ||
		node.type === "FunctionDeclaration" ||
		node.type === "FunctionExpression"
	);
}

function isInsideTypeGuard(node: ESTree.Node): boolean {
	let current: ESTree.Node | null = node.parent;
	while (current !== null && current.type !== "Program") {
		if (isRuntimeFunction(current)) {
			return current.returnType?.typeAnnotation.type === "TSTypePredicate";
		}
		current = current.parent;
	}
	return false;
}

/** Return whether every definition is ambient, emitting no runtime binding. */
function isAmbientOnlyVariable(variable: Variable): boolean {
	return (
		variable.defs.length > 0 &&
		variable.defs.every(definition => {
			let current: ESTree.Node | null = definition.node;
			while (current !== null) {
				if ("declare" in current && current.declare === true) return true;
				current = current.parent;
			}
			return false;
		})
	);
}

/** Return whether typeof safely probes for the existence of a possibly absent binding. */
function isExistenceProbe(sourceCode: SourceCode, node: ESTree.UnaryExpression): boolean {
	const parent = node.parent;
	if (parent.type !== "BinaryExpression") return false;
	if (!["===", "!==", "==", "!="].includes(parent.operator)) return false;
	const other = parent.left === node ? parent.right : parent.left;
	if (other.type !== "Literal" || other.value !== "undefined") return false;
	const operand = unwrapArrayExpression(node.argument);
	if (operand.type === "Identifier") {
		const variable = resolveArrayBinding(sourceCode, operand);
		// Declared parameters and locals are present; unresolved or ambient-only
		// bindings may still be absent at runtime.
		return variable === null || isAmbientOnlyVariable(variable);
	}
	return operand.type === "MemberExpression";
}

/** Disallow runtime typeof checks that narrow unparsed values instead of decoding them. */
export const noRuntimeTypeofRule = defineRule({
	meta: {
		type: "problem",
		docs: {
			description:
				"Disallow runtime typeof checks; external values must be decoded into meaningful types at their I/O boundary.",
		},
		messages: {
			runtimeTypeof:
				"A `typeof` check narrows a representation without establishing its contract. Parse input at its I/O boundary, then branch on the domain value.",
		},
		schema: [
			{
				type: "object",
				properties: {
					allowInTypeGuards: { type: "boolean" },
				},
				additionalProperties: false,
			},
		],
		defaultOptions: [{ allowInTypeGuards: false }],
	},
	createOnce(context) {
		return {
			UnaryExpression(node) {
				const option = context.options?.[0];
				const allowInTypeGuards =
					typeof option === "object" &&
					option !== null &&
					!Array.isArray(option) &&
					option.allowInTypeGuards === true;
				if (
					node.operator === "typeof" &&
					!isExistenceProbe(context.sourceCode, node) &&
					(!allowInTypeGuards || !isInsideTypeGuard(node))
				) {
					context.report({ node, messageId: "runtimeTypeof" });
				}
			},
		};
	},
});
