import type { GitRepository } from "@xpotato/editor-core/git";
import { quotaState } from "@xpotato/editor-core/policy";
import { DraftStore } from "./state.js";
import type { Environment } from "./types.js";

export async function connectionStatus(env: Environment, repository: GitRepository) {
  const [git, media] = await Promise.allSettled([
    repository.snapshot("main").then(async (snapshot) => {
      await repository.manifest(snapshot);
      return { state: "ready" as const, repository: repository.repository, ...snapshot };
    }),
    (async () => {
      if (!env.DRAFT_MEDIA) throw new Error("DRAFT_STORAGE_NOT_CONFIGURED");
      const store = new DraftStore(env.DRAFT_MEDIA);
      const { state } = await store.read();
      return { state: "ready" as const, quota: quotaState(state.usedBytes, store.reserved(state)) };
    })(),
  ]);
  // 読取りの成功だけを示す。R2書込み、Git保存、本人による公開承認の証明にはしない。
  return {
    github: git.status === "fulfilled" ? git.value : { state: "unavailable" as const },
    media: media.status === "fulfilled" ? media.value : { state: "unavailable" as const },
    garbageCollectionEnabled: env.GC_ENABLED === "true",
  };
}
