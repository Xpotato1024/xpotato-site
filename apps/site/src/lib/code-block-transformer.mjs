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
    const icon = (name, children) => element("svg", { className: ["code-copy-icon", `code-copy-icon-${name}`], viewBox: "0 0 24 24", width: 20, height: 20, fill: "none", stroke: "currentColor", strokeWidth: 1.8, strokeLinecap: "round", strokeLinejoin: "round", ariaHidden: true, focusable: false }, children);
    node.children = [element("div", { className: ["code-block"], "data-code-block": "" }, [
      element("div", { className: ["code-toolbar"] }, [
        element("span", { className: ["code-language"] }, [text(lang)]),
        element("button", { type: "button", className: ["code-copy-button"], hidden: true, ariaLabel: `${lang}コードをコピー` }, [
          icon("copy", [element("rect", { x: 9, y: 9, width: 11, height: 11, rx: 2 }, []), element("path", { d: "M15 5V4H4v11h1" }, [])]),
          icon("success", [element("path", { d: "m5 12 4 4L19 6" }, [])]),
          icon("error", [element("path", { d: "M12 8v5m0 4h.01M10 3 2 18a2 2 0 0 0 2 3h16a2 2 0 0 0 2-3L14 3a2 2 0 0 0-4 0Z" }, [])]),
          element("span", { className: ["code-copy-tooltip"], ariaHidden: true }, [text("コードをコピー")]),
        ]),
      ]),
      ...node.children,
      element("p", { className: ["code-copy-status"], role: "status", ariaLive: "polite", ariaAtomic: true }, []),
      element("p", { className: ["code-copy-feedback"], hidden: true, ariaHidden: true }, []),
    ])];
  },
};
