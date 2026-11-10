/** Deliberately bounded exporter for DayBack's four reviewed ESM files, not a JS bundler. */
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {pathToFileURL} from 'node:url';
const hash=s=>createHash('sha256').update(s).digest('hex');
export function bundle({html,css,modules}) {
 const names=['core.mjs','sample.mjs','ui-state.mjs','app.mjs'];
 if(Object.keys(modules).sort().join()!==[...names].sort().join())throw Error('Unexpected module graph');
 if(/@import|url\s*\(|<\/style/i.test(css))throw Error('CSS must be self-contained');
 const encoded={},visiting=new Set();
 function encode(name){
  if(encoded[name])return encoded[name];
  if(visiting.has(name))throw Error('Cyclic module graph');
  visiting.add(name);let source=modules[name];
  if(typeof source!=='string'||/\bimport\s*\(/.test(source)||/\bexport\s+[^;]*\bfrom\s*['"]/.test(source))throw Error('Unsupported module syntax');
  source=source.replace(/\bimport\s*\{([^}]+)\}\s*from\s*(['"])([^'"]+)\2\s*;/g,(_,bindings,q,spec)=>{
   if(!spec.startsWith('./')||!names.includes(spec.slice(2)))throw Error(`Unsupported import: ${spec}`);
   return `import {${bindings}} from '${encode(spec.slice(2))}';`;
  });
  // Base64 contains a semicolon in its MIME header, so validate complete declarations.
  const residual=source.replace(/import\s*\{[^}]+\}\s*from 'data:text\/javascript;base64,[A-Za-z0-9+/=]+';/g,'');
  if(/\bimport\b/.test(residual))throw Error('Unresolved import');
  visiting.delete(name);return encoded[name]=`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`;
 }
 const app=encode('app.mjs');
 const style='<link rel="stylesheet" href="style.css">',script='<script type="module" src="app.mjs"></script>';
 if(html.split(style).length!==2||html.split(script).length!==2)throw Error('Unexpected HTML entry points');
 const output=html.replace(style,`<style>${css}</style>`).replace(script,`<script type="module" src="${app}"></script>`);
 const refs=[...output.matchAll(/\b(?:src|href)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/gi)].map(x=>x[1]??x[2]??x[3]);
 if(refs.some(r=>!r.startsWith('#')&&!r.startsWith('data:text/javascript;base64,')))throw Error('External HTML dependency');
 return {html:output,manifest:{format:'dayback-single-file-v1',sources:Object.fromEntries([['index.html',html],['style.css',css],...names.map(n=>[n,modules[n]])].map(([n,s])=>[n,hash(s)])),outputSha256:hash(output),outputBytes:Buffer.byteLength(output)}};
}
export async function build(root=new URL('./',import.meta.url)){
 const names=['core.mjs','sample.mjs','ui-state.mjs','app.mjs'];
 const modules=Object.fromEntries(await Promise.all(names.map(async n=>[n,await readFile(new URL(n,root),'utf8')])));
 const result=bundle({html:await readFile(new URL('index.html',root),'utf8'),css:await readFile(new URL('style.css',root),'utf8'),modules});
 await mkdir(new URL('portable/',root),{recursive:true});
 await writeFile(new URL('portable/DayBack.html',root),result.html);
 await writeFile(new URL('portable/manifest.json',root),JSON.stringify(result.manifest,null,2)+'\n');return result;
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){const r=await build();console.log(`Built portable/DayBack.html (${r.manifest.outputBytes} bytes, ${r.manifest.outputSha256}). No publication.`)}
