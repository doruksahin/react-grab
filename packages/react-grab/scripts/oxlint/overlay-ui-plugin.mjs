// ADR-0022: feature components compose primitives; colours and type sizes
// come from tokens. oxlint has no `no-restricted-syntax`, so this rule checks
// the text of string and template literals (class strings, inline styles).
const HEX_COLOR =
  /(?<![\w&/])#(?:[0-9a-fA-F]{8}|[0-9a-fA-F]{6}|[0-9a-fA-F]{3,4})\b/;
const FUNCTIONAL_COLOR = /\b(?:rgba?|hsla?)\(/;
const ARBITRARY_TEXT_SIZE = /\btext-\[\d+(?:\.\d+)?px\]/;

const RULES = [
  [HEX_COLOR, "a hex colour; use a colour token from styles.css"],
  [
    FUNCTIONAL_COLOR,
    "an rgb()/hsl() colour; use a colour token from styles.css",
  ],
  [
    ARBITRARY_TEXT_SIZE,
    "an arbitrary text-[Npx] size; use a type step (text-meta … text-heading)",
  ],
];

const isHrefValue = (node) =>
  node.parent?.type === "JSXAttribute" && node.parent.name?.name === "href";

const noRawStyles = {
  meta: { type: "problem" },
  create(context) {
    const check = (node, text) => {
      for (const [pattern, description] of RULES) {
        if (pattern.test(text)) {
          context.report({
            node,
            message: `Feature component contains ${description} (ADR-0022).`,
          });
        }
      }
    };
    return {
      Literal(node) {
        if (typeof node.value === "string" && !isHrefValue(node))
          check(node, node.value);
      },
      TemplateElement(node) {
        check(node, node.value.raw);
      },
    };
  },
};

// features/ holds domain logic, hooks and stores; JSX components live in
// components/ (ADR-0022).
const noJsx = {
  meta: { type: "problem" },
  create(context) {
    const report = (node) =>
      context.report({
        node,
        message: "JSX belongs in components/, not features/ (ADR-0022).",
      });
    return { JSXElement: report, JSXFragment: report };
  },
};

export default {
  meta: { name: "overlay-ui" },
  rules: { "no-raw-styles": noRawStyles, "no-jsx": noJsx },
};
