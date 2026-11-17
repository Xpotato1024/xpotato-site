import {createContentDraft} from './content-draft.js';

/** Compatibility entry for the shared draft writer. */
export const createPageDraft = (repository:string,input:{slug:string;title:string;description:string}) =>
 createContentDraft(repository,{...input,collection:'pages'});
