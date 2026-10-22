import {readFile} from "node:fs/promises";
import {browserToolPinSchema,browserToolReviewSchema,type BrowserToolPin} from "@xpotato/content-contracts";
import {toolHash} from "./browser-tool-adoption.js";

/** A reviewed exact release only. This is not a general capability/CSP grant. */
export function assertPrimePublicAdmission(pinInput:unknown,reviewInput:unknown,admissionInput:unknown):void {
 const pin=browserToolPinSchema.parse(pinInput),review=browserToolReviewSchema.parse(reviewInput),admission=browserToolPinSchema.parse(admissionInput);
 if(pin.toolId!=="prime-factorizer"||pin.source.kind!=="github"||pin.source.repository!=="https://github.com/Xpotato1024/browser-prime-toolkit"
  ||JSON.stringify(pin)!==JSON.stringify(admission)||!review.runtimeReview
  ||review.review.scope!=="source-and-release"||review.review.decision!=="admit"
  ||toolHash(JSON.stringify(review))!==pin.reviewSha256||JSON.stringify(review.source)!==JSON.stringify(pin.source)
  ||(["sourceCommit","sourceTreeSha256","lockSha256","manifestSha256","artifactSha256"] as const).some(key=>review[key]!==pin[key])
  ||review.reproducibleArtifactSha256.some(hash=>hash!==pin.artifactSha256))throw Error("Exact reviewed prime public admission required");
}
export async function admitsBoundedPrime(pin:BrowserToolPin):Promise<boolean>{
 const admission=JSON.parse(await readFile(new URL("../../../config/browser-tools/prime-public-admission.json",import.meta.url),"utf8"));
 if(pin.toolId!==admission.toolId||pin.releaseId!==admission.releaseId)return false;
 const review=JSON.parse(await readFile(new URL("../../../docs/acceptance/browser-tools/prime-factorizer/"+pin.releaseId+"-source-review.json",import.meta.url),"utf8"));
 assertPrimePublicAdmission(pin,review,admission);
 return true;
}
