// Reserved private artifact markers/shapes are forbidden in public output.
export const privateDraftOutputErrors = (path:string,source=""): readonly string[] => {
  let privateShape=false;
  if(source.trimStart().startsWith("{")){
    try{
      const value=JSON.parse(source) as Record<string,unknown>;
      privateShape=Boolean(value && typeof value==="object" && (
        (value.mode==="draft"||value.mode==="content-review") && value.productionEligible===false
        || value.activeAttemptId && value.jobFingerprint
        || value.bodyArtifactSha256 && value.producer && value.draftId
        || value.attemptId && value.jobId && value.inputSha256
        || value.authorPrincipalId && Array.isArray(value.sources) && ["human_local","synthetic_fixture"].includes(String(value.scope))
        || value.bodySha256 && value.sourceBundleSha256 && Array.isArray(value.evidence) && Array.isArray(value.claims)
        || value.requestSha256 && value.reviewer && value.independence && Array.isArray(value.coveredClaimIds)
        || ["xpotato-example-verification-request-v1","xpotato-example-verification-request-bundle-v1","xpotato-example-verification-receipt-v1"].includes(String(value.protocol))
        || typeof value.protocol==="string"&&value.protocol.startsWith("xpotato-private-")
        || value.citationCompilationSha256 && value.bodySha256 && "examplesReady" in value
      ));
    }catch{/* Non-JSON artifacts are handled by their normal validator. */}
  }
  return /(?:^|[\\/])(?:\.local|article-jobs|\.private-draft-preview)(?:[\\/]|$)/iu.test(path)
    || (source.includes("xpotato-private-draft-preview-v1")||source.includes("article-private-review-journal-v1")||source.includes("mock-only-protected-")) || privateShape
      ? ["Private draft artifact is forbidden in public output"] : [];
};

/** The production Astro project never consumes private candidate inputs. */
export function assertNoPrivateCandidateEnvironment(environment:Readonly<Record<string,string|undefined>>){
  if(Object.keys(environment).some(key=>key.startsWith("XPOTATO_ARTICLE_CANDIDATE_")))throw new Error("PRIVATE_CANDIDATE_ENVIRONMENT_IN_NORMAL_BUILD");
}
