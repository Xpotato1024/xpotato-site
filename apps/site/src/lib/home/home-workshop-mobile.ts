import { mediaObjectRefSchema } from '@xpotato/content-contracts';
import { fingerprint } from '@xpotato/content-contracts/canonical';

// A bounded delivery derivative of the unchanged frozen homepage master, not a new ingest source.
export const homeWorkshopMobileProfile = Object.freeze({
  id: 'home-workshop-mobile-v1', encoderWorkers: 1,
  crop: Object.freeze({ left: 464, top: 0, width: 1600, height: 1350 }),
  widths: Object.freeze([640, 960, 1280]),
  formats: Object.freeze([{format:'avif',quality:55},{format:'webp',quality:82},{format:'jpeg',quality:86}] as const),
  media: '(max-width: 430px)', sizes: '640px', objectPosition: '58% center',
});
export type HomeWorkshopMobileDelivery = {
  profileId: string; profileSha256: string; sourceMasterSha256: string; toolchainSha256: string;
  objects: ReturnType<typeof mediaObjectRefSchema.parse>[];
};
export function validateHomeWorkshopMobileDelivery(input: HomeWorkshopMobileDelivery) {
  const profile = homeWorkshopMobileProfile;
  if (!input || input.profileId !== profile.id || input.profileSha256 !== fingerprint(profile)
    || !/^[a-f0-9]{64}$/.test(input.sourceMasterSha256) || !/^[a-f0-9]{64}$/.test(input.toolchainSha256)
    || input.objects.length !== profile.widths.length * profile.formats.length) throw Error('Homepage mobile recipe drift');
  const objects = input.objects.map(object => mediaObjectRefSchema.parse(object));
  const expected = profile.widths.flatMap(width => profile.formats.map(({format}) => ({width, height:width*27/32, format})));
  if (objects.some((object,index) => object.width !== expected[index]!.width || object.height !== expected[index]!.height
    || object.format !== expected[index]!.format) || new Set(objects.map(object=>object.objectKey)).size !== objects.length) throw Error('Homepage mobile object set drift');
  return input;
}
export function homeWorkshopMobilePicture(input: HomeWorkshopMobileDelivery) {
  const delivery = validateHomeWorkshopMobileDelivery(input);
  return { media:homeWorkshopMobileProfile.media, sizes:homeWorkshopMobileProfile.sizes,
    sources: homeWorkshopMobileProfile.formats.map(({format})=>({type:'image/'+format,
      srcset:delivery.objects.filter(object=>object.format===format).map(object=>`/${object.objectKey} ${object.width}w`).join(', ')})) };
}
