export interface LocalDraft {id:string;source:string;path:string;sourceBranch:string;workingBranch:string;baseCommit:string;savedAt:string;syncedCommit?:string;syncedSource?:string;remoteDraftId?:string;remoteRevision?:number;producer:'human'|'ai'|'mixed'}
export interface LocalMedia {id:string;draftId:string;assetId:string;blob:Blob;originalBytes:number;sourceSha256:string;sha256:string;kind:'photo'|'technical'|'animation';transform:string;createdAt:string;remoteId?:string;originalName:string;sourceRetained:boolean}
const dbName='xpotato-editor-v1';
export async function database():Promise<IDBDatabase>{return new Promise((resolve,reject)=>{const request=indexedDB.open(dbName,1);request.onupgradeneeded=()=>{const db=request.result;db.createObjectStore('drafts',{keyPath:'id'});const media=db.createObjectStore('media',{keyPath:'id'});media.createIndex('draftId','draftId');};request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error);request.onblocked=()=>reject(Error('STORAGE_BLOCKED'));});}
async function transact<T>(store:string,mode:IDBTransactionMode,operation:(store:IDBObjectStore)=>IDBRequest<T>):Promise<T>{const db=await database();return new Promise((resolve,reject)=>{const tx=db.transaction(store,mode),request=operation(tx.objectStore(store));let result:T;request.onsuccess=()=>{result=request.result;};tx.oncomplete=()=>{db.close();resolve(result);};tx.onabort=tx.onerror=()=>{db.close();reject(tx.error??Error('LOCAL_SAVE_FAILED'));};});}
export const saveLocalDraft=(draft:LocalDraft)=>transact('drafts','readwrite',s=>s.put(draft));
export const localDrafts=()=>transact<LocalDraft[]>('drafts','readonly',s=>s.getAll());
export const deleteLocalDraft=(id:string)=>transact('drafts','readwrite',s=>s.delete(id));
export const saveLocalMedia=(media:LocalMedia)=>transact('media','readwrite',s=>s.put(media));
export const localMedia=(draftId:string)=>transact<LocalMedia[]>('media','readonly',s=>s.index('draftId').getAll(draftId));
export const deleteLocalMedia=(id:string)=>transact('media','readwrite',s=>s.delete(id));
export async function storageEstimate(){return navigator.storage?.estimate?await navigator.storage.estimate():{};}
