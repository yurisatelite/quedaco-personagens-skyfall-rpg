import {normalize} from './rules.mjs';

const array=value=>value==null?[]:Array.from(value instanceof Set&&value.toObject?value.toObject():value);
const rootTypes=['legacy','curse','background','class'];
// As três classes do Livro Básico escolhem a primeira trilha no 2º nível e,
// no 7º, avançam a mesma trilha ou escolhem uma segunda.
const pathChoiceLevels=[2,7];
const occultistCantripChoices=[[1,3,'Conexão Superficial · truques mágicos'],[5,1,'Conexão Rasa · truque mágico'],[9,1,'Conexão Profunda · truque mágico']];

async function entriesFromUuids(catalog,uuids){
  const entries=[];
  for(const uuid of uuids){const item=catalog.entry?.(uuid)??catalog.items.find(entry=>entry.uuid===uuid);if(item)entries.push(item);}
  return [...new Map(entries.map(entry=>[entry.uuid,entry])).values()];
}
function allowedBenefit(document,benefit,targetLevel){
  const level=Number(benefit.level??0);
  if(document.type==='class')return level>=1&&level<=targetLevel;
  if(document.type==='path')return level===0||level<=targetLevel;
  return level===0;
}

export async function buildCharacterPlan(catalog,selections={},choices={},targetLevel=1){
  const level=Math.max(1,Math.min(12,Number(targetLevel)||1));
  const rootEntries=rootTypes.map(type=>catalog.entry?.(selections[type])??catalog.items.find(item=>item.uuid===selections[type])).filter(Boolean);
  const roots=[],included=[],includedByUuid=new Map(),groups=new Map(),queue=[],queued=new Set();
  const enqueue=(entry,document,atLevel=1,selected=false)=>{const key=`${document.uuid}|${atLevel}|${selected}`;if(queued.has(key))return;queued.add(key);queue.push({entry,document,atLevel,selected});};
  for(const entry of rootEntries){const document=await catalog.document(entry.uuid);roots.push({entry,document});enqueue(entry,document,entry.type==='class'?1:0);}
  const curse=roots.find(root=>root.entry.type==='curse')?.document;
  const processQueue=async()=>{
    while(queue.length){
      const {document,atLevel}=queue.shift();
      for(const benefit of array(document.system?.benefits).filter(item=>allowedBenefit(document,item,level))){
        const benefitLevel=Number(benefit.level??0)||atLevel||1;
        if(benefit.uuid){
          const linked=catalog.entry?.(benefit.uuid)??catalog.items.find(item=>item.uuid===benefit.uuid);
          if(benefit.type==='heritage'&&linked?.uuid!==(catalog.entry?.(selections.heritage)?.uuid??selections.heritage))continue;
          if(!linked)throw Error(`Benefício inacessível no catálogo: ${benefit.uuid}`);
          const child=await catalog.document(linked.uuid);
          if(!includedByUuid.has(linked.uuid)){
            const node={entry:linked,document:child,originId:benefit._id,parentUuid:document.uuid,atLevel:benefitLevel};
            included.push(node);includedByUuid.set(linked.uuid,node);
          }
          enqueue(linked,child,benefitLevel);continue;
        }
        if(benefit.type!=='grant')continue;
        const key=`${document.uuid}|${benefit.granting}|${benefit.query??''}|${benefitLevel}`;
        const group=groups.get(key)??{id:key,title:document.name,owner:document,granting:benefit.granting,query:benefit.query??'',originIds:[],options:[],count:0,atLevel:benefitLevel,populated:false};
        group.originIds.push(benefit._id);group.count+=Math.max(1,Number(benefit.quantity)||1);groups.set(key,group);
      }
    }
  };
  const populate=async group=>{
    let uuids=[];
    if(group.granting==='feat'){
      uuids.push(...array(group.owner.system?.feats));
      if(group.owner.type==='legacy'&&curse)uuids.push(...array(curse.system?.feats));
    }else if(group.granting==='path')uuids.push(...catalog.list('path').map(item=>item.uuid));
    else if(group.granting==='spell'){
      const query=normalize(group.query),owner=normalize(group.owner.name);
      for(const spell of catalog.list('spell')){
        const document=await catalog.document(spell.uuid),descriptors=array(document.system?.descriptors).map(normalize);
        if((owner==='conexao superficial'||query.includes('cantrip')||query.includes('truque'))&&!descriptors.includes('cantrip'))continue;
        if(query.includes('shallow')||query.includes('rasa')){if(!descriptors.includes('shallow')&&!descriptors.includes('rasa'))continue;}
        if(query.includes('deep')||query.includes('profunda')){if(!descriptors.includes('deep')&&!descriptors.includes('profunda'))continue;}
        uuids.push(spell.uuid);
      }
    }
    group.options=await entriesFromUuids(catalog,uuids);group.populated=true;
    for(const uuid of array(choices[group.id]).filter(Boolean)){
      const entry=catalog.entry?.(uuid)??catalog.items.find(item=>item.uuid===uuid);
      if(entry)enqueue(entry,await catalog.document(entry.uuid),group.atLevel,true);
    }
  };
  await processQueue();
  // Alguns compêndios antigos não registram o grant de trilha na classe. A tabela
  // de progressão ainda determina essas escolhas; criar o grupo aqui mantém a
  // seleção utilizável sem inventar uma concessão em outro nível.
  const classRoot=roots.find(root=>root.entry.type==='class');
  if(classRoot){
    for(const pathLevel of pathChoiceLevels.filter(item=>item<=level)){
      const exists=[...groups.values()].some(group=>group.granting==='path'&&group.atLevel===pathLevel);
      if(exists)continue;
      const id=`${classRoot.document.uuid}|path-choice|${pathLevel}`;
      groups.set(id,{id,title:pathLevel===2?'Escolha de trilha':'Trilha avançada (mesma do nível 2) ou segunda trilha',owner:classRoot.document,granting:'path',query:'',originIds:[],options:[],count:1,atLevel:pathLevel,populated:false});
    }
    // A tabela do Ocultista concede 3 truques no 1º nível e mais um nos
    // níveis 5 e 9. Alguns compêndios legados omitem os grants; só criamos
    // estes grupos quando o conteúdo nativo não os forneceu.
    if(normalize(classRoot.entry.name)==='ocultista'){
      for(const [spellLevel,count,title] of occultistCantripChoices.filter(([spellLevel])=>spellLevel<=level)){
        const exists=[...groups.values()].some(group=>group.granting==='spell'&&group.atLevel===spellLevel);
        if(exists)continue;
        const id=`${classRoot.document.uuid}|cantrip-choice|${spellLevel}`;
        groups.set(id,{id,title,owner:classRoot.document,granting:'spell',query:'cantrip',originIds:[],options:[],count,atLevel:spellLevel,populated:false});
      }
    }
  }
  while(true){const pending=[...groups.values()].filter(group=>!group.populated);if(!pending.length&&!queue.length)break;for(const group of pending)await populate(group);await processQueue();}
  return {level,roots,included,groups:[...groups.values()].sort((a,b)=>a.atLevel-b.atLevel||a.title.localeCompare(b.title,'pt-BR'))};
}

export const buildLevelOnePlan=(catalog,selections={})=>buildCharacterPlan(catalog,selections,{},1);

export const prowessByStyle={
  'combate com escudo':'facanha com escudo','combate com arma pesada':'facanha com arma pesada',
  'combate com arma a distancia':'facanha com arma a distancia','combate com duas armas':'facanha de duas armas',
  'combate desarmado':'facanha desarmada','combate montado':'facanha montada','combate com uma arma':'facanha com uma arma'
};

export function validateBenefitChoices(plan,choices={}){
  const errors=[];
  for(const group of plan.groups){const selected=array(choices[group.id]).filter(Boolean);if(selected.length!==group.count)errors.push(`Nível ${group.atLevel} · ${group.title}: escolha ${group.count===1?'uma opção':`${group.count} opções`}.`);if(new Set(selected).size!==selected.length)errors.push(`${group.title}: não repita a mesma opção.`);const allowed=new Set(group.options.map(option=>option.uuid));if(selected.some(uuid=>!allowed.has(uuid)))errors.push(`${group.title}: existe uma opção inválida ou indisponível.`);}
  const style=plan.groups.find(group=>group.query==='fighting-style'),prowess=plan.groups.find(group=>group.query==='combat-prowess'&&normalize(group.title)==='facanhas de combate');
  if(style&&prowess){const styleName=style.options.find(option=>option.uuid===array(choices[style.id])[0])?.name,prowessName=prowess.options.find(option=>option.uuid===array(choices[prowess.id])[0])?.name,expected=prowessByStyle[normalize(styleName)];if(expected&&normalize(prowessName)!==expected)errors.push(`Façanhas de combate: escolha “${prowess.options.find(option=>normalize(option.name)===expected)?.name??expected}”, correspondente ao estilo selecionado.`);}
  return errors;
}

export function resolvedPlanItems(plan,choices={}){
  const selected=[];
  for(const group of plan.groups)array(choices[group.id]).forEach((uuid,index)=>{if(!uuid)return;const entry=group.options.find(option=>option.uuid===uuid);if(entry)selected.push({entry,originId:group.originIds[index]??group.originIds[0],parentUuid:group.owner.uuid,atLevel:group.atLevel});});
  return [...plan.roots.map(root=>({entry:root.entry,document:root.document,originId:null,parentUuid:null,level:root.entry.type==='class'?plan.level:undefined,atLevel:root.entry.type==='class'?1:0})),...plan.included,...selected];
}
