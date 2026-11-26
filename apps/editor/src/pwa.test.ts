import { afterEach, describe, expect, it, vi } from "vitest";
import { activateEditorUpdate, checkEditorUpdate, registerEditorWorker } from "./pwa.js";

type WorkerMock = {
  state: string;
  postMessage: ReturnType<typeof vi.fn>;
  addEventListener: ReturnType<typeof vi.fn>;
  removeEventListener: ReturnType<typeof vi.fn>;
  changeState: (state: string) => void;
};
function makeWorker(state = "installing"): WorkerMock {
  const callbacks = new Set<() => void>();
  const worker = {
    state,
    postMessage: vi.fn(),
    addEventListener: vi.fn((type: string, callback: () => void) => {
      if (type === "statechange") callbacks.add(callback);
    }),
    removeEventListener: vi.fn((type: string, callback: () => void) => {
      if (type === "statechange") callbacks.delete(callback);
    }),
    changeState: (next: string) => {
      worker.state = next;
      for (const callback of [...callbacks]) callback();
    },
  };
  return worker;
}

function setup() {
  const updateEvents: Array<() => void> = [];
  const serviceEvents: Array<() => void> = [];
  const registration = {
    waiting: null as WorkerMock | null,
    installing: null as WorkerMock | null,
    active: makeWorker("activated") as WorkerMock | null,
    addEventListener: vi.fn((type: string, callback: () => void) => {
      if (type === "updatefound") updateEvents.push(callback);
    }),
    removeEventListener: vi.fn((type: string, callback: () => void) => {
      if (type === "updatefound") {
        const i = updateEvents.indexOf(callback);
        if (i !== -1) updateEvents.splice(i, 1);
      }
    }),
    update: vi.fn(async () => {}),
  };
  const serviceWorker = {
    controller: {} as object | null,
    register: vi.fn(async () => registration),
    getRegistration: vi.fn(async (): Promise<typeof registration | null> => registration),
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
  vi.useRealTimers();
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

  it("waits for an installing update and reports ready when the shell finishes", async () => {
    const { registration, updateEvents, dispatchEvent } = setup();
    const worker = makeWorker();
    registration.update.mockImplementation(async () => {
      registration.installing = worker;
      for (const callback of updateEvents) callback();
    });
    const checking = checkEditorUpdate();
    await vi.waitFor(() => expect(worker.addEventListener).toHaveBeenCalled());
    registration.waiting = worker;
    registration.installing = null;
    worker.changeState("installed");
    expect(await checking).toBe("ready");
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
    expect(await activateEditorUpdate(persist)).toBe("applied");
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
    await expect(activateEditorUpdate(persist)).resolves.toBe("current");
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

describe("registration lifecycle recovery", () => {
  it("waits for the first worker to activate without calling update() on an incomplete registration", async () => {
    const { registration } = setup();
    registration.active = null;
    const worker = makeWorker();
    registration.installing = worker;
    const checking = checkEditorUpdate();
    await vi.waitFor(() => expect(worker.addEventListener).toHaveBeenCalled());
    expect(registration.update).not.toHaveBeenCalled();
    registration.installing = null;
    registration.active = worker;
    worker.changeState("activated");
    expect(await checking).toBe("current");
  });

  it("repairs an empty registration before attempting to update it", async () => {
    const { registration, serviceWorker } = setup();
    registration.active = null;
    serviceWorker.register.mockImplementation(async () => {
      registration.active = makeWorker("activated");
      return registration;
    });
    expect(await checkEditorUpdate()).toBe("recovered");
    expect(serviceWorker.register).toHaveBeenCalledOnce();
    expect(registration.update).not.toHaveBeenCalled();
  });

  it("registers a new worker when no registration exists", async () => {
    const { registration, serviceWorker } = setup();
    serviceWorker.getRegistration.mockResolvedValue(null);
    registration.active = null;
    const worker = makeWorker();
    registration.installing = worker;
    const checking = checkEditorUpdate();
    await vi.waitFor(() => expect(worker.addEventListener).toHaveBeenCalled());
    registration.installing = null;
    registration.active = worker;
    worker.changeState("activated");
    expect(await checking).toBe("recovered");
    expect(serviceWorker.register).toHaveBeenCalledOnce();
  });
  it("recovers the exact WebKit error without reporting a false success", async () => {
    const { registration, serviceWorker } = setup();
    registration.update.mockRejectedValue(
      new Error("Cannot update a null/nonexistent service worker registration"),
    );
    expect(await checkEditorUpdate()).toBe("recovered");
    expect(serviceWorker.register).toHaveBeenCalledOnce();
  });

  it("registers again when an InvalidStateError races with unregistration", async () => {
    const { registration, serviceWorker } = setup();
    const error = Object.assign(new Error("Registration was removed"), {
      name: "InvalidStateError",
    });
    registration.update.mockRejectedValue(error);
    serviceWorker.getRegistration.mockResolvedValueOnce(registration).mockResolvedValueOnce(null);
    const worker = makeWorker();
    const replacement = { ...registration, active: null as WorkerMock | null, installing: worker as WorkerMock | null };
    serviceWorker.register.mockResolvedValueOnce(replacement);
    const checking = checkEditorUpdate();
    await vi.waitFor(() => expect(worker.addEventListener).toHaveBeenCalled());
    replacement.installing = null;
    replacement.active = worker;
    worker.changeState("activated");
    expect(await checking).toBe("recovered");
    expect(serviceWorker.register).toHaveBeenCalledOnce();
  });
  it("still reports genuine network update errors", async () => {
    const { registration } = setup();
    registration.update.mockRejectedValue(new TypeError("Failed to fetch /editor/sw.js"));
    await expect(checkEditorUpdate()).rejects.toThrow("Failed to fetch");
  });

  it("reports a failed installation instead of claiming that the older active app is current", async () => {
    const { registration, updateEvents } = setup();
    const worker = makeWorker();
    registration.update.mockImplementation(async () => {
      registration.installing = worker;
      for (const callback of [...updateEvents]) callback();
      registration.installing = null;
      worker.changeState("redundant");
    });
    await expect(checkEditorUpdate()).rejects.toThrow("アプリの準備に失敗しました");
    registration.update.mockImplementation(async () => {});
    expect(await checkEditorUpdate()).toBe("current");
  });

  it("reports a stalled installation after a bounded wait and removes its listeners", async () => {
    vi.useFakeTimers();
    const { registration } = setup();
    registration.active = null;
    const worker = makeWorker();
    registration.installing = worker;
    const checking = expect(checkEditorUpdate()).rejects.toThrow("アプリの準備が完了しませんでした");
    await vi.advanceTimersByTimeAsync(15000);
    await checking;
    expect(registration.removeEventListener).toHaveBeenCalledWith("updatefound", expect.any(Function));
    expect(worker.removeEventListener).toHaveBeenCalledWith("statechange", expect.any(Function));
  });

  it("handles a waiting worker that auto-activated before the user tapped", async () => {
    const { registration, reload } = setup();
    const persist = vi.fn(async () => {});
    expect(await activateEditorUpdate(persist)).toBe("current");
    expect(persist).not.toHaveBeenCalled();
    expect(reload).not.toHaveBeenCalled();
    registration.waiting = makeWorker();
    expect(
      await activateEditorUpdate(async () => {
        registration.waiting = null;
      }),
    ).toBe("current");
    expect(reload).not.toHaveBeenCalled();
  });
});
