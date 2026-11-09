import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import sharp from 'sharp';
import { expect, it } from 'vitest';
import { fingerprint, sha256 } from '@xpotato/content-contracts/canonical';
import { bundledOutlineFont } from '@xpotato/media-ingest';
import { homeWorkshopSocialImage, homeWorkshopSocialProfile, validateHomeWorkshopSocialDelivery } from '../../../apps/site/src/lib/home/home-workshop-social.js';
import { homeWorkshopSocialRecipeBinding, prepareHomeWorkshopSocial } from './prepare-home-workshop-social.js';

it('repeats exact 1200×630 JPEG bytes with outlined English and Japanese catch, no button or runtime reference', async () => {
  const output = await mkdtemp(join(tmpdir(), 'home-social-')), previous = sharp.concurrency();
  try {
    const bytes = await sharp({ create: { width: 2400, height: 1350, channels: 3, background: '#665544' } }).webp({ lossless: true }).toBuffer();
    const master = join(output, 'master.webp'); await writeFile(master, bytes);
    sharp.concurrency(4);
    const first = await prepareHomeWorkshopSocial(resolve('.'), master, sha256(bytes), join(output, 'first'));
    expect(sharp.concurrency()).toBe(1);
    sharp.concurrency(2);
    const second = await prepareHomeWorkshopSocial(resolve('.'), master, sha256(bytes), join(output, 'second'));
    expect(second.delivery).toEqual(first.delivery);
    expect(second.overlay).toEqual(first.overlay);
    expect(first.overlay.toString()).not.toMatch(/<text\b|<image\b|<foreignObject\b|\b(?:href|src)=|font-family=|button|制作物/u);
    expect(first.overlay.toString()).toContain('<path');
    expect(homeWorkshopSocialProfile.catch.text).toBe('ものづくり、プログラミング、日々の試行錯誤');
    const catchFont = bundledOutlineFont(resolve('.'), { family: 'Zen Kaku Gothic New', weight: 400 });
    const catchProfile = homeWorkshopSocialProfile.catch;
    expect(first.overlay.toString()).toContain(catchFont.shapedPaths(catchProfile.text, catchProfile.x, catchProfile.baseline, catchProfile.size, homeWorkshopSocialProfile.ink));
    expect(homeWorkshopSocialImage(first.delivery).alt).toContain('「ものづくり、プログラミング、日々の試行錯誤」');
    expect(first.delivery.profileSha256).toBe(fingerprint(homeWorkshopSocialProfile));
    const raster = await readFile(resolve(first.localObjects[0]!.privateRelativePath));
    expect(sha256(raster)).toBe(first.delivery.object.sha256);
    const metadata = await sharp(raster).metadata();
    expect(metadata).toMatchObject({ format: 'jpeg', width: 1200, height: 630 });
    expect(metadata.exif).toBeUndefined(); expect(metadata.xmp).toBeUndefined(); expect(metadata.icc).toBeUndefined();
    expect(homeWorkshopSocialImage(first.delivery).url).toBe('https://xpotato.net/' + first.delivery.object.objectKey);
    await expect(prepareHomeWorkshopSocial(resolve('.'), master, 'a'.repeat(64), join(output, 'wrong'))).rejects.toThrow('source drift');
    const tiny = join(output, 'tiny.png'); await writeFile(tiny, await sharp({ create: { width: 2, height: 2, channels: 3, background: '#000' } }).png().toBuffer());
    await expect(prepareHomeWorkshopSocial(resolve('.'), tiny, sha256(await readFile(tiny)), join(output, 'tiny-output'))).rejects.toThrow('dimensions drift');
  } finally { sharp.concurrency(previous); await rm(output, { recursive: true, force: true }); }
}, 30_000);

it('pins the current profile, renderer, logo, and bundled font inputs in the reviewed recipe', async () => {
  const reviewed = JSON.parse(await readFile('apps/site/source-inputs/home-workshop/reviewed-recipe.json', 'utf8')).socialDelivery;
  expect(validateHomeWorkshopSocialDelivery(reviewed)).toEqual(reviewed);
  const { sourceMasterSha256: _source, overlaySha256: _overlay, object: _object, ...recipe } = reviewed;
  expect(recipe).toEqual(await homeWorkshopSocialRecipeBinding(resolve('.')));
  for (const patch of [{ profileSha256: 'b'.repeat(64) }, { logoSha256: 'b'.repeat(64) }, { object: { ...reviewed.object, width: 1201 } },
    { object: { ...reviewed.object, objectKey: 'private/social.jpg' } }, { object: { ...reviewed.object, format: 'png' } }]) {
    expect(() => validateHomeWorkshopSocialDelivery({ ...reviewed, ...patch })).toThrow();
  }
});
