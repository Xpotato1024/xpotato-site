export function assertHomeWorkshopImageReferences(
  text: string,
  route: string,
  assets: ReadonlyMap<string, unknown>,
  hostname: string,
  publicationMedia?: ReadonlyMap<string, unknown>,
): void;

export interface EditorIconPublicObject {
  readonly path: string;
  readonly bytes: number;
  readonly sha256: string;
}
export const editorIconPublicObjects: readonly EditorIconPublicObject[];
export function assertEditorIconPublicObject(row: EditorIconPublicObject): EditorIconPublicObject;
