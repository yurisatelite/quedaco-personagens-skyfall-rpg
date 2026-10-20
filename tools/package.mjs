import {mkdir,cp,readFile,writeFile,stat,rm} from 'node:fs/promises';
import {resolve,join} from 'node:path';
const root=resolve(import.meta.dirname,'..');
const manifest=JSON.parse(await readFile(join(root,'module.json'),'utf8'));
if(!/^[a-z0-9-]+$/.test(manifest.id)||!/^\d+\.\d+\.\d+$/.test(manifest.version))throw Error('ID ou versão inválida para empacotamento.');
const publicBuild=process.argv.includes('--public');
const target=join(root,'dist',`${manifest.id}-${manifest.version}${publicBuild?'-public':''}`,manifest.id);
// Only the exact generated package directory is replaced; stale assets must not leak into releases.
await rm(target,{recursive:true,force:true});
await mkdir(target,{recursive:true});
for(const entry of ['module.json','assets'])await cp(join(root,entry),join(target,entry),{recursive:true,filter:path=>!publicBuild||!path.replaceAll('\\','/').includes('/assets/fonts/Noka-')});
await mkdir(join(target,'styles'),{recursive:true});
await cp(join(root,'styles','creator.css'),join(target,'styles','creator.css'));
await mkdir(join(target,'src'),{recursive:true});
for(const entry of ['main.mjs','app.mjs','adapter.mjs','branding.mjs','catalog.mjs','coverage.mjs','rules.mjs','benefits.mjs','training.mjs','equipment.mjs','progression.mjs','npc-templates.mjs','npc-description.mjs','player-access.mjs'])await cp(join(root,'src',entry),join(target,'src',entry));
for(const entry of [...manifest.esmodules,...manifest.styles,'assets/fonts/Outfit-Variable.ttf','assets/fonts/OFL-Outfit.txt',...(publicBuild?[]:['assets/fonts/Noka-Medium.woff2','assets/fonts/Noka-Semibold.woff2'])])await stat(join(target,entry));
if(publicBuild){
  const cssPath=join(target,'styles','creator.css');
  const css=await readFile(cssPath,'utf8');
  await writeFile(cssPath,css.replace(/@font-face\{font-family:NokaYuri;[^}]+\}\r?\n/g,''));
}
await writeFile(join(root,'dist','LAST-PACKAGE.txt'),target+'\n');
console.log(`Pacote de desenvolvimento: ${target}`);
