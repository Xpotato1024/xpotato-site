import {generatedReleases} from "./generated/records.js";
import type {BrowserToolPin} from "@xpotato/content-contracts";

// Historical immutable releases remain available; selection is owned by installations.json.
export const browserToolReleases: readonly BrowserToolPin[] = Object.freeze([
...generatedReleases,
{
  "schemaVersion": 1,
  "toolId": "prime-factorizer",
  "releaseId": "v0-2-0",
  "packageName": "@xpotato-tool/prime-factorizer",
  "source": {
    "kind": "github",
    "repository": "https://github.com/Xpotato1024/browser-prime-toolkit"
  },
  "sourceCommit": "488ee538855110be3c718e2e03490bb1da53bf12",
  "sourceTreeSha256": "98d106dc02acc12e97c13e45427b23db5e3cf756a77e7dde12261adfcac1675b",
  "lockSha256": "1aa898631dbad3ef5b328af9fbfdac6c8ac14f0bf98de31f372f464ca48f1b83",
  "manifestSha256": "15e2b3d3984edc32820811b75cbeaaac4bfe158d2bfd3bbcf49976a70e161e0a",
  "artifactSha256": "3bc767d94141cf362f184c41f0a55215f5f38ba17aa723a61101ecd6a639d90c",
  "reviewSha256": "2e1c4ae9e41c9cefba2abee5bd1c4037363c165cb02cedab6f6735801d883314"
},
{
  "schemaVersion": 1,
  "toolId": "prime-factorizer",
  "releaseId": "v0-1-5",
  "packageName": "@xpotato-tool/prime-factorizer",
  "source": {
    "kind": "github",
    "repository": "https://github.com/Xpotato1024/browser-prime-toolkit"
  },
  "sourceCommit": "99133842d311d944d09f258bd29afd3d17ba9514",
  "sourceTreeSha256": "2093a46d9562e360fe3bbc7e00b9a48914f176eff0df1af40ce73e8d94943131",
  "lockSha256": "fd6a525037fb787c2e1aee7f35e01f1ee7ec90188aeda43e79cdb7f48cdd584e",
  "manifestSha256": "2609ae235d1978c2d0aef7dc144b14eea03f77df0ef97c825e17f8c3f6859d2c",
  "artifactSha256": "a8791b00fb48847207a8e5e745729bab1ddf7ed68e5f3ec28eb67ea2d94d4fcb",
  "reviewSha256": "c302f69f6a474b248106aa3480e586a157272e4db18937c98910debfc6d44c3d"
},
{
  "schemaVersion": 1,
  "toolId": "prime-factorizer",
  "releaseId": "v0-1-2",
  "packageName": "@xpotato-tool/prime-factorizer",
  "source": {
    "kind": "github",
    "repository": "https://github.com/Xpotato1024/browser-prime-toolkit"
  },
  "sourceCommit": "9d16f826a3aba90794e150a5c34236b29419e49f",
  "sourceTreeSha256": "3177453b382dde1272df735cd767401edee5560851ac21db7faa9f401c778389",
  "lockSha256": "1d663ccfb04e8ec70bc52a4c54864c5ae9e24a9beeb728fc65f3dad2172aa7ae",
  "manifestSha256": "8a3bd5b736c53f7721f04d21d87b89787372bc0cb120ac290d979e133f28d363",
  "artifactSha256": "0c7e4f868c17d9e7d16628115b73fd67e744de4e9757ba66a00f5390ce25dfde",
  "reviewSha256": "e03bbd710fed9035bab916f8a3e5d92fb95af3e0f32885eb7abdc959f0220add"
},
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
