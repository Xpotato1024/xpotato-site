import { useEffect, useState } from "react";
import { request, type LoginState } from "../data/api.js";

interface Status {
  github: { state: "ready" | "unavailable"; repository?: string; commit?: string };
  media: {
    state: "ready" | "unavailable";
    quota?: { used: number; reserved: number; limit: number };
  };
  garbageCollectionEnabled: boolean;
}
export function ConnectionStatus({ auth }: { auth: LoginState }) {
  const [status, setStatus] = useState<Status | null>(null);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    if (!auth.authenticated) {
      setStatus(null);
      return;
    }
    let active = true;
    setBusy(true);
    setFailed(false);
    void request<Status>("/connection")
      .then((value) => {
        if (active) {
          setStatus(value);
        }
      })
      .catch(() => {
        if (active) {
          setStatus(null);
          setFailed(true);
        }
      })
      .finally(() => {
        if (active) {
          setBusy(false);
        }
      });
    return () => {
      active = false;
    };
  }, [auth.authenticated, revision]);
  if (!auth.authenticated) {
    return (
      <p className="muted small">
        {auth.configured
          ? "GitHubに接続すると、ブランチ保存と非公開画像同期を利用できます。"
          : "接続設定待ちです。端末内の編集・保存・書き出しは利用できます。"}
      </p>
    );
  }
  const label = (state?: "ready" | "unavailable") => {
    if (busy) {
      return "確認中";
    }
    if (failed || state === "unavailable") {
      return "確認できません";
    }
    return state === "ready" ? "接続済み" : "確認中";
  };
  const quota = status?.media.quota;
  return (
    <section className="connection-status" aria-label="接続状態">
      <div>
        <strong>GitHub: {label(status?.github.state)}</strong>
        <span>非公開画像: {label(status?.media.state)}</span>
      </div>
      {quota && (
        <p className="small muted">
          下書き画像 {((quota.used + quota.reserved) / 1_000_000).toFixed(1)} MB /{" "}
          {(quota.limit / 1_000_000_000).toFixed(1)} GB
        </p>
      )}
      {failed && <p role="status">接続状態を取得できませんでした。原稿は端末に保持しています。</p>}
      <button type="button" disabled={busy} onClick={() => setRevision((value) => value + 1)}>
        接続を再確認
      </button>
    </section>
  );
}
