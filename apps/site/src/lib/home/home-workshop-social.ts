import { mediaObjectRefSchema } from '@xpotato/content-contracts';
import { fingerprint } from '@xpotato/content-contracts/canonical';
import { siteConfig } from '../site-config.js';

// One bounded derivative of the existing frozen homepage photo. Never a general raster admission.
export const homeWorkshopSocialProfile = Object.freeze({
  id: 'home-workshop-social-v2', width: 1200, height: 630, encoderWorkers: 1,
  crop: Object.freeze({ left: 0, top: 45, width: 2400, height: 1260 }),
  saturation: 0.2, contrast: 0.9, ink: '#faf9f7', logoInk: '#ffffff',
  gradient: Object.freeze({ color: '#101014', stops: Object.freeze([
    Object.freeze({ offset: 0, opacity: 0.8 }), Object.freeze({ offset: 52, opacity: 179 / 255 }), Object.freeze({ offset: 100, opacity: 38 / 255 }),
  ]) }),
  brand: Object.freeze({ text: 'Xpotato.net', x: 150, baseline: 163, size: 30, family: 'Zen Kaku Gothic New', weight: 400 } as const),
  title: Object.freeze({ lines: Object.freeze(['Think. Build.', 'Run.']), x: 72, baseline: 290, lineGap: 108, size: 94, family: 'Noto Serif', weight: 400 } as const),
  catch: Object.freeze({ text: 'ものづくり、プログラミング、日々の試行錯誤', x: 72, baseline: 465, size: 26, family: 'Zen Kaku Gothic New', weight: 400 } as const),
  logo: Object.freeze({ x: 72, y: 130, width: 58, height: 40, sha256: '2077b22f57d03199fd709df1d317704cd90ab9477dc1d3fd997d9c44aacc1e69' }),
  format: 'jpeg', quality: 90, chromaSubsampling: '4:4:4', fontkit: '2.0.4', outlineOnly: true, buttons: false,
} as const);

export type HomeWorkshopSocialDelivery = {
  profileId: string; profileSha256: string; sourceMasterSha256: string; toolchainSha256: string;
  fontsSha256: string; logoSha256: string; implementationSha256: string; fontImplementationSha256: string;
  overlaySha256: string; object: ReturnType<typeof mediaObjectRefSchema.parse>;
};
export function validateHomeWorkshopSocialDelivery(input: HomeWorkshopSocialDelivery) {
  const profile = homeWorkshopSocialProfile;
  if (!input || input.profileId !== profile.id || input.profileSha256 !== fingerprint(profile)
    || input.logoSha256 !== profile.logo.sha256
    || !['sourceMasterSha256', 'toolchainSha256', 'fontsSha256', 'implementationSha256', 'fontImplementationSha256', 'overlaySha256']
      .every(key => /^[a-f0-9]{64}$/u.test(input[key as keyof HomeWorkshopSocialDelivery] as string))) throw Error('Homepage social recipe drift');
  const object = mediaObjectRefSchema.parse(input.object);
  if (object.width !== profile.width || object.height !== profile.height || object.format !== profile.format
    || object.objectKey !== `media/v1/objects/sha256/${object.sha256.slice(0, 2)}/${object.sha256}.jpg`) throw Error('Homepage social object drift');
  return input;
}
export function homeWorkshopSocialImage(input: HomeWorkshopSocialDelivery) {
  const { object } = validateHomeWorkshopSocialDelivery(input);
  return { url: new URL('/' + object.objectKey, siteConfig.site.canonicalOrigin).href, width: homeWorkshopSocialProfile.width, height: homeWorkshopSocialProfile.height,
    alt: `工作台の写真にXpotato.netのロゴと「Think. Build. Run.」「${homeWorkshopSocialProfile.catch.text}」を重ねたホームの紹介画像` };
}
