import { afterEach, describe, expect, it, vi } from "vitest";
import { activateEditorUpdate, checkEditorUpdate, registerEditorWorker } from "./pwa.js";

type WorkerMock = {
  state: string;
  postMessage: ReturnType<typeof vi.fn>;
  addEventListener: ReturnType<typeof vi.fn>;
};
function makeWorker(): WorkerMock {
  return { state: "installing", postMessage: vi.fn(), addEventListener: vi.fn() };
}

function setup() {
  const updateEvents: Array<() => void> = [];
  const serviceEvents: Array<() => void> = [];
  const registration = {
    waiting: null as WorkerMock | null,
    installing: null as WorkerMock | null,
    addEventListener: vi.fn((type: string, callback: () => void) => {
      if (type === "updatefound") updateEvents.push(callback);
    }),
    update: vi.fn(async () => {}),
  };
  const serviceWorker = {
    controller: {} as object | null,
    register: vi.fn(async () => registration),
    getRegistration: vi.fn(async () => registration),
    addEventListener: vi.fn((type: string, callback: () => void) => {
      if (type === "controllerchange") serviceEvents.push(callback);
    }),
    removeEventListener: vi.fn((type: string, callback: () => void) => {
      if (type === "controllerchange") {
        const i = serviceEvents.indexOf(callback);
        if (i !== -1) serviceEvents.splice(i, 1);
      }
    }),
  };
  const reload = vi.fn();
  const dispatchEvent = vi.fn();
  vi.stubGlobal("navigator", { serviceWorker, onLine: true });
  vi.stubGlobal("window", {
    isSecureContext: true,
    dispatchEvent,
    setTimeout: globalThis.setTimeout,
    clearTimeout: globalThis.clearTimeout,
    location: { reload },
  });
  return { registration, serviceWorker, reload, dispatchEvent, updateEvents, serviceEvents };
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("manual editor PWA update", () => {
  it("registers the same protected scope without reusing cached SW script", async () => {
    const { serviceWorker, registration } = setup();
    expect(await registerEditorWorker()).toBe(registration);
    expect(serviceWorker.register).toHaveBeenCalledWith("/editor/sw.js", {
      scope: "/editor/",
      updateViaCache: "none",
    });
  });

  it("actively checks for a new worker and reports current only when no installation is pending", async () => {
    const { registration } = setup();
    expect(await checkEditorUpdate()).toBe("current");
    expect(registration.update).toHaveBeenCalledOnce();
  });

  it("reports an already-waiting update without redundantly checking the network", async () => {
    const { registration, dispatchEvent } = setup();
    registration.waiting = makeWorker();
    expect(await checkEditorUpdate()).toBe("ready");
    expect(registration.update).not.toHaveBeenCalled();
    expect(dispatchEvent).toHaveBeenCalledWith(
      expect.objectContaining({ type: "editor-update-ready" }),
    );
  });

  it("does not mistake an installing worker for the latest installed app", async () => {
    const { registration, updateEvents, dispatchEvent } = setup();
    const worker = makeWorker();
    const changeCallbacks: Array<() => void> = [];
    worker.addEventListener.mockImplementation((type: string, callback: () => void) => {
      if (type === "statechange") changeCallbacks.push(callback);
    });
    registration.update.mockImplementation(async () => {
      registration.installing = worker;
      for (const callback of updateEvents) callback();
    });
    expect(await checkEditorUpdate()).toBe("installing");
    registration.waiting = worker;
    worker.state = "installed";
    for (const callback of changeCallbacks) callback();
    expect(dispatchEvent).toHaveBeenCalledWith(
      expect.objectContaining({ type: "editor-update-ready" }),
    );
  });

  it("refuses offline checking and unsupported contexts without claiming 'current'", async () => {
    const { registration } = setup();
    vi.stubGlobal("navigator", { onLine: false, serviceWorker: { register: vi.fn() } });
    await expect(checkEditorUpdate()).rejects.toThrow("オフライン");
    expect(registration.update).not.toHaveBeenCalled();
    vi.stubGlobal("navigator", { onLine: true });
    expect(await checkEditorUpdate()).toBe("unsupported");
  });

  it("persists the draft before asking the waiting worker to activate, then reloads on matching controller", async () => {
    const { registration, serviceWorker, reload, serviceEvents } = setup();
    const order: string[] = [];
    const worker = makeWorker();
    registration.waiting = worker;
    const persist = vi.fn(async () => {
      order.push("persist");
    });
    worker.postMessage.mockImplementation(() => {
      order.push("activate");
      expect(serviceEvents.length).toBe(1);
      serviceWorker.controller = worker;
      for (const callback of [...serviceEvents]) callback();
    });
    reload.mockImplementation(() => order.push("reload"));
    await activateEditorUpdate(persist);
    expect(order).toEqual(["persist", "activate", "reload"]);
    expect(worker.postMessage).toHaveBeenCalledWith({ type: "ACTIVATE" });
    expect(serviceEvents).toHaveLength(0);
  });

  it("will not activate or reload when draft persistence fails", async () => {
    const { registration, reload } = setup();
    const worker = makeWorker();
    registration.waiting = worker;
    await expect(
      activateEditorUpdate(async () => {
        throw Error("IndexedDB failed");
      }),
    ).rejects.toThrow("IndexedDB failed");
    expect(worker.postMessage).not.toHaveBeenCalled();
    expect(reload).not.toHaveBeenCalled();
  });

  it("will not save, activate or reload if no waiting version exists", async () => {
    const { reload } = setup();
    const persist = vi.fn(async () => {});
    await expect(activateEditorUpdate(persist)).rejects.toThrow("適用できる更新");
    expect(persist).not.toHaveBeenCalled();
    expect(reload).not.toHaveBeenCalled();
  });

  it("will not reload for a different controllerchange", async () => {
    const { registration, serviceWorker, reload, serviceEvents } = setup();
    const worker = makeWorker();
    registration.waiting = worker;
    worker.postMessage.mockImplementation(() => {
      for (const callback of [...serviceEvents]) callback();
      expect(reload).not.toHaveBeenCalled();
      serviceWorker.controller = worker;
      for (const callback of [...serviceEvents]) callback();
    });
    await activateEditorUpdate(async () => {});
    expect(reload).toHaveBeenCalledOnce();
  });
});
