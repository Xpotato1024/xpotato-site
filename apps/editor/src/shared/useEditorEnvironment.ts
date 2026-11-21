import { useEffect, useState } from "react";
import { activateEditorUpdate, checkEditorUpdate, registerEditorWorker } from "../pwa.js";
import { useEditorViewport } from "./useEditorViewport.js";

export function useEditorEnvironment() {
  useEditorViewport();
  const [online, setOnline] = useState(navigator.onLine);
  const [updateReady, setUpdateReady] = useState(false);

  useEffect(() => {
    // PWA registration must not block editing; the IndexedDB save path reports separately.
    void registerEditorWorker().catch(() => {});
    const network = () => setOnline(navigator.onLine);
    const update = () => setUpdateReady(true);
    const controllerChanged = () => setUpdateReady(false);
    navigator.serviceWorker?.addEventListener("controllerchange", controllerChanged);
    window.addEventListener("online", network);
    window.addEventListener("offline", network);
    window.addEventListener("editor-update-ready", update);
    return () => {
      window.removeEventListener("online", network);
      window.removeEventListener("offline", network);
      window.removeEventListener("editor-update-ready", update);
      navigator.serviceWorker?.removeEventListener("controllerchange", controllerChanged);
    };
  }, []);

  async function checkForUpdate() {
    const status = await checkEditorUpdate();
    setUpdateReady(status === "ready");
    return status;
  }

  async function activateUpdate(persist: () => Promise<void>) {
    const result = await activateEditorUpdate(persist);
    if (result === "current") setUpdateReady(false);
    return result;
  }

  return { online, updateReady, checkForUpdate, activateUpdate };
}
