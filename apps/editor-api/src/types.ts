export interface StoredObject {
  key: string;
  etag: string;
  size: number;
  httpMetadata?: { contentType?: string };
  body: ReadableStream<Uint8Array>;
  text(): Promise<string>;
  arrayBuffer(): Promise<ArrayBuffer>;
}
export interface ObjectBucket {
  get(key: string): Promise<StoredObject | null>;
  head(key: string): Promise<Pick<StoredObject, "key" | "etag" | "size" | "httpMetadata"> | null>;
  put(
    key: string,
    value: string | ArrayBuffer | Uint8Array | ReadableStream<Uint8Array>,
    options?: {
      onlyIf?: { etagMatches?: string; etagDoesNotMatch?: string };
      httpMetadata?: { contentType?: string; cacheControl?: string };
      customMetadata?: Record<string, string>;
      sha256?: string;
    },
  ): Promise<{ etag: string } | null>;
  delete(key: string | string[]): Promise<void>;
  list(options?: { prefix?: string; cursor?: string; limit?: number }): Promise<{
    objects: { key: string; size: number; uploaded: Date }[];
    truncated: boolean;
    cursor?: string;
  }>;
}
export interface Environment {
  DRAFT_MEDIA: ObjectBucket;
  GITHUB_CLIENT_ID: string;
  GITHUB_CLIENT_SECRET: string;
  SESSION_SECRET: string;
  OWNER_GITHUB_ID: string;
  EDITOR_ORIGIN: string;
  EDITOR_REPOSITORY?: string;
  GITHUB_WEBHOOK_SECRET?: string;
  GC_ENABLED?: string;
}
export interface Execution {
  waitUntil(promise: Promise<unknown>): void;
}
export interface Session {
  login: string;
  userId: string;
  token: string;
  csrf: string;
  issued: number;
  expires: number;
}
export class APIError extends Error {
  constructor(
    public readonly code: string,
    public readonly status = 400,
  ) {
    super(code);
    this.name = "APIError";
  }
}
