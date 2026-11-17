import { type GitRepository, downloadReviewArchive } from "@xpotato/editor-core/git";
import { documentHandoff } from "@xpotato/editor-core/draft";
import { APIError, type Session } from "../types.js";
import { json, readJsonBody as body, type RoutedRequest } from "../http.js";

interface GitRequest extends RoutedRequest {
  repository: GitRepository;
  current: Session;
}

export async function handleGitRoute({
  request,
  url,
  route,
  repository,
  current,
}: GitRequest): Promise<Response | null> {
  if (route === "/branches" && request.method === "GET") {
    return json(await repository.branches());
  }
  if (route === "/snapshot" && request.method === "GET") {
    return json(await repository.snapshot(url.searchParams.get("branch") ?? "main"));
  }
  const snapshot = {
    branch: url.searchParams.get("branch") ?? "main",
    commit: url.searchParams.get("commit") ?? "",
  };
  if (route === "/manifest" && request.method === "GET") {
    return json(await repository.manifest(snapshot));
  }
  if (route === "/documents" && request.method === "GET") {
    return json(await repository.documents(snapshot));
  }
  if (route === "/document" && request.method === "GET") {
    return json(await repository.read(snapshot, url.searchParams.get("path") ?? ""));
  }
  if (route === "/branch" && request.method === "POST") {
    const input = await body<{ source: { branch: string; commit: string }; target: string }>(
      request,
    );
    return json(await repository.createBranch(input.source, input.target), 201);
  }
  if (route === "/save" && request.method === "POST") {
    return json(await repository.save(await body<Parameters<GitRepository["save"]>[0]>(request)));
  }
  if (route === "/pull-request" && request.method === "POST") {
    return json(
      await repository.pullRequest(
        await body<Parameters<GitRepository["pullRequest"]>[0]>(request),
      ),
      201,
    );
  }
  if ((route === "/review" || route === "/review/archive") && request.method === "GET") {
    const result = await repository.reviewArtifact(
      snapshot.commit,
      url.searchParams.get("contentId") ?? "",
    );
    if (route === "/review") {
      return json(result);
    }
    if (!result.ready || !result.artifactId) {
      throw new APIError("EDITOR_REVIEW_NOT_READY", 409);
    }
    return downloadReviewArchive(current.token, repository.repository, result.artifactId);
  }
  if (route === "/checks" && request.method === "GET") {
    return json(await repository.checks(snapshot.commit));
  }
  if (route === "/handoff" && request.method === "POST") {
    const input = await body<{ snapshot: { branch: string; commit: string }; path: string }>(
        request,
      ),
      doc = await repository.read(input.snapshot, input.path);
    return json(documentHandoff(doc.source, doc.snapshot.commit, doc.path));
  }

  return null;
}
