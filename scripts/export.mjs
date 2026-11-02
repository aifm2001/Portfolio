import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';

const SOURCE = 'https://illuminated-founders-388889.framer.app';
const BASE = '/Portfolio';
const DESTINATION = 'https://aifm2001.github.io' + BASE;
const OUT = process.env.OUT_DIR || 'dist';
const documents = new Map();
const modules = new Map();
const media = new Map();
async function get(url) {
  for (let attempt=0; attempt<3; attempt++) {
    try {
      const response = await fetch(url, {signal: AbortSignal.timeout(60000)});
      if (!response.ok && !(response.status === 404 && url === SOURCE + '/404')) throw new Error(response.status + ' ' + url);
      return response;
    } catch(error) { if(attempt===2) throw error; }
  }
}
async function save(file, content) {
  const target = path.join(OUT, file);
  await mkdir(path.dirname(target), {recursive:true});
  await writeFile(target,content);
}
const home = await (await get(SOURCE + '/')).text();
const entry = [...home.matchAll(/<script[^>]+src="([^"]+script_main[^"]+\.mjs)"/g)][0]?.[1];
if (!entry) throw new Error('Framer main module was not found. Export stopped.');
async function collectModule(url) {
  if(modules.has(url)) return;
  modules.set(url, null);
  const code = await (await get(url)).text();
  modules.set(url, code);
  for(const match of code.matchAll(/["'\x60]((?:\.\/|https:\/\/framerusercontent\.com\/)[^"'\x60\s]+\.mjs)["'\x60]/g)) {
    await collectModule(new URL(match[1],url).href);
  }
}
await collectModule(entry);
const routes = [...new Set([...modules.get(entry).matchAll(/path:\x60(\/[^\x60]*)\x60/g)].map(m=>m[1]))];
if (!routes.includes('/') || !routes.includes('/work')) throw new Error('Expected portfolio routes missing.');
for(const route of routes) {
  documents.set(route, route==='/' ? home : await (await get(SOURCE + route)).text());
}
console.log('Collected '+documents.size+' pages and '+modules.size+' JavaScript modules.');
const moduleNames = new Map([...modules.keys()].map(url=>[url,'assets/modules/'+new URL(url).pathname.split('/').pop()]));
// Copy portfolio media and fonts so the deployed pages do not load them from Framer.
for(const text of [...documents.values(),...modules.values()]) {
  for(const match of text.matchAll(/https:\/\/(?:framerusercontent\.com|fonts\.gstatic\.com)\/(?:images|assets|third-party-assets|s)\/[^"'<>\x60\s\\)]+/g)) {
    const url=match[0].replace(/&amp;/g,'&');
    if(!media.has(url)) {
      const ext = path.extname(new URL(url).pathname);
      const file='assets/media/'+createHash('sha256').update(url).digest('hex').slice(0,24)+(ext.length<10?ext:'');
      media.set(url,file);
    }
  }
}
let mediaEntries=[...media], cursor=0, copied=0;
await Promise.all(Array.from({length:8},async()=>{
  while(cursor<mediaEntries.length) {
    const [url,file]=mediaEntries[cursor++];
    await save(file,Buffer.from(await (await get(url)).arrayBuffer()));
    copied++;
  }
}));
function replaceMedia(text) {
  for(const [url,file] of [...media].sort((a,b)=>b[0].length-a[0].length)) {
    text=text.split(url.replaceAll('&','&amp;')).join(BASE+'/'+file).split(url).join(BASE+'/'+file);
  }
  return text;
}
for(const [url,raw] of modules) {
  let code=replaceMedia(raw).replace(/(["'\x60])((?:\.\/|https:\/\/framerusercontent\.com\/)[^"'\x60\s]+\.mjs)\1/g,(whole,quote,reference)=>{
    const resolved=new URL(reference,url).href;
    return moduleNames.has(resolved)?quote+BASE+'/'+moduleNames.get(resolved)+quote:whole;
  });
  if(url===entry) code=code.replace(/path:\x60(\/[^\x60]*)\x60/g,(_,route)=>'path:\x60'+BASE+(route==='/'?'/':route)+'\x60');
  code=code.replace(/EditorBar:[a-zA-Z_$][\w$]*===void 0\?void 0:/g,'EditorBar:!0?void 0:');
  code=code.replaceAll(SOURCE,DESTINATION).replace(/\/\/# sourceMappingURL=.*$/gm,'');
  await save(moduleNames.get(url),code);
}
for(const [route,raw] of documents) {
  let html=replaceMedia(raw);
  for(const [url,file] of moduleNames) html=html.split(url).join(BASE+'/'+file);
  html=html.replace(/href="([^"]+)"/g,(whole,href)=>{
    if(href.startsWith(BASE+'/') || href===BASE || href.startsWith('#') || /^(mailto:|tel:|data:)/.test(href)) return whole;
    const target=new URL(href,SOURCE+route);
    if(target.origin!==SOURCE) return whole;
    return 'href="'+BASE+target.pathname+target.search+target.hash+'"';
  });
  html=html.replaceAll(SOURCE,DESTINATION);
  // Framer's hosted editor and analytics are not needed on the static copy.
  html=html.replace(/<script[^>]+src="https:\/\/events\.framer\.com\/[^"]+"[^>]*><\/script>/g,'');
  await save(route==='/'?'index.html':route.slice(1)+'/index.html',html);
  if(route==='/404') await save('404.html',html);
}
await save('.nojekyll','');
await save('robots.txt','User-agent: *\nAllow: /\nSitemap: '+DESTINATION+'/sitemap.xml\n');
await save('sitemap.xml','<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">'+routes.filter(r=>r!='/404').map(r=>'<url><loc>'+DESTINATION+(r==='/'?'/':r)+'</loc></url>').join('')+'</urlset>');
await save('export-manifest.json',JSON.stringify({source:SOURCE,destination:DESTINATION,created:new Date().toISOString(),routes,modules:modules.size,media:copied},null,2));
console.log('Export complete: '+routes.length+' pages, '+modules.size+' modules, '+copied+' media files.');
