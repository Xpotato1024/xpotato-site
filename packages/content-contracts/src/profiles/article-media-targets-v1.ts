import {fingerprint} from "../canonical.js";
// Provider-neutral planned targets from the immutable accepted Server design.
// This is not a storage receipt, resource-existence proof or mutation authority.
export const articleMediaTargets=Object.freeze({
 id:"article-media-targets-v1",
 authority:{repository:"Xpotato1024/Xpotato-Server",revision:"1a40b7fb990c19dcbc0650d2a0424590682f0c7f",
  path:"inventory/desired/cloudflare.yaml",blobSha256:"2c050b268a381e9d74bd554e726b38ab58b531a20eab2c8dc3145ef3c5476a10",
  selector:"website.media"},
 publicOrigin:"https://assets.xpotato.net",
 source:{storageClass:"private_canonical_media_v1",keyTemplate:"source/v1/objects/sha256/<first-two>/<sha256>.<ext>",
  targetSelector:"website.media.source",private:true,rawCameraOriginals:false,automaticExpiration:false},
 public:{keyTemplate:"media/v1/objects/sha256/<first-two>/<sha256>.<ext>",targetSelector:"website.media.public",
  cacheControl:"public, max-age=31536000, immutable",overwriteDifferentBytes:false},
 protected:{protectionClass:"cloudflare_protected_copy_v1",keyTemplate:"media/v1/objects/sha256/<first-two>/<sha256>.<ext>",
  targetSelector:"website.media.protected",exactPublicBytes:true,private:true,automaticExpiration:false},
 persistentMutationAuthorized:false,
});
export const articleMediaTargetsSha256=fingerprint(articleMediaTargets);
