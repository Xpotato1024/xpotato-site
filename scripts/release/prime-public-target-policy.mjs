// Approved fixed async prime release: read exact verified artifact bytes.
// Other assets retain the historical 2MiB bound.
export function publicTargetBodyLimit(path,bytes){
 const ceiling=/^\/_astro\/PrimeFactorizer\.[A-Za-z0-9_-]+\.js$/u.test(path)?6000000:2097152;
 if(!Number.isSafeInteger(bytes)||bytes<0||bytes>ceiling)throw Error('PUBLIC_TARGET_BODY_LIMIT');
 return bytes;
}
