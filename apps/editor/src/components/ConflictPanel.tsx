import { useState } from "react";
import type { GitWorkspace } from "../features/git/useGitWorkspace.js";
import type { LocalDraft } from "../data/storage.js";
export function ConflictPanel({
  conflict,
  draft,
  onResolve,
}: {
  conflict: NonNullable<GitWorkspace["conflict"]>;
  draft: LocalDraft;
  onResolve: (source: string, registry: "local" | "remote") => void;
}) {
  const [source, setSource] = useState(draft.source);
  const [registry, setRegistry] = useState<"local" | "remote" | "">(
    draft.pendingRegistryChanges ? "" : "remote",
  );
  return (
    <section className="conflict-panel">
      <h2>変更の競合</h2>
      <p>Gitの原稿が更新されています。比較して、保存する原稿を選びます。</p>
      <details>
        <summary>編集開始時</summary>
        <pre>{conflict.base || "比較用の原稿はありません。"}</pre>
      </details>
      <details open>
        <summary>Gitの最新版</summary>
        <pre>{conflict.remote}</pre>
        <button type="button" onClick={() => setSource(conflict.remote)}>
          最新版を採用
        </button>
      </details>
      <label>
        保存する原稿
        <textarea
          rows={12}
          value={source}
          spellCheck={false}
          onChange={(event) => setSource(event.target.value)}
        />
      </label>
      <button type="button" onClick={() => setSource(draft.source)}>
        手元の原稿に戻す
      </button>
      {draft.pendingRegistryChanges && (
        <details open>
          <summary>連載・分類の変更</summary>
          <h3>手元の変更</h3>
          <pre>{JSON.stringify(draft.pendingRegistryChanges, null, 2)}</pre>
          <h3>Gitの連載</h3>
          <pre>{JSON.stringify(conflict.manifest.seriesRegistry, null, 2)}</pre>
          <label>
            採用する設定
            <select
              value={registry}
              onChange={(event) => setRegistry(event.target.value as "local" | "remote")}
            >
              <option value="">比較して選択</option>
              <option value="remote">Gitの設定を採用</option>
              <option value="local">手元の変更を適用</option>
            </select>
          </label>
        </details>
      )}
      <button
        type="button"
        className="primary"
        disabled={!registry}
        onClick={() => registry && onResolve(source, registry)}
      >
        比較結果を反映
      </button>
    </section>
  );
}
