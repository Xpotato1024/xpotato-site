import { execFileSync } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { readFile } from "node:fs/promises";
import { fingerprint, sha256 } from "../packages/article-pipeline/src/canonical.js";
import { readSiteContent } from "../packages/site-validators/src/site-content.js";
import { taxonomyRegistry } from "../apps/site/src/content-registry/taxonomy/index.js";
import { applicationRedirects } from "../apps/site/src/content-registry/redirects.js";

export const repository=resolve(dirname(fileURLToPath(import.meta.url)),"..");
export const loadRepository=async()=>{
  const content=await readSiteContent();
  // The repository snapshot pins all registry source bytes, including empty placeholders.
  const { readdir }=await import("node:fs/promises");
  const registryFiles:Record<string,string>={};
  const scan=async(folder:string):Promise<void>=>{
    for(const entry of await readdir(resolve(repository,folder),{withFileTypes:true})) {
      const path=folder+"/"+entry.name;
      if(entry.isDirectory())await scan(path);
      else if(entry.isFile())registryFiles[path]=await readFile(resolve(repository,path),"utf8");
    }
  };
  await scan("apps/site/src/content-registry");
  const registrySha256=fingerprint(registryFiles);
  const records=await Promise.all(content.catalog.map(async entry=>{
    const path=content.sourcePaths.get(entry.routeRecord.contentId)!;
    const source=await readFile(path,"utf8");
    return {contentId:entry.routeRecord.contentId,collection:entry.source.collection,slug:entry.source.slug,
      route:entry.routeRecord.route,source,sourceSha256:sha256(source),registrySha256};
  }));
  return {commit:execFileSync("git",["rev-parse","HEAD"],{cwd:repository,encoding:"utf8"}).trim(),
    fingerprint:fingerprint({records:records.map(({source,...record})=>record),registrySha256}),
    registrySnapshot:registryFiles,categories:taxonomyRegistry.blogCategories,tags:taxonomyRegistry.tags,records,
    occupiedRoutes:[...records.map(record=>record.route),...applicationRedirects.map(record=>record.sourcePath),
      ...records.flatMap(record=>content.catalog.find(item=>item.routeRecord.contentId===record.contentId)?.source.data.legacyUrls??[])]};
};
