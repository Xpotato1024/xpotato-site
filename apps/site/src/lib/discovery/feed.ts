import type {ContentDiscoveryRecord} from '@xpotato/content-contracts';

/** Participation is editorial intent, never publication authority. Omission preserves Blog-only behavior. */
export const isFeedEligible = (record:ContentDiscoveryRecord):boolean =>
 record.webIndexable && Boolean(record.pubDate) && (record.feed ?? record.collection==='blog');
