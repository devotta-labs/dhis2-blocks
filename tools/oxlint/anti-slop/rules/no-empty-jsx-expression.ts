import { defineRule } from "@oxlint/plugins";

/** Ban JSX expression containers that hold neither an expression nor a comment. */
export const noEmptyJsxExpressionRule = defineRule({
  meta: {
    type: "suggestion",
    docs: {
      description:
        "Disallow empty JSX expression containers such as `{}`, which render nothing.",
    },
    messages: {
      empty: "Remove this empty `{}`. It renders nothing.",
    },
  },
  createOnce(context) {
    return {
      JSXExpressionContainer(node) {
        if (node.expression.type !== "JSXEmptyExpression") return;
        if (context.sourceCode.getCommentsInside(node).length > 0) return;
        context.report({ node, messageId: "empty" });
      },
    };
  },
});
