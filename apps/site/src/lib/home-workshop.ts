import { mediaAssetRecordSchema, type ContentMediaRegistry } from "@xpotato/content-contracts";

type Asset = ContentMediaRegistry["assets"][number];
export const homeWorkshopPicture = (input: Asset) => {
  const asset = mediaAssetRecordSchema.parse(input);
  if (asset.assetId !== "home-workshop" || asset.role !== "hero" || asset.status !== "active" || asset.origin !== "camera"
    || asset.delivery.mode !== "responsive" || asset.delivery.master.format !== "jpeg"
    || asset.delivery.master.width !== 2400 || asset.delivery.master.height !== 1350 || !asset.defaultAlt?.trim()) throw new Error("Incomplete homepage photo binding");
  const variants = asset.delivery.variants;
  const srcset = (format: "avif" | "webp" | "jpeg") => {
    const items = variants.filter(item => item.format === format).sort((a, b) => a.width - b.width);
    if (items.map(item => item.width).join(",") !== "640,960,1440,1920"
      || items.some(item => item.height !== item.width * 9 / 16)) throw new Error("Missing or duplicate homepage photo variants");
    return items.map(item => `/${item.objectKey} ${item.width}w`).join(", ");
  };
  return { src: `/${asset.delivery.master.objectKey}`, width: asset.delivery.master.width,
    height: asset.delivery.master.height, alt: asset.defaultAlt ?? "", sizes: "(max-width: 760px) 960px, 100vw",
    avif: srcset("avif"), webp: srcset("webp"), jpeg: srcset("jpeg") };
};
