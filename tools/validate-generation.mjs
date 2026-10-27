// Somente leitura: valide uma exportação privada sem criar documentos no Foundry.
import {readFile} from 'node:fs/promises';
import {Catalog} from '../src/catalog.mjs';
import {generateCharacter,interpretRequest} from '../src/generation.mjs';
const path=process.argv[2];if(!path)throw Error('Informe o caminho da exportação privada de catálogo.');
const snapshot=JSON.parse((await readFile(path,'utf8')).replace(/^\uFEFF/,''));
const docs=snapshot.packs.flatMap(pack=>pack.documents).map(doc=>({...doc,visible:true,toObject(){return structuredClone({name:this.name,type:this.type,img:this.img,system:this.system});}}));
globalThis.fromUuid=async uuid=>docs.find(doc=>doc.uuid===uuid);
const game=globalThis.game={user:{id:'validation',isGM:true,can:()=>true},actors:[],version:snapshot.version,system:{id:'skyfall'},packs:snapshot.packs.map(pack=>({documentName:'Item',collection:pack.collection,metadata:{system:'skyfall',label:pack.label},getIndex:async()=>docs.filter(doc=>doc.uuid.startsWith(`Compendium.${pack.collection}.Item.`))}))};
const catalog=await new Catalog(game).load();
globalThis.foundry={applications:{api:{ApplicationV2:class{constructor(){} }}}};
const {CreatorApp}=await import('../src/app.mjs');
let seed=731;const random=()=>{seed=(1664525*seed+1013904223)>>>0;return seed/4294967296;};
const requests=process.argv.includes('--full')?['Anão','Gnomo ânima de gato','Gnomo ânima de cobra','Gnomo ânima de gavião','Anuro','Humani','Draco']:['Anão','Gnomo ânima de gato'];
const rows=[];
for(const text of requests)for(const level of (process.argv.includes('--full')?[1,4,8,12]:[4]))for(const characterClass of ['Combatente','Especialista','Ocultista']){
  try{
    const request=interpretRequest(catalog,{text:`${text} ${characterClass} nível ${level}`,count:1});
    const row=await generateCharacter(catalog,request,{random,index:rows.length});
    const app=new CreatorApp();app.catalog=catalog;await app.loadProposal(row,0);await app.prepareBenefitPlan();await app.prepareTrainingPlan();await app.prepareEquipmentPlan();
    rows.push({text,level,characterClass,issues:[...new Set([...row.issues,...app.errors()])]});
  }catch(error){rows.push({text,level,characterClass,issues:[error.message]});}
}
console.log(JSON.stringify({total:rows.length,ready:rows.filter(row=>!row.issues.length).length,pending:rows.filter(row=>row.issues.length)},null,2));
