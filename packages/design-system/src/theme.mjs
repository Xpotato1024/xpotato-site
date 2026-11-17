import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import postcss from 'postcss';
export const tokenSource='packages/design-system/src/tokens.css';
export async function loadDesignTokens(){
 const css=await readFile(new URL('./tokens.css',import.meta.url),'utf8'),values=new Map();
 const tree=postcss.parse(css);
 tree.walkDecls(declaration=>{if(declaration.prop.startsWith('--'))values.set(declaration.prop,declaration.value)});
 const resolve=(name,seen=new Set())=>{if(seen.has(name)||!values.has(name))throw Error('DESIGN_TOKEN_UNRESOLVED: '+name);const next=new Set([...seen,name]);return values.get(name).replace(/var\((--[\w-]+)\)/gu,(_,key)=>resolve(key,next));};
 return {resolve,values,css,sha256:createHash('sha256').update(css).digest('hex')};
}
export async function technicalVisualTheme(){
 const tokens=await loadDesignTokens();const theme={id:'site-technical-visual-v1',background:tokens.resolve('--surface'),foreground:tokens.resolve('--text-primary'),muted:tokens.resolve('--text-muted'),grid:tokens.resolve('--border-divider'),accent:tokens.resolve('--accent'),font:tokens.resolve('--font-body'),fontSize:18};
 return {...theme,sha256:createHash('sha256').update(JSON.stringify(theme)).digest('hex'),tokenSourceSha256:tokens.sha256};
}
