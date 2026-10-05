/** Shiki colours become static CSS classes, preserving the strict style CSP. */
export const codeBlockTransformer = {
  name: "xpotato-editor-code",
  pre(node) {
    delete node.properties.style;
    node.properties.tabIndex = 0;
    node.properties.role = "region";
    node.properties.ariaLabel = `${this.options.lang || "text"}コード（横スクロール可能）`;
  },
  span(node) {
    const colour = /color:\s*#([\da-f]{6})/iu.exec(String(node.properties.style ?? ""))?.[1]?.toLowerCase();
    if (colour) this.addClassToHast(node, `syntax-${colour}`);
    delete node.properties.style;
  },
  root(node) {
    const lang = this.options.lang || "text";
    const element = (tagName, properties, children) => ({ type: "element", tagName, properties, children });
    const text = value => ({ type: "text", value });
    node.children = [element("div", { className: ["code-block"], "data-code-block": "" }, [
      element("div", { className: ["code-toolbar"] }, [
        element("span", { className: ["code-language"] }, [text(lang)]),
        element("button", { type: "button", className: ["code-copy-button"], hidden: true, ariaLabel: `${lang}コードをコピー` }, [text("コピー")]),
      ]),
      ...node.children,
      element("p", { className: ["code-copy-status"], role: "status", ariaLive: "polite", ariaAtomic: true }, []),
    ])];
  },
};
