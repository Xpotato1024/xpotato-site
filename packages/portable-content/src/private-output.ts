// Reserved private artifact markers/shapes are forbidden in public output.
export const privateDraftOutputErrors = (path:string,source=""): readonly string[] => {
  let privateShape=false;
  if(source.trimStart().startsWith("{")){
    try{
      const value=JSON.parse(source) as Record<string,unknown>;
      privateShape=Boolean(value && typeof value==="object" && (
        value.mode==="draft" && value.productionEligible===false
        || value.activeAttemptId && value.jobFingerprint
        || value.bodyArtifactSha256 && value.producer && value.draftId
        || value.attemptId && value.jobId && value.inputSha256
      ));
    }catch{/* Non-JSON artifacts are handled by their normal validator. */}
  }
  return /(?:^|[\\/])(?:\.local|article-jobs|\.private-draft-preview)(?:[\\/]|$)/iu.test(path)
    || source.includes("xpotato-private-draft-preview-v1") || privateShape
      ? ["Private draft artifact is forbidden in public output"] : [];
};
