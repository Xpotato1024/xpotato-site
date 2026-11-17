/** Historical receipts keep their original paths and hashes. Translate only at IO boundaries. */
export function currentContentPath(value:string):string {
 if(value.startsWith('apps/site/src/content/blog/'))return 'content/articles/'+value.slice('apps/site/src/content/blog/'.length);
 const other=/^apps\/site\/src\/content\/(notes|projects|tools|pages)\/(.+)$/u.exec(value);
 if(other)return 'content/'+other[1]+'/'+other[2];
 if(value.startsWith('apps/site/src/content-registry/'))return 'content/registry/'+value.slice('apps/site/src/content-registry/'.length);
 return value;
}
export function historicalContentPath(value:string):string {
 if(value.startsWith('content/articles/'))return 'apps/site/src/content/blog/'+value.slice('content/articles/'.length);
 const other=/^content\/(notes|projects|tools|pages)\/(.+)$/u.exec(value);
 if(other)return 'apps/site/src/content/'+other[1]+'/'+other[2];
 if(value.startsWith('content/registry/'))return 'apps/site/src/content-registry/'+value.slice('content/registry/'.length);
 return value;
}
export function normalizeContentMap(input:ReadonlyMap<string,string>):Map<string,string>{
 const output=new Map<string,string>();
 for(const [key,value] of input){const normalized=currentContentPath(key);if(output.has(normalized))throw Error('DUPLICATE_CONTENT_LAYOUT_ALIAS');output.set(normalized,value);}
 return output;
}
