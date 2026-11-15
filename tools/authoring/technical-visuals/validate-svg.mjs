import {readFile,lstat} from 'node:fs/promises';
import {resolve} from 'node:path';
import {noLinks} from './cli.mjs';
import {staticSvg} from './svg.mjs';
import {limits} from './inputs.mjs';
try {
  if (process.argv.length!==3 || !process.argv[2].endsWith('.svg')) throw Error('Usage: node tools/authoring/technical-visuals/validate-svg.mjs <repository-local.svg>');
  const input=resolve(process.argv[2]);await noLinks(input);const info=await lstat(input);
  if (!info.isFile() || info.size>limits.svgBytes) throw Error('SVG input budget exceeded');
  const source=new TextDecoder('utf-8',{fatal:true}).decode(await readFile(input));
  const {width,height,nodeCount}=staticSvg(source);
  console.log(JSON.stringify({kind:'local-static-svg-validation',width,height,nodeCount,approval:false,productionEligible:false}));
} catch(error) {console.error(error.message);process.exitCode=1;}
