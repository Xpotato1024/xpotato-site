import { readFile, readdir, writeFile, mkdir } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { z } from "zod";
import { generatedSchemaRegistry } from "../src/schema-registry.js";
import {generatedSchemaPaths} from '../src/schema-groups.js';

const packageDirectory = resolve(dirname(fileURLToPath(import.meta.url)),"..");
const outputDirectory = resolve(packageDirectory, "../../schemas/generated");

const serialize = (schema: z.ZodType): string =>
  `${JSON.stringify(z.toJSONSchema(schema, { target: "draft-2020-12", unrepresentable: "any" }), null, 2)}\n`;

export async function generateSchemas(directory=outputDirectory,checkOnly=false){
const paths=generatedSchemaPaths(),expectedNames=new Set(paths.values()),failures: string[] = [];
for (const [name, schema] of Object.entries(generatedSchemaRegistry)) {
  const path = resolve(directory, paths.get(name)!);
  const expected = serialize(schema);
  if (checkOnly) {
    const actual = await readFile(path, "utf8").catch(() => undefined);
    if (actual !== expected) failures.push(`${name}.schema.json is stale or missing`);
  } else {
    await mkdir(dirname(path),{recursive:true});
    await writeFile(path, expected, "utf8");
  }
}

if (checkOnly) {
  const walk=async(base:string,prefix=''):Promise<string[]>=>{
    const files:string[]=[];
    for(const entry of await readdir(base,{withFileTypes:true})){
      if(entry.isSymbolicLink())throw Error('Generated schemas cannot contain links');
      const path=prefix+entry.name;
      if(entry.isDirectory())files.push(...await walk(resolve(base,entry.name),path+'/'));
      else files.push(path);
    }
    return files;
  };
  const unexpected = (await walk(directory)).filter(name=>!expectedNames.has(name));
  failures.push(...unexpected.map((name) => `${name} is not registered`));
  if (failures.length > 0) {
    throw new Error(`Generated schema freshness failed:\n${failures.join("\n")}`);
  }
}
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href)await generateSchemas(outputDirectory,process.argv.includes('--check'));
