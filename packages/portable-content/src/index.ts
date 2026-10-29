import { semanticContentModulePropsSchemas } from "@xpotato/content-contracts";
import remarkMdx from "remark-mdx";
import remarkParse from "remark-parse";
import { unified } from "unified";
import { visit } from "unist-util-visit";

const portableMdxProcessor = unified().use(remarkParse).use(remarkMdx);
const approvedModuleNames = new Set(Object.keys(semanticContentModulePropsSchemas));

const forbiddenPortableText: readonly Readonly<{ pattern: RegExp; reason: string }>[] = [
  { pattern: /\b(?:https?:\/\/[^\s"')]*\.r2\.dev|r2:\/\/)/iu, reason: "R2/provider URL" },
  { pattern: /\bhttps?:\/\/[^\s"')]*\.r2\.cloudflarestorage\.com\b/iu, reason: "R2/provider URL" },
  { pattern: /\bmedia\/v1\/objects\/sha256\//u, reason: "provider object key" },
  { pattern: /(?:\.\.\/)+(?:components|src)\//u, reason: "React/filesystem implementation path" },
  { pattern: /\b(?:canonical|og:image|sitemap|searchIndex)\s*=/u, reason: "hand-maintained discovery/SEO state" },
];

interface MdxJsxAttributeValueExpression {
  readonly type: "mdxJsxAttributeValueExpression";
}

interface MdxJsxAttribute {
  readonly type: "mdxJsxAttribute";
  readonly name: string;
  readonly value: string | null | MdxJsxAttributeValueExpression;
}

interface MdxJsxElementNode {
  readonly type: "mdxJsxFlowElement" | "mdxJsxTextElement";
  readonly name: string | null;
  readonly attributes: readonly unknown[];
}

const validateApprovedModule = (node: MdxJsxElementNode, errors: string[]): void => {
  if (!node.name || !approvedModuleNames.has(node.name)) {
    errors.push(`unapproved JSX/HTML element: ${node.name ?? "fragment"}`);
    return;
  }
  const props: Record<string, unknown> = {};
  for (const rawAttribute of node.attributes) {
    const attribute = rawAttribute as Partial<MdxJsxAttribute>;
    if (attribute.type !== "mdxJsxAttribute" || typeof attribute.name !== "string") {
      errors.push(`${node.name}: JSX spread/expression attributes are not portable`);
      continue;
    }
    if (Object.hasOwn(props, attribute.name)) {
      errors.push(`${node.name}: duplicate prop ${attribute.name}`);
      continue;
    }
    if (attribute.value === null) props[attribute.name] = true;
    else if (typeof attribute.value === "string") props[attribute.name] = attribute.value;
    else {
      errors.push(`${node.name}: prop expressions are not portable`);
      continue;
    }
  }
  const schema = semanticContentModulePropsSchemas[node.name as keyof typeof semanticContentModulePropsSchemas];
  const result = schema.safeParse(props);
  if (!result.success) {
    const issues = result.error.issues.map((issue) => issue.path.join(".") || "props").join(", ");
    errors.push(`${node.name}: props do not match the approved schema (${issues})`);
  }
};

export const validatePortableMdx = (source: string): readonly string[] => {
  const errors = forbiddenPortableText.filter(({ pattern }) => pattern.test(source)).map(({ reason }) => reason);
  let tree: ReturnType<typeof portableMdxProcessor.parse>;
  try {
    tree = portableMdxProcessor.parse(source);
  } catch {
    return [...errors, "invalid MDX syntax"];
  }
  visit(tree, (node, _index, parent) => {
    if (node.type === "mdxjsEsm") errors.push("arbitrary runtime import/export");
    else if (node.type === "mdxFlowExpression" || node.type === "mdxTextExpression") {
      errors.push("MDX runtime expression");
    } else if (node.type === "html") {
      errors.push("raw HTML is not an approved authoring construct");
    } else if (node.type === "mdxJsxFlowElement" || node.type === "mdxJsxTextElement") {
      validateApprovedModule(node as MdxJsxElementNode, errors);
      const element = node as MdxJsxElementNode & { children?: readonly { type?: string; value?: string; name?: string | null }[] };
      if (element.name === "DiagnosticItem" && (parent as { name?: string } | undefined)?.name !== "DiagnosticList") {
        errors.push("DiagnosticItem must be nested directly inside DiagnosticList");
      }
      if (element.name === "DiagnosticList" && !element.children?.some((child) => child.name === "DiagnosticItem")) {
        errors.push("DiagnosticList requires at least one DiagnosticItem");
      }
      if (element.name === "DiagnosticList" && element.children?.some(child => child.name !== "DiagnosticItem" && !(child.type === "text" && !child.value?.trim()))) {
        errors.push("DiagnosticList accepts only DiagnosticItem children");
      }
    }
  });
  return [...new Set(errors)];
};

/** Parse semantic Demo references; fenced examples are never executable declarations. */
export const collectDemoModuleIds = (source: string): readonly string[] => {
  const tree = portableMdxProcessor.parse(source);
  const ids: string[] = [];
  visit(tree, (node) => {
    if (node.type !== "mdxJsxFlowElement" && node.type !== "mdxJsxTextElement") return;
    const element = node as MdxJsxElementNode;
    if (element.name !== "Demo") return;
    const errors: string[] = [];
    validateApprovedModule(element, errors);
    if (errors.length) throw new Error(errors.join("; "));
    const attribute = element.attributes.find((value) => (value as MdxJsxAttribute).name === "module") as MdxJsxAttribute;
    if (typeof attribute?.value !== "string") throw new Error("Demo requires a literal module");
    ids.push(attribute.value);
  });
  return ids;
};
