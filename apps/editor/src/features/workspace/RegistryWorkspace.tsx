import { lazy, Suspense, useState } from "react";
import type { GitWorkspace } from "../git/useGitWorkspace.js";
import { BranchSetup, initialBranchPlan } from "./StartWorkspace.js";
import type { useRegistryWorkspace } from "./useRegistryWorkspace.js";
import { download } from "../../shared/download.js";
const TaxonomyManager = lazy(() =>
  import("../../components/TaxonomyManager.js").then((module) => ({
    default: module.TaxonomyManager,
  })),
);
const SeriesPanel = lazy(() =>
  import("../../components/SeriesPanel.js").then((module) => ({ default: module.SeriesPanel })),
);

export function RegistryWorkspace({
  kind,
  git,
  registry,
  busy,
  run,
  onError,
}: {
  kind: "taxonomy" | "series";
  git: GitWorkspace;
  registry: ReturnType<typeof useRegistryWorkspace>;
  busy: boolean;
  run: (operation: () => Promise<void>) => void;
  onError: (message: string) => void;
}) {
  const [plan, setPlan] = useState(() =>
    registry.state.branch
      ? {
          mode: "existing" as const,
          sourceBranch: registry.state.sourceBranch,
          targetBranch: registry.state.branch,
        }
      : initialBranchPlan(git.auth.authenticated),
  );
  const [choosing, setChoosing] = useState(!registry.state.branch);
  return (
    <div className="registry-workspace">
      <header className="workspace-page-heading">
        <p className="eyebrow">{kind === "taxonomy" ? "CLASSIFY" : "SERIES"}</p>
        <h1>{kind === "taxonomy" ? "分類・タグ" : "連載・コース"}</h1>
        <p>
          {kind === "taxonomy"
            ? "記事種別ごとの分類とタグを整えます。"
            : "連載を作り、記事を読む順序を決めます。"}
        </p>
      </header>
      <section className="registry-workplace" aria-label="管理項目の保存先">
        <div className="registry-status">
          <span>
            <strong>{registry.state.branch || "この端末"}</strong>
            <small>
              {registry.status}
              {registry.state.changes ? " · Gitに未保存の変更" : ""}
            </small>
          </span>
          <button
            type="button"
            aria-expanded={choosing}
            disabled={busy || !registry.available}
            onClick={() => setChoosing(!choosing)}
          >
            作業場所を選ぶ
          </button>
        </div>
        {choosing && (
          <>
            <BranchSetup
              plan={plan}
              onChange={setPlan}
              branches={git.branches}
              authenticated={git.auth.authenticated}
              disabled={busy || !registry.available}
            />
            <button
              type="button"
              disabled={
                busy || !registry.available || (plan.mode !== "local" && !plan.targetBranch)
              }
              onClick={() =>
                run(async () => {
                  await registry.open(await git.prepareWorkspace(plan));
                  setChoosing(false);
                })
              }
            >
              この作業場所を開く
            </button>
          </>
        )}
        <div className="registry-save-actions">
          <button
            type="button"
            className="primary"
            disabled={
              busy ||
              !registry.available ||
              !git.auth.authenticated ||
              !registry.state.branch ||
              !registry.state.changes ||
              registry.issues.length > 0
            }
            onClick={() => run(registry.save)}
          >
            Gitへ保存
          </button>
          <button
            type="button"
            disabled={
              busy ||
              !registry.available ||
              !git.auth.authenticated ||
              !registry.state.branch ||
              Boolean(registry.state.changes)
            }
            onClick={() => run(registry.createPR)}
          >
            Draft PRを作成
          </button>
          {registry.state.branch && (
            <button
              type="button"
              disabled={busy || !registry.available || !git.auth.authenticated}
              onClick={() => run(registry.refresh)}
            >
              最新版を取得
            </button>
          )}
        </div>
        {registry.state.pr && (
          <a href={registry.state.pr.url} target="_blank" rel="noreferrer">
            Draft PR #{registry.state.pr.number}
          </a>
        )}
        {registry.available && registry.conflict && (
          <section aria-label="保留中の変更">
            <p role="alert" className="message error">
              保存先の内容と競合しています。保留中の変更を保持しています。
            </p>
            {registry.state.changes?.taxonomy?.length ? (
              <ul>
                {registry.state.changes.taxonomy.map((term) => (
                  <li key={term.namespace + term.id}>
                    {term.label} <small>({term.id})</small>
                  </li>
                ))}
              </ul>
            ) : null}
            {registry.state.changes?.series && (
              <p className="small">連載の所属記事・順序の変更を含みます。</p>
            )}
            <div className="button-row">
              <button
                type="button"
                onClick={() =>
                  download(
                    "xpotato-registry-changes.json",
                    new Blob(
                      [
                        JSON.stringify(
                          {
                            version: 1,
                            branch: registry.state.branch,
                            baseCommit: registry.state.commit,
                            changes: registry.state.changes,
                          },
                          null,
                          2,
                        ),
                      ],
                      { type: "application/json" },
                    ),
                  )
                }
              >
                変更を書き出す
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => {
                  if (
                    window.confirm(
                      "この作業場所でGitに保存していないタグ・分類・連載の変更をすべて取り消します。必要な変更は先に書き出してください。Git上の内容は変更しません。",
                    )
                  )
                    run(registry.discardChanges);
                }}
              >
                保留中の変更を取り消す
              </button>
            </div>
          </section>
        )}
        {registry.issues.map((issue) => (
          <p className="message error" key={issue}>
            {issue}
          </p>
        ))}
        {!registry.available && (
          <button type="button" disabled={busy} onClick={() => run(registry.retryLoad)}>
            再度読み込む
          </button>
        )}
      </section>
      <Suspense fallback={<p role="status">管理画面を開いています…</p>}>
        {kind === "taxonomy" ? (
          <TaxonomyManager
            taxonomy={registry.manifest}
            pendingAdditions={registry.state.changes?.taxonomy ?? []}
            onChange={registry.change}
            onError={onError}
            disabled={busy || !registry.available}
          />
        ) : (
          <fieldset className="registry-series-controls" disabled={busy || !registry.available}>
            <SeriesPanel
              registry={registry.manifest.seriesRegistry ?? { schemaVersion: 1, series: [] }}
              documents={registry.manifest.contentIndex ?? []}
              onChange={(series) => registry.change({ series })}
              onError={onError}
            />
          </fieldset>
        )}
      </Suspense>
    </div>
  );
}
