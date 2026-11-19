import { useEffect, useRef, useState } from "react";
import {
  anchorSelection,
  applyReviewProposal,
  importReviewProposals,
  validateReviewComments,
  type ReviewComment,
  type SourceSelection,
  type LocatedAnchor,
} from "@xpotato/editor-core/annotations";
import { parseDraft } from "@xpotato/editor-core/draft";
import type { LocalDraft } from "../../data/storage.js";
import { request, query } from "../../data/api.js";
import { findMediaSnapshot, type RemoteDraft } from "../../data/media-sync.js";
import { download } from "../../shared/download.js";
import { locateReviewComment, reviewMarkState, reviewStateLabel } from "./review-marks.js";
import { ReviewStatusIcon } from "./ReviewIndicator.js";
import { ReviewComposer } from "./ReviewComposer.js";
import { followUpReviewComment, reviewCommentSelection } from "./review-actions.js";
import type { ReviewComposerDraft } from "./useReviewComposerDrafts.js";
import "./review-marks.css";

interface Props {
  draft: LocalDraft;
  selection: SourceSelection | null;
  authenticated: boolean;
  onChange: (comments: ReviewComment[], body?: string) => void;
  onDraft: (update: (draft: LocalDraft) => LocalDraft) => void;
  onLocate: (location: LocatedAnchor) => void;
  onError: (message: string) => void;
  selectedCommentId?: string | null | undefined;
  selectionRequest?: number | undefined;
  composerDraft: ReviewComposerDraft;
  onComposerChange: (commentId: string | null, value: string) => void;
  onSelect?: ((id: string) => void) | undefined;
}
export function ReviewPanel({
  draft,
  selection,
  authenticated,
  onChange,
  onDraft,
  onLocate,
  onError,
  selectedCommentId,
  selectionRequest = 0,
  composerDraft,
  onComposerChange,
  onSelect,
}: Props) {
  const canSync = authenticated && Boolean(draft.workingBranch && draft.baseCommit);
  const syncUnavailableMessage = authenticated
    ? "同期するには、下書きの開始画面で作業ブランチを選んでください。"
    : "同期するには、GitHubに接続してください。";
  const { instruction, followUps } = composerDraft;
  const [busy, setBusy] = useState(false);
  const [showClosed, setShowClosed] = useState(false);
  const [notice, setNotice] = useState("");
  const { data, body } = parseDraft(draft.source);
  const comments = draft.annotations ?? [];
  const selectedComment = comments.find((comment) => comment.id === selectedCommentId);
  const selectedLocation = selectedComment && reviewCommentSelection(body, selectedComment);
  const manualSelection = selectedCommentId ? null : selection;
  const cards = useRef(new Map<string, HTMLElement>());
  const composer = useRef<HTMLDivElement>(null);
  const focusedComment = useRef<string | null>(null);
  useEffect(() => {
    if (!selectedCommentId) {
      const focusKey = "new:" + selectionRequest;
      if (!selectionRequest || focusedComment.current === focusKey) return;
      const frame = requestAnimationFrame(() => {
        composer.current?.scrollIntoView({ block: "nearest" });
        composer.current?.focus({ preventScroll: true });
        focusedComment.current = focusKey;
      });
      return () => cancelAnimationFrame(frame);
    }
    const focusKey = selectedCommentId + ":" + selectionRequest;
    if (focusedComment.current === focusKey) return;
    const selected = cards.current.get(selectedCommentId);
    if (!selected) return;
    const frame = requestAnimationFrame(() => {
      selected.scrollIntoView({ block: "nearest" });
      selected.focus({ preventScroll: true });
      focusedComment.current = focusKey;
    });
    return () => cancelAnimationFrame(frame);
  }, [selectedCommentId, selectionRequest, comments, showClosed]);
  function act(action: () => void) {
    try {
      action();
      onError("");
    } catch (error) {
      onError(error instanceof Error ? error.message : "添削を更新できませんでした。");
    }
  }
  function add() {
    if (!manualSelection || !instruction.trim()) return;
    const next: ReviewComment = {
      id: crypto.randomUUID(),
      contentId: data.id,
      anchor: anchorSelection(body, manualSelection),
      instruction: instruction.trim(),
      createdAt: new Date().toISOString(),
      status: "open",
    };
    onChange([...comments, next]);
    onSelect?.(next.id);
    onComposerChange(null, "");
  }
  function addFollowUp(comment: ReviewComment) {
    const next = followUpReviewComment(body, comment, followUps[comment.id] ?? "");
    onChange([...comments, next]);
    onSelect?.(next.id);
    onComposerChange(comment.id, "");
  }
  async function load() {
    if (!canSync) {
      onError(syncUnavailableMessage);
      return;
    }
    setBusy(true);
    try {
      const remote = await findMediaSnapshot(draft);
      if (!remote?.draft.review) {
        setNotice("同期済みの添削はありません。");
        return;
      }
      const incoming = validateReviewComments(remote.draft.review.comments, data.id);
      onDraft((current) => {
        if (current.id !== draft.id) return current;
        const merged = new Map((current.annotations ?? []).map((c) => [c.id, c]));
        for (const c of incoming) {
          const local = merged.get(c.id);
          if (local && JSON.stringify(local) !== JSON.stringify(c))
            throw Error(
              "同じ指摘が別の端末で変更されています。手元の添削を書き出してから、差分を確認してください。",
            );
          merged.set(c.id, c);
        }
        return {
          ...current,
          annotations: [...merged.values()],
          remoteDraftId: remote.draft.id,
          reviewRevision: remote.draft.review!.revision,
        };
      });
      setNotice("添削を取得しました。");
    } catch (error) {
      onError(error instanceof Error ? error.message : "取得できませんでした。");
    } finally {
      setBusy(false);
    }
  }
  async function sync() {
    if (!canSync) {
      onError(syncUnavailableMessage);
      return;
    }
    setBusy(true);
    try {
      const remote = await request<RemoteDraft>("/drafts", {
        method: "POST",
        body: {
          id: draft.remoteDraftId ?? draft.id,
          contentId: data.id,
          branch: draft.workingBranch,
          commit: draft.baseCommit,
          sourcePath: draft.path,
        },
      });
      if (draft.reviewRevision === undefined && (remote.review?.comments.length ?? 0) > 0)
        throw Error("別の端末に添削があります。先に「取得」で読み込んでください。");
      const result = await request<{ review: { revision: number }; revision: number }>(
        "/draft-review",
        {
          method: "POST",
          body: { id: remote.id, expectedRevision: draft.reviewRevision ?? 0, comments },
        },
      );
      onDraft((current) =>
        current.id !== draft.id
          ? current
          : {
              ...current,
              remoteDraftId: remote.id,
              remoteRevision: result.revision,
              reviewRevision: result.review.revision,
            },
      );
      setNotice("添削を非公開で同期しました。");
    } catch (error) {
      onError(
        error instanceof Error && error.message === "REVIEW_CONFLICT"
          ? "別の端末で添削が更新されています。手元の内容は保持しています。"
          : error instanceof Error
            ? error.message
            : "同期できませんでした。",
      );
    } finally {
      setBusy(false);
    }
  }
  async function importFile(file?: File) {
    if (!file) return;
    try {
      if (file.size > 768 * 1024) throw Error("修正案ファイルが大きすぎます。");
      const value: unknown = JSON.parse(await file.text());
      onDraft((current) =>
        current.id !== draft.id
          ? current
          : {
              ...current,
              annotations: importReviewProposals(
                value,
                parseDraft(current.source).data.id,
                current.annotations ?? [],
              ),
            },
      );
      setNotice("修正案を読み込みました。差分を確認して反映できます。");
    } catch (error) {
      onError(error instanceof Error ? error.message : "修正案を読み込めませんでした。");
    }
  }
  return (
    <section className="review-panel" aria-label="本文の添削">
      <div className="section-title">
        <h2>添削</h2>
        <span>{comments.filter((c) => c.status === "open").length}件</span>
      </div>
      {!selectedLocation && (
        <div ref={composer} tabIndex={-1} className="review-new-target">
          <ReviewComposer
            contextual={Boolean(selectedCommentId)}
            selection={manualSelection}
            instruction={selectedCommentId ? (followUps[selectedCommentId] ?? "") : instruction}
            onInstruction={(value) => onComposerChange(selectedCommentId ?? null, value)}
            onSubmit={() => act(add)}
          />
        </div>
      )}
      <div className="panel-toolbar">
        <button
          type="button"
          disabled={!comments.some((c) => c.status === "open")}
          onClick={() =>
            download(
              "review-request-" + data.id + ".json",
              new Blob(
                [
                  JSON.stringify(
                    {
                      version: 1,
                      contentId: data.id,
                      sourceCommit: draft.syncedCommit ?? null,
                      body,
                      comments: comments.filter((c) => c.status === "open"),
                      responseFormat: {
                        version: 1,
                        contentId: data.id,
                        proposals: [
                          {
                            commentId: "指摘のid",
                            expected: "anchor.quoteと同一の原文",
                            replacement: "置換後のMDX",
                            reason: "変更の理由",
                          },
                        ],
                      },
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
          AIへの依頼を書き出す
        </button>
        <label className="file-button">
          修正案を取り込む
          <input
            type="file"
            accept=".json,application/json"
            onChange={(event) => {
              void importFile(event.target.files?.[0]);
              event.target.value = "";
            }}
          />
        </label>
      </div>
      <label className="checkbox-label">
        <input
          type="checkbox"
          checked={showClosed}
          onChange={(event) => setShowClosed(event.target.checked)}
        />
        完了した指摘も表示
      </label>
      <div className="review-list">
        {comments
          .filter((c) => showClosed || c.status === "open" || c.id === selectedCommentId)
          .map((c) => {
            const location = locateReviewComment(body, c);
            const state = reviewMarkState(c);
            const contextual = c.id === selectedCommentId && location;
            const composer = contextual && (
              <ReviewComposer
                contextual
                selection={reviewCommentSelection(body, c)}
                instruction={followUps[c.id] ?? ""}
                onInstruction={(value) => onComposerChange(c.id, value)}
                onSubmit={() => act(() => addFollowUp(c))}
              />
            );
            const history = (
              <>
                <blockquote>{c.anchor.quote}</blockquote>
                <p>{c.instruction}</p>
                {c.proposal && (
                  <div className="proposal-diff">
                    <div className="diff-before">
                      <span>変更前</span>
                      <pre>
                        <del>{c.proposal.expected}</del>
                      </pre>
                    </div>
                    <div className="diff-after">
                      <span>修正案</span>
                      <pre>
                        {c.proposal.replacement ? <ins>{c.proposal.replacement}</ins> : "（削除）"}
                      </pre>
                    </div>
                    {c.proposal.reason && <p className="small">{c.proposal.reason}</p>}
                  </div>
                )}
              </>
            );
            return (
              <article
                className="review-card"
                key={c.id}
                ref={(element) => {
                  if (element) cards.current.set(c.id, element);
                  else cards.current.delete(c.id);
                }}
                tabIndex={-1}
                data-review-state={state}
                data-review-selected={c.id === selectedCommentId || undefined}
                aria-label={reviewStateLabel(state)}
              >
                <div className="review-card-heading">
                  <span className="review-card-status">
                    <ReviewStatusIcon
                      complete={c.status === "resolved" || c.status === "applied"}
                    />
                    {c.status === "open" && !location ? "対象を確認" : reviewStateLabel(state)}
                  </span>
                  <button
                    type="button"
                    disabled={!location}
                    onClick={() => {
                      if (!location) return;
                      onSelect?.(c.id);
                      onLocate(location);
                    }}
                  >
                    対象へ
                  </button>
                </div>
                {c.status !== "open" && composer}
                {contextual && c.status !== "open" ? (
                  <details className="review-history">
                    <summary>{c.proposal ? "前の指摘と修正案" : "前の指摘"}</summary>
                    {history}
                  </details>
                ) : (
                  history
                )}
                {!location && c.status === "open" && (
                  <p className="small muted">
                    対象が変更または削除されています。本文を再選択すると指摘を付け直せます。
                  </p>
                )}
                {!location && c.status !== "open" && c.id === selectedCommentId && (
                  <p className="small muted">
                    現在の本文で対象を特定できません。追加の指摘は本文を選び直して付けてください。
                  </p>
                )}
                {!location && manualSelection?.quote && c.status === "open" && (
                  <button
                    type="button"
                    onClick={() =>
                      act(() =>
                        onChange(
                          comments.map((item) =>
                            item.id === c.id
                              ? {
                                  ...item,
                                  anchor: anchorSelection(body, manualSelection),
                                  proposal: undefined,
                                }
                              : item,
                          ),
                        ),
                      )
                    }
                  >
                    選択箇所へ付け直す
                  </button>
                )}
                {c.status === "open" && (
                  <div className="panel-toolbar">
                    {c.proposal && (
                      <button
                        type="button"
                        className="primary"
                        disabled={!location}
                        onClick={() =>
                          act(() => {
                            const result = applyReviewProposal(body, c);
                            onChange(
                              comments.map((item) => (item.id === c.id ? result.comment : item)),
                              result.body,
                            );
                          })
                        }
                      >
                        修正案を反映
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() =>
                        onChange(
                          comments.map((item) =>
                            item.id === c.id ? { ...item, status: "resolved" } : item,
                          ),
                        )
                      }
                    >
                      解決
                    </button>
                    {c.proposal && (
                      <button
                        type="button"
                        onClick={() =>
                          onChange(
                            comments.map((item) =>
                              item.id === c.id ? { ...item, status: "rejected" } : item,
                            ),
                          )
                        }
                      >
                        見送る
                      </button>
                    )}
                  </div>
                )}
                {c.status === "open" && composer}
                {c.status !== "open" && c.status !== "applied" && (
                  <button
                    type="button"
                    onClick={() =>
                      onChange(
                        comments.map((item) =>
                          item.id === c.id
                            ? {
                                ...item,
                                status: "open",
                              }
                            : item,
                        ),
                      )
                    }
                  >
                    指摘を再開
                  </button>
                )}
              </article>
            );
          })}
      </div>
      <div className="panel-toolbar">
        <button type="button" disabled={!canSync || busy} onClick={() => void sync()}>
          添削を同期
        </button>
        <button type="button" disabled={!canSync || busy} onClick={() => void load()}>
          取得
        </button>
      </div>
      {authenticated && !canSync && <p className="muted small">{syncUnavailableMessage}</p>}
      {notice && (
        <p className="small" role="status">
          {notice}
        </p>
      )}
    </section>
  );
}
