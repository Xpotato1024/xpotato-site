export interface LoginState {
  authenticated: boolean;
  configured: boolean;
  user?: string;
  csrf?: string;
  expires?: number;
  repository: string;
}
export class EditorApiError extends Error {
  constructor(
    readonly code: string,
    readonly status: number,
  ) {
    super(code);
  }
}
let csrf = "";
export async function request<T>(
  route: string,
  options: { method?: string; body?: unknown; blob?: Blob } = {},
): Promise<T> {
  const method = options.method ?? "GET";
  const response = await fetch("/editor-api" + route, {
    method,
    credentials: "same-origin",
    cache: "no-store",
    headers: {
      ...(options.body === undefined ? {} : { "Content-Type": "application/json" }),
      ...(method === "GET" ? {} : { "X-CSRF-Token": csrf }),
    },
    ...(options.blob
      ? { body: options.blob }
      : options.body === undefined
        ? {}
        : { body: JSON.stringify(options.body) }),
  });
  if (response.status === 204) return undefined as T;
  let data: unknown;
  try {
    data = await response.json();
  } catch {
    throw new EditorApiError("API_NOT_AVAILABLE", 503);
  }
  if (!response.ok)
    throw new EditorApiError(
      (data as { error?: string }).error ?? "REQUEST_FAILED",
      response.status,
    );
  return data as T;
}
export async function loginState(): Promise<LoginState> {
  try {
    const state = await request<LoginState>("/session");
    csrf = state.csrf ?? "";
    return state;
  } catch {
    return { authenticated: false, configured: false, repository: "Xpotato1024/xpotato-site" };
  }
}
export const query = (values: Record<string, string>) =>
  "?" + new URLSearchParams(values).toString();
export const mediaUrl = (id: string) => "/editor-api/media/" + encodeURIComponent(id);
export async function fetchPrivateMedia(id: string): Promise<Blob> {
  const response = await fetch(mediaUrl(id), { credentials: "same-origin", cache: "no-store" });
  if (!response.ok) throw new EditorApiError("MEDIA_LOAD_FAILED", response.status);
  return response.blob();
}
