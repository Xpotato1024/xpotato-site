export type EditorUpdateCheck = "unsupported" | "current" | "installing" | "ready";

const observedRegistrations = new WeakSet<ServiceWorkerRegistration>();

function notifyIfReady(registration: ServiceWorkerRegistration) {
  if (registration.waiting && navigator.serviceWorker.controller)
    window.dispatchEvent(new Event("editor-update-ready"));
}

export async function registerEditorWorker(): Promise<ServiceWorkerRegistration | null> {
  if (!("serviceWorker" in navigator) || !window.isSecureContext) return null;
  const registration = await navigator.serviceWorker.register("/editor/sw.js", {
    scope: "/editor/",
    updateViaCache: "none",
  });
  if (!observedRegistrations.has(registration)) {
    observedRegistrations.add(registration);
    const watchInstalling = () => {
      const worker = registration.installing;
      worker?.addEventListener("statechange", () => {
        if (worker.state === "installed") notifyIfReady(registration);
      });
    };
    registration.addEventListener("updatefound", watchInstalling);
    watchInstalling();
  }
  notifyIfReady(registration);
  return registration;
}

export async function checkEditorUpdate(): Promise<EditorUpdateCheck> {
  if (!("serviceWorker" in navigator) || !window.isSecureContext) return "unsupported";
  if (!navigator.onLine) throw Error("オフラインのためアプリの更新を確認できません。");
  const registration = await registerEditorWorker();
  if (!registration) return "unsupported";
  if (registration.waiting) return "ready";
  await registration.update();
  if (registration.waiting) return "ready";
  return registration.installing ? "installing" : "current";
}

export async function activateEditorUpdate(persist: () => Promise<void>): Promise<void> {
  if (!("serviceWorker" in navigator)) throw Error("PWAの更新機能を利用できません。");
  const registration = await navigator.serviceWorker.getRegistration("/editor/");
  const waiting = registration?.waiting;
  if (!waiting) throw Error("適用できる更新がありません。先に更新を確認してください。");

  // Never replace an editor session before the current draft is durable.
  await persist();
  if (registration.waiting !== waiting)
    throw Error("更新状態が変わりました。もう一度更新を確認してください。");

  await new Promise<void>((resolve, reject) => {
    const controllerChanged = () => {
      if (navigator.serviceWorker.controller !== waiting) return;
      cleanup();
      window.location.reload();
      resolve();
    };
    const timeout = window.setTimeout(() => {
      cleanup();
      reject(Error("更新の適用を確認できませんでした。原稿は保存済みです。"));
    }, 15000);
    const cleanup = () => {
      window.clearTimeout(timeout);
      navigator.serviceWorker.removeEventListener("controllerchange", controllerChanged);
    };
    // Attach before ACTIVATE, so a prompt activation cannot beat the listener.
    navigator.serviceWorker.addEventListener("controllerchange", controllerChanged);
    try {
      waiting.postMessage({ type: "ACTIVATE" });
    } catch (error) {
      cleanup();
      reject(error);
    }
  });
}
