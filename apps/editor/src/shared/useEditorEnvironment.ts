import { useEffect, useState } from "react";
import { registerEditorWorker } from "../pwa.js";

export function useEditorEnvironment() {
  const [online, setOnline] = useState(navigator.onLine);
  const [updateReady, setUpdateReady] = useState(false);

  useEffect(() => {
    // PWA登録の失敗で執筆を止めない。保存成否はIndexedDB側で別に通知する。
    void registerEditorWorker().catch(() => {});
    const network = () => setOnline(navigator.onLine);
    const update = () => setUpdateReady(true);
    window.addEventListener("online", network);
    window.addEventListener("offline", network);
    window.addEventListener("editor-update-ready", update);
    return () => {
      window.removeEventListener("online", network);
      window.removeEventListener("offline", network);
      window.removeEventListener("editor-update-ready", update);
    };
  }, []);

  async function activateUpdate(persist: () => Promise<void>) {
    // 更新によるreloadより先に、編集中の本文を耐久保存する。
    await persist();
    const registration = await navigator.serviceWorker.getRegistration("/editor/");
    registration?.waiting?.postMessage({ type: "ACTIVATE" });
    navigator.serviceWorker.addEventListener("controllerchange", () => location.reload(), {
      once: true,
    });
  }

  return { online, updateReady, activateUpdate };
}
