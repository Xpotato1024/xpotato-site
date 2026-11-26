export type EditorUpdateCheck = "unsupported" | "current" | "ready" | "recovered";
export type EditorUpdateActivation = "applied" | "current";
type WorkerStatus = "current" | "installing" | "ready";

const workerScope = "/editor/";
const observedRegistrations = new WeakSet<ServiceWorkerRegistration>();
const failedInstallations = new WeakSet<ServiceWorkerRegistration>();
const updatePreparations = new Set<() => void | Promise<void>>();

export function registerEditorUpdatePreparation(prepare: () => void | Promise<void>) {
  updatePreparations.add(prepare);
  return () => { updatePreparations.delete(prepare); };
}

const installationFailure = () =>
  Error("アプリの準備に失敗しました。接続を確認してから、更新をもう一度確認してください。");

function notifyIfReady(registration: ServiceWorkerRegistration) {
  if (registration.waiting && navigator.serviceWorker.controller)
    window.dispatchEvent(new Event("editor-update-ready"));
}

function observeRegistration(registration: ServiceWorkerRegistration) {
  if (!observedRegistrations.has(registration)) {
    observedRegistrations.add(registration);
    const watchInstalling = () => {
      const worker = registration.installing;
      if (worker) failedInstallations.delete(registration);
      worker?.addEventListener("statechange", () => {
        if (worker.state === "installed") notifyIfReady(registration);
        if (worker.state === "redundant") failedInstallations.add(registration);
      });
    };
    registration.addEventListener("updatefound", watchInstalling);
    watchInstalling();
  }
  notifyIfReady(registration);
}
function statusOf(registration: ServiceWorkerRegistration): WorkerStatus {
  if (registration.waiting && navigator.serviceWorker.controller) return "ready";
  // update() raises InvalidStateError before the first worker exists.
  if (!registration.active || registration.active.state !== "activated" || registration.installing)
    return "installing";
  return "current";
}

async function settledStatus(
  registration: ServiceWorkerRegistration,
): Promise<Exclude<WorkerStatus, "installing">> {
  if (failedInstallations.has(registration)) throw installationFailure();
  const initial = statusOf(registration);
  if (initial !== "installing") return initial;
  return new Promise((resolve, reject) => {
    const watched = new Set<ServiceWorker>();
    const cleanup = () => {
      window.clearTimeout(timeout);
      registration.removeEventListener("updatefound", inspect);
      for (const worker of watched) worker.removeEventListener("statechange", inspect);
    };
    const inspect = () => {
      for (const worker of [
        registration.installing,
        registration.waiting,
        registration.active?.state === "activating" ? registration.active : null,
      ]) {
        if (!worker || watched.has(worker)) continue;
        watched.add(worker);
        worker.addEventListener("statechange", inspect);
      }
      if (
        failedInstallations.has(registration) ||
        [...watched].some((worker) => worker.state === "redundant")
      ) {
        cleanup();
        reject(installationFailure());
        return;
      }
      const status = statusOf(registration);
      if (status !== "installing") {
        cleanup();
        resolve(status);
      }
    };
    const timeout = window.setTimeout(() => {
      cleanup();
      reject(Error("アプリの準備が完了しませんでした。通信状態を確認してから、更新をもう一度確認してください。"));
    }, 15000);
    registration.addEventListener("updatefound", inspect);
    inspect();
  });
}

async function recoveredStatus(registration: ServiceWorkerRegistration): Promise<EditorUpdateCheck> {
  const status = await settledStatus(registration);
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
  failedInstallations.delete(registration);
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
  if (initial !== "current") return settledStatus(registration);
  try {
    failedInstallations.delete(registration);
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
  return settledStatus(latest);
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
  await Promise.all([...updatePreparations].map((prepare) => Promise.resolve().then(prepare)));
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
