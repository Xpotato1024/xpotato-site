import { measureLocalServing } from "../../packages/site-validators/src/migration/phase8-serving.js";
console.log(JSON.stringify(await measureLocalServing()));
