import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join, relative } from 'node:path';
import sharp from 'sharp';
import { fingerprint, sha256 } from '@xpotato/content-contracts/canonical';
import { bundledOutlineFont, sharpToolchainSha256 } from '@xpotato/media-ingest';
import { homeWorkshopSocialProfile, validateHomeWorkshopSocialDelivery } from '../../../apps/site/src/lib/home/home-workshop-social.js';

const textBytes = async (path: string | URL) => (await readFile(path, 'utf8')).replace(/\r\n?/gu, '\n');
export async function homeWorkshopSocialRecipeBinding(root: string) {
  const profile = homeWorkshopSocialProfile;
  const title = bundledOutlineFont(root, { family: profile.title.family, weight: profile.title.weight });
  const brand = bundledOutlineFont(root, { family: profile.brand.family, weight: profile.brand.weight });
  const catchFont = bundledOutlineFont(root, { family: profile.catch.family, weight: profile.catch.weight });
  const logo = await textBytes(join(root, 'apps/site/public/xpotato-logo.svg'));
  if (sha256(logo) !== profile.logo.sha256) throw Error('Homepage social logo drift');
  return { profileId: profile.id, profileSha256: fingerprint(profile), toolchainSha256: sharpToolchainSha256(),
    fontsSha256: fingerprint({ title: title.binding, brand: brand.binding, catch: catchFont.binding }), logoSha256: sha256(logo),
    implementationSha256: sha256(await textBytes(new URL('./prepare-home-workshop-social.ts', import.meta.url))),
    fontImplementationSha256: sha256(await textBytes(new URL('../../../packages/media-ingest/src/bundled-outline-font.ts', import.meta.url))),
  };
}
export async function prepareHomeWorkshopSocial(root: string, masterPath: string, masterSha256: string, output: string) {
  const source = await readFile(masterPath);
  if (sha256(source) !== masterSha256) throw Error('Homepage social source drift');
  const metadata = await sharp(source).metadata();
  if (metadata.width !== 2400 || metadata.height !== 1350) throw Error('Homepage social source dimensions drift');
  const profile = homeWorkshopSocialProfile, recipe = await homeWorkshopSocialRecipeBinding(root);
  const title = bundledOutlineFont(root, { family: profile.title.family, weight: profile.title.weight });
  const brand = bundledOutlineFont(root, { family: profile.brand.family, weight: profile.brand.weight });
  const catchFont = bundledOutlineFont(root, { family: profile.catch.family, weight: profile.catch.weight });
  const logo = await textBytes(join(root, 'apps/site/public/xpotato-logo.svg'));
  const paths = logo.match(/<path\b[^>]*\/>/gu)?.map(path => path.replace(/fill="#[a-f0-9]+"/giu, `fill="${profile.logoInk}"`));
  if (!paths?.length) throw Error('Homepage social logo paths missing');
  const titlePaths = profile.title.lines.map((line, index) => {
    const y = profile.title.baseline + index * profile.title.lineGap, ink = title.inkBounds(line, profile.title.size);
    if (profile.title.x + ink.minX < 60 || profile.title.x + ink.maxX > 720 || y + ink.minY < 200 || y + ink.maxY > 490) throw Error('Homepage social title bounds drift');
    return title.shapedPaths(line, profile.title.x, y, profile.title.size, profile.ink);
  }).join('');
  const catchInk = catchFont.inkBounds(profile.catch.text, profile.catch.size);
  if (profile.catch.x + catchInk.minX < 60 || profile.catch.x + catchInk.maxX > 720
    || profile.catch.baseline + catchInk.minY < 430 || profile.catch.baseline + catchInk.maxY > 520) throw Error('Homepage social catch bounds drift');
  const catchPaths = catchFont.shapedPaths(profile.catch.text, profile.catch.x, profile.catch.baseline, profile.catch.size, profile.ink);
  const { gradient, logo: box } = profile;
  const overlay = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${profile.width}" height="${profile.height}" viewBox="0 0 ${profile.width} ${profile.height}">`
    + `<defs><linearGradient id="shade" x1="0%" x2="100%" y1="0%" y2="0%">${gradient.stops.map(stop => `<stop offset="${stop.offset}%" stop-color="${gradient.color}" stop-opacity="${stop.opacity}"/>`).join('')}</linearGradient></defs>`
    + `<rect width="${profile.width}" height="${profile.height}" fill="url(#shade)"/>`
    + `<svg x="${box.x}" y="${box.y}" width="${box.width}" height="${box.height}" viewBox="370 440 553.5 375">${paths.join('')}</svg>`
    + brand.shapedPaths(profile.brand.text, profile.brand.x, profile.brand.baseline, profile.brand.size, profile.ink) + titlePaths + catchPaths + '</svg>\n');
  sharp.concurrency(profile.encoderWorkers);
  // CSS saturate(.2) and contrast(.9), followed by the homepage's dark left-to-right overlay.
  const s = profile.saturation;
  const saturation: [[number, number, number], [number, number, number], [number, number, number]] = [[0.213 + 0.787 * s, 0.715 - 0.715 * s, 0.072 - 0.072 * s],
    [0.213 - 0.213 * s, 0.715 + 0.285 * s, 0.072 - 0.072 * s], [0.213 - 0.213 * s, 0.715 - 0.715 * s, 0.072 + 0.928 * s]];
  const bytes = await sharp(source).extract(profile.crop).resize(profile.width, profile.height).recomb(saturation)
    .linear(profile.contrast, 127.5 * (1 - profile.contrast)).composite([{ input: overlay }])
    .jpeg({ quality: profile.quality, chromaSubsampling: profile.chromaSubsampling }).toBuffer();
  const hash = sha256(bytes), object = { sha256: hash, objectKey: `media/v1/objects/sha256/${hash.slice(0, 2)}/${hash}.jpg`,
    format: profile.format, width: profile.width, height: profile.height, sizeBytes: bytes.length };
  await mkdir(output, { recursive: true });
  const path = join(output, hash + '.jpg');
  await writeFile(path, bytes, { flag: 'wx' });
  const delivery = validateHomeWorkshopSocialDelivery({ ...recipe, sourceMasterSha256: masterSha256, overlaySha256: sha256(overlay), object });
  return { delivery, localObjects: [{ ...object, privateRelativePath: relative(root, path).replaceAll('\\', '/') }], overlay };
}
