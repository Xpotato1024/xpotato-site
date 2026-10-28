import remarkParse from "remark-parse";
import remarkMdx from "remark-mdx";
import remarkGfm from "remark-gfm";
import remarkRehype from "remark-rehype";
import rehypeStringify from "rehype-stringify";
import { unified } from "unified";
import { visit } from "unist-util-visit";
import { validatePortableMdx } from "./index.js";

const safeUrl = (value:string,media=false) => {
  if(/[\u0000-\u0020\u007f\\\\]/u.test(value)||value.startsWith("//"))return false;
  try{return ["https:","http:","mailto:",...(media?["media:"]:[])].includes(new URL(value,"https://draft.invalid/").protocol);}
  catch{return false;}
};
// Drafts are parsed as data. No MDX compile/evaluate, filesystem import or code execution.
export const renderDraftMarkdown = async (body: string) => {
  const errors = [...validatePortableMdx(body)], warnings: string[] = [];
  const processor = unified().use(remarkParse).use(remarkMdx).use(remarkGfm);
  if (errors.length) throw new Error("DRAFT_MARKDOWN_INVALID");
  let tree: ReturnType<typeof processor.parse>;
  try { tree = processor.parse(body); } catch { throw new Error("DRAFT_MARKDOWN_INVALID"); }
  visit(tree, (node) => {
    const item = node as unknown as { type: string; url?: string; name?: string; identifier?: string;
      attributes?: { name: string; value: unknown }[]; children?: unknown[]; value?: string };
    if (["link", "definition", "image"].includes(item.type) && item.url) {
      if (!safeUrl(item.url,item.type==="image")) errors.push("危険または未対応のURL");
    }
    if (item.type === "image" || item.type === "imageReference") {
      item.type = "text"; item.value = "［画像未準備］"; delete item.children; delete item.url;
      warnings.push("画像は未準備placeholderです。画像を取得していません。");
    }
    if (item.type === "linkReference" && !tree.children.some((value) =>
      value.type === "definition" && value.identifier.toLowerCase() === item.identifier?.toLowerCase())) errors.push("未解決のリンク参照");
    if (item.type === "mdxJsxFlowElement" || item.type === "mdxJsxTextElement") {
      for (const attr of item.attributes ?? []) {
        if (["href", "sourceUrl"].includes(attr.name) && typeof attr.value === "string"
          && !safeUrl(attr.value)) errors.push("危険なsemantic module URL");
      }
      const name = item.name ?? "";
      const labels = (item.attributes ?? []).filter((attr) => ["title","summary","alt","caption","leftLabel","rightLabel","symptom","check"].includes(attr.name))
        .map((attr) => String(attr.value)).join(" / ");
      const prefix = name === "Figure" || name === "Gallery" ? "［画像未準備］"
        : name === "Demo" ? "［Demo未実行］" : "［" + name + " 簡易表示］";
      warnings.push(name + "は下書き用簡易表示です。公開時のlayout・画像・runtimeは未検証です。");
      item.type = "blockquote"; delete item.name; delete item.attributes;
      item.children = [{type:"paragraph",children:[{type:"text",value:prefix + " " + labels}]}, ...(item.children ?? [])];
    }
  });
  if (errors.length) throw new Error("DRAFT_MARKDOWN_INVALID");
  const html = String(await unified().use(remarkRehype).use(rehypeStringify).stringify(
    await unified().use(remarkRehype).run(tree)));
  return { html, warnings: [...new Set(warnings)] };
};
