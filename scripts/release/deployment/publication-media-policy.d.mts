export const publicationMediaManifestPath: string;
export const publicationMediaOrigin: string;
export interface PublicationMediaObject { url: string; bytes: number; sha256: string }
export function publicationMediaReferences(value: unknown, sourceSha: string): Map<string, Readonly<PublicationMediaObject>>;
