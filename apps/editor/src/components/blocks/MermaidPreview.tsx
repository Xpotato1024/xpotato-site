import { useEffect, useId, useState } from "react";
import { mermaidInput } from "../../../../../ops/media/visuals/inputs.mjs";

type RenderState =
  { status: "loading" } | { status: "ready"; svg: string } | { status: "error"; message: string };

/** Preview-only: publication uses the existing offline static-media pipeline. */
export function MermaidPreview({ source }: { source: string }) {
  const id = useId().replace(/[^A-Za-z0-9]/gu, "");
  const [rendered, setRendered] = useState<RenderState>({ status: "loading" });

  useEffect(() => {
    let active = true;
    try {
      // Exactly the same bounded grammar used by the local production renderer.
      mermaidInput(source);
    } catch (error) {
      setRendered({
        status: "error",
        message: error instanceof Error ? error.message : "Mermaidの構文を確認してください。",
      });
      return;
    }
    setRendered({ status: "loading" });
    // Mermaid and its layout engine are not loaded for ordinary editor sessions.
    const render = async () => {
      const { default: mermaid } = await import("mermaid");
      mermaid.initialize({
        startOnLoad: false,
        securityLevel: "strict",
        theme: "neutral",
        flowchart: { htmlLabels: false },
        suppressErrorRendering: true,
      });
      return mermaid.render("cms-mermaid-" + id, source);
    };
    const timer = window.setTimeout(() => {
      void render()
        .then(({ svg }) => {
          if (active) setRendered({ status: "ready", svg });
        })
        .catch(() => {
          if (active) {
            setRendered({
              status: "error",
              message: "構成図を描画できません。ソースを確認してください。",
            });
          }
        });
    }, 180);
    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [id, source]);
  return (
    <figure className="cms-mermaid-preview" aria-label="Mermaid構成図のプレビュー">
      {rendered.status === "ready" ? (
        <div dangerouslySetInnerHTML={{ __html: rendered.svg }} />
      ) : (
        <p
          role="status"
          className={rendered.status === "error" ? "cms-field-error" : "cms-chart-help"}
        >
          {rendered.status === "error" ? rendered.message : "構成図を描画しています…"}
        </p>
      )}
      <figcaption className="cms-chart-help">
        編集用プレビューです。公開する図は既存の図版制作処理で静的PNGに変換し、画像ブロックへ配置してください。
      </figcaption>
    </figure>
  );
}
