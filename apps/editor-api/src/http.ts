import { APIError } from "./types.js";
import { limitedRequestBytes } from "./request-body.js";

export interface RoutedRequest {
  request: Request;
  url: URL;
  route: string;
}

export function json(value: unknown, status = 200) {
  return new Response(JSON.stringify(value), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
      "Referrer-Policy": "no-referrer",
    },
  });
}
export async function readJsonBody<T>(request: Request): Promise<T> {
  if (!request.headers.get("Content-Type")?.startsWith("application/json")) {
    throw new APIError("JSON_REQUIRED", 415);
  }
  const buffer = await limitedRequestBytes(request, 768 * 1024);
  try {
    return JSON.parse(new TextDecoder().decode(buffer)) as T;
  } catch {
    throw new APIError("JSON_INVALID");
  }
}
