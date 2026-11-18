import { importPreparedMedia } from "../media/prepared.js";
import {
  findMediaSnapshot,
  restoreMediaSnapshot,
  type RemoteMediaSnapshot,
} from "../data/media-sync.js";
import { parseDraft } from "@xpotato/editor-core/draft";
import { useEffect, useRef, useState } from "react";
import { mediaPolicy, type MediaKind } from "@xpotato/editor-core/policy";
import { optimizeImage } from "../media/optimize.js";
import {
  localMedia,
  saveLocalMedia,
  deleteLocalMedia,
  type LocalMedia,
  type LocalDraft,
} from "../data/storage.js";
import { request } from "../data/api.js";
interface Props {
  draft: LocalDraft;
  authenticated: boolean;
  onInsert: (assetId: string, alt: string, caption?: string) => void;
  onHero?: (assetId: string) => void;
  onGallery?: (items: { asset: string; alt: string; caption?: string }[]) => void;
  onDraft: (value: LocalDraft) => void;
  onError: (message: string) => void;
}
const format = (bytes: number) =>
  bytes >= 1024 * 1024
    ? (bytes / 1024 / 1024).toFixed(2) + " MiB"
    : Math.round(bytes / 1024) + " KiB";
function Thumbnail({ media }: { media: LocalMedia }) {
  const [url, setUrl] = useState("");
  useEffect(() => {
    const value = URL.createObjectURL(media.blob);
    setUrl(value);
    return () => URL.revokeObjectURL(value);
  }, [media.blob]);
  return <img src={url} alt={media.assetId} loading="lazy" />;
}
export function MediaPanel({
  draft,
  authenticated,
  onInsert,
  onHero,
  onGallery,
  onDraft,
  onError,
}: Props) {
  const [selected, setSelected] = useState<string[]>([]);
  const altInputs = useRef(new Map<string, HTMLInputElement>());
  const captionInputs = useRef(new Map<string, HTMLTextAreaElement>());
  const mediaWrites = useRef<Promise<void>>(Promise.resolve());
  const [invalidAlt, setInvalidAlt] = useState<string | null>(null);
  const [items, setItems] = useState<LocalMedia[]>([]),
    [kind, setKind] = useState<MediaKind>("photo"),
    [busy, setBusy] = useState(false),
    [quota, setQuota] = useState<{ used: number; reserved: number; limit: number } | null>(null),
    [remoteSnapshot, setRemoteSnapshot] = useState<RemoteMediaSnapshot | null>(null);
  const reload = () =>
    localMedia(draft.id).then((values) => {
      setItems(values);
      window.dispatchEvent(
        new CustomEvent("editor-media-changed", { detail: { draftId: draft.id } }),
      );
    });
  useEffect(() => {
    void reload();
  }, [draft.id]);
  function updateMedia(
    id: string,
    fields: Partial<Pick<LocalMedia, "alt" | "caption" | "remoteId">>,
  ) {
    const next = mediaWrites.current
      .catch(() => {})
      .then(async () => {
        const latest = (await localMedia(draft.id)).find((item) => item.id === id);
        if (!latest) throw Error("MEDIA_NOT_FOUND");
        await saveLocalMedia({ ...latest, ...fields });
      });
    mediaWrites.current = next;
    return next;
  }
  async function presentation(
    media: LocalMedia,
    fields: Partial<Pick<LocalMedia, "alt" | "caption">>,
  ) {
    try {
      await updateMedia(media.id, fields);
      await reload();
    } catch {
      onError("画像の情報を保存できませんでした。");
    }
  }
  function insertionValues(media: LocalMedia[]) {
    const values = media.map((item) => ({
      id: item.id,
      asset: item.assetId,
      alt: (altInputs.current.get(item.id)?.value ?? item.alt ?? "").trim(),
      caption: (captionInputs.current.get(item.id)?.value ?? item.caption ?? "").trim(),
    }));
    const missing = values.find((item) => !item.alt);
    if (missing) {
      setInvalidAlt(missing.id);
      onError("代替テキストを入力してから、画像を挿入してください。");
      altInputs.current.get(missing.id)?.focus();
      return null;
    }
    setInvalidAlt(null);
    onError("");
    return values.map(({ asset, alt, caption }) => ({
      asset,
      alt,
      ...(caption ? { caption } : {}),
    }));
  }
  async function add(files: FileList | null) {
    if (!files?.length) return;
    setBusy(true);
    try {
      for (const file of Array.from(files)) {
        const id = "figure-" + crypto.randomUUID().slice(0, 8);
        const media = await optimizeImage(file, draft.id, id, kind);
        await saveLocalMedia(media);
      }
      await reload();
      onError("");
    } catch (error) {
      onError(error instanceof Error ? error.message : "画像を処理できませんでした");
    } finally {
      setBusy(false);
    }
  }
  async function prepared(file: File | undefined) {
    if (!file) return;
    setBusy(true);
    try {
      const media = await importPreparedMedia(file, draft.id);
      await saveLocalMedia(media);
      await reload();
      onError("");
    } catch (error) {
      onError(error instanceof Error ? error.message : "変換済み画像を取り込めませんでした");
    } finally {
      setBusy(false);
    }
  }
  async function sync(media: LocalMedia) {
    setBusy(true);
    try {
      if (!draft.workingBranch || !draft.baseCommit)
        throw Error("先に編集ブランチを作成して、記事をGitへ保存してください。");
      const remote = await request<{ id: string; revision: number }>("/drafts", {
        method: "POST",
        body: {
          id: draft.remoteDraftId ?? draft.id,
          contentId: parseDraft(draft.source).data.id,
          branch: draft.workingBranch,
          commit: draft.baseCommit,
          sourcePath: draft.path,
        },
      });
      const reservation = await request<{ id: string }>("/media/reserve", {
        method: "POST",
        body: {
          draftId: remote.id,
          assetId: media.assetId,
          sha256: media.sha256,
          sourceSha256: media.sourceSha256,
          bytes: media.blob.size,
          sourceBytes: media.originalBytes,
          kind: media.kind,
          mime: media.blob.type,
          expectedDraftRevision: remote.revision,
          transform: media.transform,
          sourceRetained: media.sourceRetained,
        },
      });
      const asset = await request<{ id: string }>("/media/upload/" + reservation.id, {
        method: "PUT",
        blob: media.blob,
      });
      await updateMedia(media.id, { remoteId: asset.id });
      onDraft({ ...draft, remoteDraftId: remote.id, remoteRevision: remote.revision + 1 });
      setQuota(await request("/quota"));
      await reload();
      onError("");
    } catch (error) {
      onError(error instanceof Error ? error.message : "画像の同期に失敗しました");
    } finally {
      setBusy(false);
    }
  }
  async function restoreRemote() {
    setBusy(true);
    try {
      const remote = await findMediaSnapshot(draft);
      setRemoteSnapshot(remote);
      if (!remote) {
        onError("このブランチには同期済みの画像がまだありません。");
        return;
      }
      const result = await restoreMediaSnapshot(draft, remote);
      onDraft(result.draft);
      await reload();
      setQuota(await request("/quota"));
      onError(
        result.missing.length ? "画像を復元できませんでした: " + result.missing.join("、") : "",
      );
    } catch (error) {
      onError(error instanceof Error ? error.message : "画像を取得できませんでした");
    } finally {
      setBusy(false);
    }
  }
  async function restoreRejected(id: string) {
    setBusy(true);
    try {
      const remote = await findMediaSnapshot(draft);
      if (!remote) throw Error("DRAFT_NOT_FOUND");
      await request("/draft-state", {
        method: "POST",
        body: {
          id: remote.draft.id,
          revision: remote.draft.revision,
          action: "restore-media",
          mediaId: id,
        },
      });
      await restoreRemote();
    } catch (error) {
      onError(error instanceof Error ? error.message : "復元できませんでした");
    } finally {
      setBusy(false);
    }
  }
  async function remove(media: LocalMedia) {
    if (media.remoteId) {
      try {
        const snapshot = await request<{ draft: { revision: number } }>(
          "/draft?id=" + encodeURIComponent(draft.remoteDraftId ?? draft.id),
        );
        await request("/draft-state", {
          method: "POST",
          body: {
            id: draft.remoteDraftId ?? draft.id,
            revision: snapshot.draft.revision,
            action: "reject",
            assetId: media.assetId,
          },
        });
      } catch (error) {
        onError(error instanceof Error ? error.message : "棄却を同期できませんでした");
        return;
      }
    }
    await deleteLocalMedia(media.id);
    await reload();
    if (authenticated) setRemoteSnapshot(await findMediaSnapshot(draft));
  }
  return (
    <section className="media-panel" aria-label="画像とGIF">
      <div className="section-title">
        <h2>画像とGIF</h2>
        <span>{items.length}点</span>
      </div>
      <p className="muted">画像は先に端末内で処理します。同期先は非公開の下書き領域です。</p>
      <button type="button" disabled={!authenticated || busy} onClick={() => void restoreRemote()}>
        別の端末で同期した画像を取得
      </button>
      <label>
        画像の用途
        <select value={kind} onChange={(event) => setKind(event.target.value as MediaKind)}>
          <option value="photo">写真・説明用イラスト</option>
          <option value="technical">技術図・画面・証拠画像</option>
          <option value="animation">GIF・アニメーション</option>
        </select>
      </label>
      <label className="file-drop">
        画像を選択
        <input
          type="file"
          multiple
          accept="image/jpeg,image/png,image/webp,image/gif,image/heic,image/heif"
          disabled={busy}
          onChange={(event) => void add(event.target.files)}
        />
      </label>
      <p className="muted small">
        入力{mediaPolicy.inputBytes / 1024 / 1024} MiBまで。保存上限は写真
        {mediaPolicy.photo.maxBytes / 1024 / 1024} MiB、技術図
        {mediaPolicy.technical.maxBytes / 1024 / 1024} MiB、アニメーション
        {mediaPolicy.animation.maxBytes / 1024 / 1024} MiB。GIFの動きは変更しません。
      </p>
      <details>
        <summary>専用処理で変換したHEIC・GIFを取り込む</summary>
        <p className="muted small">
          AIや専用媒体処理が生成した下書き用媒体ファイルを選びます。元のファイルは上書きしません。
        </p>
        <label>
          変換済み媒体ファイル
          <input
            type="file"
            accept=".json,application/json"
            disabled={busy}
            onChange={(event) => void prepared(event.target.files?.[0])}
          />
        </label>
      </details>
      {busy && <p role="status">画像を処理しています…</p>}
      {onGallery && selected.length > 1 && (
        <button
          type="button"
          className="primary"
          onClick={() => {
            const values = insertionValues(items.filter((item) => selected.includes(item.id)));
            if (values) onGallery(values);
          }}
        >
          選択した画像をギャラリーへ
        </button>
      )}
      {items.map((media) => (
        <article className="media-card" key={media.id}>
          <label className="checkbox-label">
            <input
              type="checkbox"
              checked={selected.includes(media.id)}
              onChange={(event) =>
                setSelected(
                  event.target.checked
                    ? [...selected, media.id]
                    : selected.filter((id) => id !== media.id),
                )
              }
            />
            {media.originalName || media.assetId}
          </label>
          <Thumbnail media={media} />
          <label>
            代替テキスト
            <input
              ref={(input) => {
                if (input) altInputs.current.set(media.id, input);
                else altInputs.current.delete(media.id);
              }}
              defaultValue={media.alt ?? ""}
              placeholder="画像から伝えたい内容"
              required
              aria-invalid={invalidAlt === media.id || undefined}
              onChange={(event) => {
                if (invalidAlt === media.id && event.currentTarget.value.trim()) {
                  setInvalidAlt(null);
                  onError("");
                }
              }}
              onBlur={(event) => void presentation(media, { alt: event.target.value })}
            />
          </label>
          <label>
            キャプション
            <textarea
              ref={(input) => {
                if (input) captionInputs.current.set(media.id, input);
                else captionInputs.current.delete(media.id);
              }}
              rows={2}
              defaultValue={media.caption ?? ""}
              onBlur={(event) => void presentation(media, { caption: event.target.value })}
            />
          </label>
          <div>
            <strong>{media.assetId}</strong>
            <p>
              {format(media.originalBytes)} → {format(media.blob.size)}
            </p>
            <p className="muted small">
              {media.remoteId ? "非公開R2に同期済み" : "この端末のみ"} ·{" "}
              {media.kind === "animation" ? "動く画像" : "静止画"}
            </p>
          </div>
          <div className="media-actions">
            <button
              type="button"
              onClick={() => {
                const values = insertionValues([media]);
                const value = values?.[0];
                if (value) onInsert(value.asset, value.alt, value.caption);
              }}
            >
              本文に挿入
            </button>
            {onHero && (
              <button type="button" onClick={() => onHero(media.assetId)}>
                アイキャッチに設定
              </button>
            )}
            <button
              type="button"
              disabled={!authenticated || busy || Boolean(media.remoteId)}
              onClick={() => void sync(media)}
            >
              画像を同期
            </button>
            <button type="button" onClick={() => void remove(media)}>
              棄却
            </button>
          </div>
        </article>
      ))}
      {remoteSnapshot?.assets.some((item) => item.status === "rejected") && (
        <details>
          <summary>棄却した画像を復元</summary>
          {remoteSnapshot.assets
            .filter((item) => item.status === "rejected")
            .map((item) => (
              <p key={item.id}>
                {item.assetId}{" "}
                <button type="button" disabled={busy} onClick={() => void restoreRejected(item.id)}>
                  復元
                </button>
              </p>
            ))}
        </details>
      )}
      {quota && (
        <p className="muted">
          下書き容量 {format(quota.used + quota.reserved)} / {format(quota.limit)}
        </p>
      )}
    </section>
  );
}
