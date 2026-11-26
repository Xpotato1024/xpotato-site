import { APIError, type Environment } from "./types.js";

export interface CLIPrincipal {
  userId: string;
  login: string;
  token: string;
  repository: string;
}

function record(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

/** CLI credentials stay in this request; they never become a browser session. */
export async function authenticateCLI(
  request: Request,
  env: Environment,
  fetcher: typeof fetch = fetch,
): Promise<CLIPrincipal> {
  if (request.headers.has("Cookie") || request.headers.has("Origin")) {
    throw new APIError("CLI_AUTH_CHANNEL_INVALID", 403);
  }
  const authorization = request.headers.get("Authorization") ?? "";
  const bearer = /^Bearer ([A-Za-z0-9._~+/-]+=*)$/iu.exec(authorization);
  if (!bearer || bearer[1]!.length > 4096) {
    throw new APIError("CLI_AUTH_REQUIRED", 401);
  }
  if (
    !/^[1-9][0-9]*$/u.test(env.OWNER_GITHUB_ID) ||
    !Number.isSafeInteger(Number(env.OWNER_GITHUB_ID)) ||
    !env.EDITOR_REPOSITORY ||
    !/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/u.test(env.EDITOR_REPOSITORY)
  ) {
    throw new APIError("CLI_AUTH_NOT_CONFIGURED", 503);
  }
  const token = bearer[1]!;
  const read = async (path: string): Promise<Record<string, unknown>> => {
    try {
      const response = await fetcher("https://api.github.com" + path, {
        headers: {
          Accept: "application/vnd.github+json",
          "User-Agent": "Xpotato-Editor-CLI",
          "X-GitHub-Api-Version": "2022-11-28",
          Authorization: "Bearer " + token,
        },
        redirect: "manual",
        signal: AbortSignal.timeout(15000),
      });
      if (response.status >= 300 && response.status < 400) {
        throw new APIError("CLI_AUTH_REDIRECT", 502);
      }
      if (response.status === 401 || response.status === 403) {
        throw new APIError("CLI_AUTH_REJECTED", 401);
      }
      if (!response.ok) {
        throw new APIError("CLI_AUTH_UNAVAILABLE", 503);
      }
      const value: unknown = await response.json();
      if (!record(value)) {
        throw new APIError("CLI_AUTH_UNAVAILABLE", 503);
      }
      return value;
    } catch (error) {
      if (error instanceof APIError) {
        throw error;
      }
      // Fetch and provider parsing errors can carry the Authorization value.
      throw new APIError("CLI_AUTH_UNAVAILABLE", 503);
    }
  };
  const user = await read("/user");
  if (
    typeof user.id !== "number" ||
    !Number.isSafeInteger(user.id) ||
    String(user.id) !== env.OWNER_GITHUB_ID ||
    typeof user.login !== "string" ||
    !/^[A-Za-z0-9-]{1,39}$/u.test(user.login)
  ) {
    throw new APIError("CLI_OWNER_ONLY", 403);
  }
  const repository = await read("/repos/" + env.EDITOR_REPOSITORY);
  if (
    repository.full_name !== env.EDITOR_REPOSITORY ||
    !record(repository.permissions) ||
    repository.permissions.push !== true
  ) {
    throw new APIError("CLI_REPOSITORY_FORBIDDEN", 403);
  }
  return {
    userId: String(user.id),
    login: user.login,
    token,
    repository: env.EDITOR_REPOSITORY,
  };
}
