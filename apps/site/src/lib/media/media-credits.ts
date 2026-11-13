import { isIP } from "node:net";
import { mediaRightsRecordSchema, type ContentMediaRegistry, type MediaRightsRecord } from "@xpotato/content-contracts";

export type MediaCredit = { text: string; href?: string };
type CreditInput = {
  contentId: string; registry: ContentMediaRegistry; rights: readonly MediaRightsRecord[] | undefined;
  assetId: string; credit?: string; sourceUrl?: string; referenceOnly?: boolean;
};
const escape = (text: string) => text.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");
const capability = /token|secret|sig|credential|key|auth|session|code/iu;

// Public metadata only: no network fetch and no inference that a URL grants rights.
function publicUrl(value: string): string {
  let url: URL;
  try { url = new URL(value); } catch { throw Error("MEDIA_CREDIT_UNSAFE_URL"); }
  const host = url.hostname.toLowerCase().replace(/\.$/u, "");
  if (url.protocol !== "https:" || url.username || url.password || url.port
    || /[<>\s\\\u0000-\u001f\u007f]/u.test(value)
    || isIP(host.replace(/^\[|\]$/gu, "")) || !host.includes(".")
    || /(?:^|\.)(?:localhost|local|internal|lan|home|invalid)$/u.test(host)
    || [...url.searchParams.keys()].some(key => capability.test(key))
    || /(?:token|secret|signature|credential|api.?key|auth|session|code)[=:]/iu.test(decodeURIComponent(url.hash)))
    throw Error("MEDIA_CREDIT_UNSAFE_URL");
  return value;
}

function publicText(value: string): string {
  if (!value.trim() || /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/u.test(value)
    || /authorization["']?\s*:|-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/iu.test(value)
    || /(?:api[_-]?(?:token|key)|password|session[_-]?(?:cookie|token)|mfa[_-]?code|recovery[_-]?code)["']?\s*[:=]/iu.test(value)
    || /\b(?:sk-(?:proj-)?[A-Za-z0-9_-]{20,}|gh[pousr]_[A-Za-z0-9]{20,})/u.test(value))
    throw Error("MEDIA_CREDIT_UNSAFE_TEXT");
  const withoutUrls = value.replace(/<\/?[A-Za-z][A-Za-z0-9:-]*\s*\/?>/gu, "").replace(/\b[A-Za-z][A-Za-z0-9+.-]*:\/\/[^\s<>"')]+/gu, url => {
    publicUrl(url); return "<public-url>";
  });
  if (/(?:[A-Za-z]:[\\/]|\\\\[^\\\s]+\\)/u.test(withoutUrls)
    || /(?:^|[^\p{L}\p{N}_])\/(?!\/)[^\s<>"']+/u.test(withoutUrls))
    throw Error("MEDIA_CREDIT_PRIVATE_LOCATOR");
  return value;
}

export function resolveMediaCredits(input: CreditInput): MediaCredit[] {
  if (input.registry.contentId !== input.contentId) throw Error("MEDIA_CREDIT_CONTENT_ID_MISMATCH");
  const active = (id: string) => {
    const matches = input.registry.assets.filter(asset => asset.assetId === id && asset.status === "active");
    if (matches.length !== 1) throw Error("MEDIA_CREDIT_ASSET_NOT_UNIQUE_ACTIVE");
    return matches[0]!;
  };
  const asset = active(input.assetId), assets = [asset];
  if (asset.delivery.mode === "animated") {
    const poster = active(asset.delivery.posterAssetId!);
    if (poster.delivery.mode === "animated") throw Error("MEDIA_CREDIT_POSTER_INVALID");
    assets.push(poster);
  }
  // Old reference-only overlays may lack rights; never fall back to published records.
  const records = input.referenceOnly && input.rights === undefined ? [] : assets.map(item => {
    const matches = input.rights?.filter(record => record.rightsId === item.rightsRef) ?? [];
    if (matches.length !== 1) throw Error("MEDIA_CREDIT_RIGHTS_NOT_UNIQUE");
    const record = mediaRightsRecordSchema.parse(matches[0]);
    if (!record.publicationAuthorized || record.basis === "unknown" || Date.parse(record.confirmedAt) > Date.now()) throw Error("MEDIA_CREDIT_RIGHTS_UNCONFIRMED");
    if (["licensed", "public_domain"].includes(record.basis) && (!record.ownerOrSource || !(record.licenseId || record.licenseUrl)))
      throw Error("MEDIA_CREDIT_LICENSE_METADATA_REQUIRED");
    return record;
  });
  const credits: MediaCredit[] = [], seenText = new Set<string>();
  const addText = (value: string | undefined) => {
    if (value === undefined) return;
    publicText(value);
    if (!seenText.has(value)) { credits.push({ text: value }); seenText.add(value); }
  };
  const links = new Map<string, { source: boolean; licenses: Set<string> }>();
  const addLink = (value: string | undefined, kind: "source" | "license", license?: string) => {
    if (value === undefined) return;
    publicUrl(value);
    const entry = links.get(value) ?? { source: false, licenses: new Set<string>() };
    if (kind === "source") entry.source = true;
    else entry.licenses.add(license === undefined ? "利用条件" : publicText(license) + "（利用条件）");
    links.set(value, entry);
  };
  addText(input.credit);
  addLink(input.sourceUrl, "source");
  for (const record of records) {
    addText(record.attributionText);
    addLink(record.sourceUrl, "source");
    if (record.licenseUrl) addLink(record.licenseUrl, "license", record.licenseId);
    else addText(record.licenseId);
  }
  for (const [href, entry] of links) credits.push({
    text: [...(entry.source ? ["出典"] : []), ...entry.licenses].join("・"), href,
  });
  return credits;
}

export function renderMediaCredits(credits: readonly MediaCredit[]): string {
  return credits.map(item => item.href === undefined
    ? "<span>" + escape(publicText(item.text)) + "</span>"
    : '<a href="' + escape(publicUrl(item.href)) + '" rel="external noopener noreferrer">' + escape(publicText(item.text)) + "</a>").join(" / ");
}
