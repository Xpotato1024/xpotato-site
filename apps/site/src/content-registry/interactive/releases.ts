import {generatedReleases} from "./generated/records.js";
import type { BrowserToolPin } from "@xpotato/content-contracts";

export const browserToolReleases: readonly BrowserToolPin[] = Object.freeze([
...generatedReleases,
{
  "schemaVersion": 1,
  "toolId": "prime-factorizer",
  "releaseId": "v0-1-1",
  "packageName": "@xpotato-tool/prime-factorizer",
  "source": {
    "kind": "github",
    "repository": "https://github.com/Xpotato1024/browser-prime-toolkit"
  },
  "sourceCommit": "69d12a0a511e00a2e33040eb72f4222ce19a4f97",
  "sourceTreeSha256": "2c926f848f99a0e2e6637da5773f6f321af913d8a9c74be9d129849916b2ef6c",
  "lockSha256": "864f561dfc8b662b6335f2d827dd2525c0e26f918c2e83ec9ece84c6e6c63aa7",
  "manifestSha256": "b992a3e8defff481ddfb9af822c594df147d80739458f31ebc9099e24c3464db",
  "artifactSha256": "1d21b62421930792d5d4dafe501d97e809156330b43d52fb99ecfa588a64d383",
  "reviewSha256": "ed1f14aa3b2b7a6472395c586ede2bed84eec5242025197eb200b18dbe3b28de"
},
{
  "schemaVersion": 1,
  "toolId": "prime-factorizer",
  "releaseId": "v0-1-0",
  "packageName": "@xpotato-tool/prime-factorizer",
  "source": {
    "kind": "github",
    "repository": "https://github.com/Xpotato1024/browser-prime-toolkit"
  },
  "sourceCommit": "d1c0e57bcb01873d892d00fc94057376dcf5f76c",
  "sourceTreeSha256": "5565729324c032cdc144bf3c53c643f18c7dfe6c70b615d6c3fd763509040b9a",
  "lockSha256": "31be7292d199cea8a53757e60eca6f95607800e4fac77b9ac67900c1ea9cc4f5",
  "manifestSha256": "68e9908020976f4d6979db699935638363678a965add3179f146791141c7d3ae",
  "artifactSha256": "585876308e7930da35242262309a9fa717f6c9ceb5ff79e5f9408056ca1212e1",
  "reviewSha256": "c74ffa9cc92621869f61eec6298a8ed935e95c257a3b5c48adc95d13b23af0ab"
}
]);
