import {defineConfig} from 'vite';
import tailwindcss from '@tailwindcss/vite';
import {readFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {loadDesignTokens} from '@xpotato/design-system/theme';
import {buildEditorPwa} from '../../ops/build/editor-pwa.mjs';
const root=fileURLToPath(new URL('../../',import.meta.url));
export default defineConfig({base:'/editor/',plugins:[{
 name:'editor-shared-design-assets',enforce:'pre',
 async transform(source,id){if(id.replaceAll('\\','/').split('?')[0]!.endsWith('/apps/editor/src/styles.css')){const fonts=await readFile(resolve(root,'packages/design-system/src/fonts-core.css'),'utf8');return source.replace('@import \"../../../packages/design-system/src/fonts-core.css\";',fonts.replaceAll('/fonts/','/editor/fonts/'));}return undefined;},
 async transformIndexHtml(html){const tokens=await loadDesignTokens();return html.replaceAll('__EDITOR_BRAND__',tokens.resolve('--accent'));},
 async generateBundle(){const tokens=await loadDesignTokens();const color=tokens.resolve('--accent'),background=tokens.resolve('--surface');
  this.emitFile({type:'asset',fileName:'manifest.webmanifest',source:JSON.stringify({id:'/editor/',name:'Xpotato Editor',short_name:'記事編集',start_url:'/editor/',scope:'/editor/',display:'standalone',lang:'ja',background_color:background,theme_color:color,icons:[{src:'/editor/icon.svg',sizes:'any',type:'image/svg+xml',purpose:'any'}]})+'\n'});
  this.emitFile({type:'asset',fileName:'icon.svg',source:'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 192 192"><rect width="192" height="192" rx="40" fill="'+color+'"/><path d="M54 142V49h56l28 28v65zM108 49v30h30M74 99h44M74 119h30" fill="none" stroke="'+tokens.resolve('--on-accent')+'" stroke-width="8"/></svg>'});
  const fonts=await readFile(resolve(root,'packages/design-system/src/fonts-core.css'),'utf8');const names=new Set([...fonts.matchAll(/\/fonts\/([a-zA-Z0-9_.-]+\.woff2)/gu)].map(match=>match[1]!));
  for(const name of names)this.emitFile({type:'asset',fileName:'fonts/'+name,source:await readFile(resolve(root,'apps/site/public/fonts',name))});
 },
 async closeBundle(){if(process.env.NODE_ENV==='production')await buildEditorPwa(resolve(root,'apps/editor/dist'));}
},tailwindcss()],server:{host:'127.0.0.1',port:4317,strictPort:true,proxy:{'/editor-api':{target:'http://127.0.0.1:8787',changeOrigin:false}}},build:{target:'es2022',sourcemap:false,emptyOutDir:true,rollupOptions:{output:{manualChunks(id){if(id.includes('node_modules')&&/remark|rehype|micromark|mdast|hast|unified|unist/u.test(id))return 'markdown';if(id.includes('node_modules')&&/react|scheduler/u.test(id))return 'react';return undefined;}}}},esbuild:{jsx:'automatic'}});
