import { useEffect, useRef, useState } from "react";
import {
  prepareMediaHandoff,
  registerMediaHandoff,
  type PreparedMediaHandoff,
} from "../data/media-handoff.js";
import type { LocalDraft } from "../data/storage.js";

interface Props {
  draft: LocalDraft;
  authenticated: boolean;
  busy: boolean;
  onBusy: (busy: boolean) => void;
  onDraft: (draft: LocalDraft) => void;
  onImported: () => Promise<void>;
  onError: (message: string) => void;
}

export function mediaHandoffMessage(error: unknown): string {
  const code = error instanceof Error ? error.message : "";
  if (code === "MEDIA_HANDOFF_LOGIN_REQUIRED") {
    return "GitHubに接続してから、画像を登録してください。";
  }
  if (/CONFLICT|AMBIGUOUS/u.test(code)) {
    return "端末または別の端末で画像が変更されています。画像を取得して確認してください。登録できた画像は保持しています。";
  }
  if (/CHANGED|MISMATCH|STALE|IDENTITY/u.test(code)) {
    return "画像ファイルと現在の原稿・ブランチ・版が一致しません。原稿を保存・取得し、その版に対応する画像ファイルを使ってください。";
  }
  if (/READBACK/u.test(code)) {
    return "保存した画像を確認できませんでした。同じファイルで再実行すると、確認できた画像から再開します。";
  }
  return "画像を登録できませんでした。ファイルと接続を確認してください。登録できた画像は保持しています。";
}

export function MediaHandoffPanel({
  draft,
  authenticated,
  busy,
  onBusy,
  onDraft,
  onImported,
  onError,
}: Props) {
  const [prepared, setPrepared] = useState<PreparedMediaHandoff | null>(null);
  const [message, setMessage] = useState("");
  const current = useRef({ draft, authenticated });
  current.current = { draft, authenticated };
  const mounted = useRef(true);
  const running = useRef(false);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  useEffect(() => {
    setPrepared(null);
    setMessage("");
  }, [draft.id, draft.source, draft.workingBranch, draft.baseCommit, draft.path]);

  function assertCurrent(started: LocalDraft) {
    const active = current.current;
    if (
      !mounted.current ||
      !active.authenticated ||
      active.draft.id !== started.id ||
      active.draft.source !== started.source ||
      active.draft.path !== started.path ||
      active.draft.workingBranch !== started.workingBranch ||
      active.draft.baseCommit !== started.baseCommit
    ) {
      throw Error("MEDIA_HANDOFF_DRAFT_CHANGED");
    }
  }

  async function select(file: File | undefined) {
    if (!file || busy || running.current) return;
    const started = draft;
    running.current = true;
    onBusy(true);
    setPrepared(null);
    setMessage("画像ファイルを確認しています…");
    try {
      assertCurrent(started);
      const result = await prepareMediaHandoff(file, started);
      assertCurrent(started);
      setPrepared(result);
      setMessage(result.media.length + "点の画像を確認しました。");
      onError("");
    } catch (error) {
      if (mounted.current && current.current.draft.id === started.id) {
        setMessage("");
        onError(mediaHandoffMessage(error));
      }
    } finally {
      running.current = false;
      if (mounted.current) onBusy(false);
    }
  }

  async function register() {
    if (!prepared || busy || running.current) return;
    const started = draft;
    running.current = true;
    onBusy(true);
    setMessage("下書きへ画像を登録しています…");
    try {
      const result = await registerMediaHandoff(started, prepared, {
        assertCurrent: () => assertCurrent(started),
        onProgress: (completed, total) => {
          if (mounted.current) setMessage(`${completed} / ${total}点の保存を確認しました。`);
        },
      });
      assertCurrent(started);
      onDraft(result.draft);
      await onImported();
      assertCurrent(started);
      setPrepared(null);
      setMessage(
        `${result.registered + result.reused}点の画像を下書きに登録しました。別の端末でも同じ原稿から復元できます。`,
      );
      onError("");
    } catch (error) {
      if (mounted.current && current.current.draft.id === started.id) {
        setMessage("");
        onError(mediaHandoffMessage(error));
      }
    } finally {
      running.current = false;
      if (mounted.current) onBusy(false);
    }
  }

  const available = authenticated && Boolean(draft.workingBranch && draft.baseCommit);
  return (
    <details className="media-handoff">
      <summary>AI原稿の画像をまとめて登録</summary>
      <p className="muted small">
        AIが用意した画像ファイルを選びます。現在の原稿・作業ブランチと照合し、本文の画像IDを保って非公開の下書きへ保存します。
      </p>
      <label>
        原稿の画像ファイル
        <input
          type="file"
          accept=".json,application/json"
          disabled={!available || busy}
          onChange={(event) => {
            const file = event.target.files?.[0];
            event.target.value = "";
            void select(file);
          }}
        />
      </label>
      {prepared && (
        <>
          <p className="muted small">{prepared.media.map((item) => item.assetId).join("、")}</p>
          <button type="button" disabled={!available || busy} onClick={() => void register()}>
            下書きに画像を登録
          </button>
        </>
      )}
      {message && <p role="status">{message}</p>}
    </details>
  );
}
