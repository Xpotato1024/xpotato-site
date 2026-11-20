import katex from "katex";

export { readMathMeta, writeMathMeta } from "./math-meta.js";

/** Match the public math transform's bounded TeX subset and native MathML output. */
export function safeMathMarkup(value: string): string {
  if (!value.trim() || value.length > 4096) {
    throw Error("式は1〜4096文字で入力してください。");
  }
  if (
    /\\(?:href|url|includegraphics|html\w*|class|style|color|textcolor|definecolor|require|def|gdef|edef|xdef|let|futurelet|newcommand|renewcommand|providecommand|global)\b/u.test(
      value,
    )
  ) {
    throw Error("数式の外部参照・装飾指定・マクロ定義には対応していません。");
  }
  const html = katex.renderToString(value, {
    output: "mathml",
    displayMode: true,
    throwOnError: true,
    strict: "error",
    trust: false,
    maxExpand: 100,
    maxSize: 8,
  });
  if (/<[^>]+\s(?:style|href|src|on\w+)\s*=/iu.test(html)) {
    throw Error("この数式の表示方法には対応していません。");
  }
  return html;
}
