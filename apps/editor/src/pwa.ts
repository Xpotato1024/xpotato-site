export type EditorUpdateCheck = "unsupported" | "current" | "installing" | "ready" | "recovered";
export type EditorUpdateActivation = "applied" | "current";

const workerScope = "/editor/";
const observedRegistrations = new WeakSet<ServiceWorkerRegistration>();

function notifyIfReady(registration: ServiceWorkerRegistration) {
  if (registration.waiting && navigator.serviceWorker.controller)
    window.dispatchEvent(new Event("editor-update-ready"));
}

function observeRegistration(registration: ServiceWorkerRegistration) {
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
}
function statusOf(registration: ServiceWorkerRegistration): EditorUpdateCheck {
  if (registration.waiting && navigator.serviceWorker.controller) return "ready";
  // update() raises InvalidStateError before the first worker exists.
  if (!registration.active || registration.active.state !== "activated" || registration.installing)
    return "installing";
  return "current";
}

function recoveredStatus(registration: ServiceWorkerRegistration): EditorUpdateCheck {
  const status = statusOf(registration);
  // The registration was repaired but no successful update check took place.
  return status === "current" ? "recovered" : status;
}

function missingWorker(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const value = error as { name?: unknown; message?: unknown };
  return (
    value.name === "InvalidStateError" ||
    (typeof value.message === "string" &&
      /null\/nonexistent service worker registration|no newest worker/iu.test(value.message))
  );
}

export async function registerEditorWorker(): Promise<ServiceWorkerRegistration | null> {
  if (!("serviceWorker" in navigator) || !window.isSecureContext) return null;
  const registration = await navigator.serviceWorker.register("/editor/sw.js", {
    scope: workerScope,
    updateViaCache: "none",
  });
  observeRegistration(registration);
  return registration;
}
async function recoverRegistration(forceRegister = false): Promise<EditorUpdateCheck> {
  const registration = forceRegister
    ? await registerEditorWorker()
    : ((await navigator.serviceWorker.getRegistration(workerScope)) ??
      (await registerEditorWorker()));
  if (!registration) return "unsupported";
  observeRegistration(registration);
  return recoveredStatus(registration);
}

export async function checkEditorUpdate(): Promise<EditorUpdateCheck> {
  if (!("serviceWorker" in navigator) || !window.isSecureContext) return "unsupported";
  if (!navigator.onLine) throw Error("オフラインのためアプリの更新を確認できません。");
  const registration = await navigator.serviceWorker.getRegistration(workerScope);
  if (!registration) return recoverRegistration();
  observeRegistration(registration);
  if (!registration.active && !registration.installing && !registration.waiting) {
    const replacement = await registerEditorWorker();
    return replacement ? recoveredStatus(replacement) : "unsupported";
  }
  const initial = statusOf(registration);
  if (initial !== "current") return initial;
  try {
    await registration.update();
  } catch (error) {
    // iOS can invalidate an SW registration between getRegistration() and
    // update(). This race is not an application update failure.
    if (!missingWorker(error)) throw error;
    // Re-register once instead of reusing the registration whose update failed.
    // Do not immediately call update() again on the potentially transient handle.
    return recoverRegistration(true);
  }
  const latest = await navigator.serviceWorker.getRegistration(workerScope);
  if (!latest) return recoverRegistration();
  observeRegistration(latest);
  return statusOf(latest);
}

export async function activateEditorUpdate(
  persist: () => Promise<void>,
): Promise<EditorUpdateActivation> {
  if (!("serviceWorker" in navigator)) throw Error("PWAの更新機能を利用できません。");
  const registration = await navigator.serviceWorker.getRegistration(workerScope);
  const waiting = registration?.waiting;
  // A new worker can activate itself when the previous PWA session closes.
  if (!registration || !waiting) return "current";

  // Never replace an editor session before the current draft is durable.
  await persist();
  if (registration.waiting !== waiting) return "current";

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
    navigator.serviceWorker.addEventListener("controllerchange", controllerChanged);
    try {
      waiting.postMessage({ type: "ACTIVATE" });
    } catch (error) {
      cleanup();
      reject(error);
    }
  });
  return "applied";
}
