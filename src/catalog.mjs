import { auditCatalog } from './coverage.mjs';
import { normalize } from './rules.mjs';

export const ITEM_TYPES = ['legacy','heritage','curse','background','class','path','feature','feat','ability','spell','weapon','armor','clothing','equipment','consumable','loot','sigil','seal'];
const CREATION_TYPES=new Set(['legacy','heritage','curse','background','class','path','feature','feat','ability']);
const EQUIPMENT_TYPES=new Set(['weapon','armor','clothing','equipment','consumable','loot']);

function sourceScore(entry){
  const source=normalize(entry.source);
  if(CREATION_TYPES.has(entry.type)&&source.includes('criacao de personagem'))return 0;
  if(EQUIPMENT_TYPES.has(entry.type)&&source.includes('equipamento'))return 0;
  if(entry.type==='spell'&&source.includes('magia'))return 0;
  return 10;
}
// O Skyfall pode reutilizar `system.identifier` em Legados e Heranças. Nesses dois
// tipos, o nome é a identidade de catálogo: não podemos fundir Anuro, Draco etc.
function identity(entry){
  const name=normalize(entry.name);
  if(['legacy','heritage'].includes(entry.type))return `${entry.type}|${name}`;
  return `${entry.type}|${normalize(entry.system?.identifier)||name}`;
}

/** Catálogo canônico dos compêndios. Itens soltos do Mundo não entram nas escolhas. */
export class Catalog {
  constructor(game){this.game=game;this.items=[];this.allItems=[];this.aliases=new Map();this.failures=[];this.packs=[];this.documents=new Map();}
  async load(){
    this.items=[];this.allItems=[];this.aliases.clear();this.failures=[];this.packs=[];this.documents.clear();
    for(const pack of this.game.packs){
      if(pack.documentName!=='Item')continue;
      if(pack.metadata?.system&&pack.metadata.system!=='skyfall')continue;
      if(pack.visible===false){this.failures.push({pack:pack.collection,reason:'Compêndio sem permissão de leitura.'});continue;}
      try{
        const index=await pack.getIndex({fields:['type','img','system.identifier','system.price','system.quantity','system.capacity','system.category','system.purpose','system.type','system.descriptors']});
        this.packs.push({id:pack.collection,label:pack.metadata.label,count:index.size??index.length});
        for(const entry of index)if(ITEM_TYPES.includes(entry.type))this.allItems.push({...entry,uuid:entry.uuid??`Compendium.${pack.collection}.Item.${entry._id}`,source:pack.metadata.label});
      }catch(error){this.failures.push({pack:pack.collection,reason:error.message});}
    }
    const chosen=new Map();
    for(const entry of this.allItems){const key=identity(entry),current=chosen.get(key);if(!current||sourceScore(entry)<sourceScore(current))chosen.set(key,entry);}
    this.items=[...chosen.values()].sort((a,b)=>a.name.localeCompare(b.name,'pt-BR')||a.uuid.localeCompare(b.uuid));
    for(const entry of this.allItems)this.aliases.set(entry.uuid,chosen.get(identity(entry))?.uuid??entry.uuid);
    this.audit=auditCatalog(this.items);
    return this;
  }
  entry(uuid){const canonical=this.aliases.get(uuid)??uuid;return this.items.find(item=>item.uuid===canonical)??this.allItems.find(item=>item.uuid===uuid);}
  list(type,query=''){return this.items.filter(item=>(!type||item.type===type)&&item.name.toLocaleLowerCase('pt-BR').includes(query.toLocaleLowerCase('pt-BR')));}
  async document(uuid){
    const requested=this.allItems.some(item=>item.uuid===uuid)?uuid:(this.entry(uuid)?.uuid??uuid);
    if(!this.allItems.some(item=>item.uuid===requested)&&!this.items.some(item=>item.uuid===requested))throw Error('O documento não pertence ao catálogo acessível desta mesa.');
    if(!this.documents.has(requested)){
      const doc=await fromUuid(requested);
      if(!doc||doc.visible===false)throw Error('O documento não pôde ser lido. Confira as permissões do compêndio.');
      this.documents.set(requested,doc);
    }
    return this.documents.get(requested);
  }
  async benefits(uuid,{type,level=0}={}){const document=await this.document(uuid);const benefits=Array.from(document.system?.benefits??[]);return benefits.filter(benefit=>(!type||benefit.type===type)&&(level==null||Number(benefit.level??0)===Number(level)));}
  async linkedItems(uuid,options={}){
    const benefits=await this.benefits(uuid,options),linked=[];
    for(const benefit of benefits){if(!benefit.uuid)continue;const item=this.entry(benefit.uuid);if(item)linked.push(item);else this.failures.push({pack:uuid,reason:`Benefício aponta para documento inacessível: ${benefit.uuid}`});}
    return [...new Map(linked.map(item=>[item.uuid,item])).values()];
  }
  async auditBenefits(types=['legacy','heritage','curse','background','class','path']){
    const identities=this.items.filter(item=>types.includes(item.type)),referencedHeritages=new Set(),missing=[];let benefits=0;
    for(const item of identities){const document=await this.document(item.uuid);for(const benefit of Array.from(document.system?.benefits??[])){benefits+=1;if(benefit.type==='heritage'&&benefit.uuid)referencedHeritages.add(this.aliases.get(benefit.uuid)??benefit.uuid);if(benefit.uuid&&!this.entry(benefit.uuid))missing.push({source:item.name,type:benefit.type,uuid:benefit.uuid});}}
    const unlinkedHeritages=this.items.filter(item=>item.type==='heritage'&&!referencedHeritages.has(item.uuid)).map(item=>({name:item.name,uuid:item.uuid}));
    return {identities:identities.length,benefits,missing,unlinkedHeritages};
  }
  report(){return {foundry:this.game.version,system:{id:this.game.system.id,version:this.game.system.version},packs:this.packs,failures:this.failures,duplicatesRemoved:this.allItems.length-this.items.length,...this.audit};}
}
