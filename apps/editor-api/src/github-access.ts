import { APIError, type Environment } from "./types.js";

export const editorGitHubPermissions = Object.freeze({
  contents: "write",
  pull_requests: "write",
  actions: "read",
  checks: "read",
  metadata: "read",
});

interface Installation {
  id: number;
  app_id: number;
  account: { id: number };
  repository_selection: string;
  suspended_at: string | null;
  permissions: Record<string, string>;
}

export async function verifyGitHubInstallation(
  token: string,
  env: Environment,
  fetcher: typeof fetch = fetch,
): Promise<number> {
  const read = async <T>(path: string): Promise<T> => {
    const response = await fetcher("https://api.github.com" + path, {
      headers: {
        Accept: "application/vnd.github+json",
        "User-Agent": "Xpotato-Editor",
        "X-GitHub-Api-Version": "2022-11-28",
        Authorization: "Bearer " + token,
      },
      redirect: "error",
      signal: AbortSignal.timeout(15000),
    });
    if (!response.ok) {
      throw new APIError("GITHUB_INSTALLATION_UNAVAILABLE", 403);
    }
    return (await response.json()) as T;
  };
  const listed = await read<{ total_count: number; installations: Installation[] }>(
    "/user/installations?per_page=100",
  );
  if (!Array.isArray(listed.installations) || listed.total_count !== listed.installations.length) {
    throw new APIError("GITHUB_INSTALLATION_UNAVAILABLE", 403);
  }
  const matching = listed.installations.filter(
    (item) =>
      String(item.app_id) === env.GITHUB_APP_ID && String(item.account.id) === env.OWNER_GITHUB_ID,
  );
  if (matching.length !== 1) {
    throw new APIError("GITHUB_INSTALLATION_REQUIRED", 403);
  }
  const installed = matching[0]!;
  // 所有者本人のtokenでも、全repositoryへのinstallをこのCMSの正常設定とは扱わない。
  if (installed.repository_selection !== "selected" || installed.suspended_at !== null) {
    throw new APIError("GITHUB_INSTALLATION_SCOPE", 403);
  }
  const permissions = installed.permissions;
  if (
    Object.keys(permissions).length !== Object.keys(editorGitHubPermissions).length ||
    Object.entries(editorGitHubPermissions).some(([key, value]) => permissions[key] !== value)
  ) {
    throw new APIError("GITHUB_INSTALLATION_PERMISSIONS", 403);
  }
  const repositories = await read<{ total_count: number; repositories: { full_name: string }[] }>(
    "/user/installations/" + installed.id + "/repositories?per_page=100",
  );
  if (
    repositories.total_count !== 1 ||
    repositories.repositories?.length !== 1 ||
    repositories.repositories[0]!.full_name !== env.EDITOR_REPOSITORY
  ) {
    throw new APIError("GITHUB_INSTALLATION_SCOPE", 403);
  }
  return installed.id;
}
