// Ponte pública de modelos de NPC; usa exclusivamente o motor deste Criador.
import * as rules from './rules.mjs';
import * as benefits from './benefits.mjs';
import * as training from './training.mjs';
import * as adapter from './adapter.mjs';
import {Catalog} from './catalog.mjs';
const engine={...rules,...benefits,...training,...adapter};
const norm=rules.normalize;
const html=adapter.escapeHTML;
const arr=value=>Array.from(value??[]);
const physical=new Set(['weapon','armor','clothing','equipment','consumable','loot']);
const ID='quedaco-personagens-skyfall-rpg';
let creationQueue=Promise.resolve();

function normalizeBatch(input){
  if(typeof input==='string'){
    if(new TextEncoder().encode(input).byteLength>2_000_000)throw Error('Lote maior que 2 MB.');
    try{input=JSON.parse(input);}catch{throw Error('Use um lote JSON ou importe o documento de texto pelo Cadastro.');}
  }
  input=structuredClone(input);
  const source=input?.batch&&typeof input.batch==='object'?input.batch:input;
  const npcs=source?.npcs??source?.characters??source?.personagens??(Array.isArray(source)?source:null);
  if(!Array.isArray(npcs)||!npcs.length)throw Error('O lote precisa conter uma lista de NPCs.');
  if(npcs.length>200)throw Error('Um lote pode conter no máximo 200 NPCs.');
  const seen=new Set();
  const names=new Set();
  for(const npc of npcs){
    if(!npc||typeof npc!=='object'||Array.isArray(npc))throw Error('Cada NPC precisa ser um objeto.');
    if(seen.has(npc?.id))throw Error(`ID de NPC repetido no lote: ${npc?.id??'(vazio)'}.`);
    seen.add(npc?.id);
    const name=norm(npc.name);
    if(names.has(name))throw Error(`Nome repetido no lote: ${npc.name}. Dê um nome próprio a cada integrante.`);
    names.add(name);
  }
  return {name:String(source?.name??source?.nome??'Lote de NPCs').trim(),npcs};
}

async function batchSignature(rows,meta){
  const bytes=new TextEncoder().encode(JSON.stringify({batch:meta,rows}));
  return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),b=>b.toString(16).padStart(2,'0')).join('');
}

async function templateSignature(prepared,catalog){
  const content=[];
  for(const item of prepared.planItems){
    const document=item.document??await catalog.document(item.entry.uuid);
    content.push({uuid:item.entry.uuid,source:document.toObject(),originId:item.originId,level:item.level});
  }
  const bytes=new TextEncoder().encode(JSON.stringify({npc:prepared.npc,choices:prepared.choices,training:prepared.training,inventory:prepared.inventory,content}));
  return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),b=>b.toString(16).padStart(2,'0')).join('');
}

function normalizeTemplate(input){
  const npc=structuredClone(input);
  if(!/^[a-z0-9][a-z0-9:-]{0,99}$/.test(npc?.id??''))throw Error('Modelo de NPC precisa de ID estável.');
  if(!npc.name?.trim()||!Number.isInteger(npc.level)||npc.level<1||npc.level>12)throw Error('Nome ou nível do modelo inválido.');
  if(!Number.isSafeInteger(npc.cash)||npc.cash<0)throw Error('Dinheiro do modelo inválido.');
  if(Object.keys(npc.attributes??{}).sort().join(',')!=='cha,con,dex,int,str,wis'||Object.values(npc.attributes).some(v=>!Number.isInteger(v)||v< -4||v>4))throw Error('Preencha os seis modificadores de atributo.');
  for(const field of ['legacy','heritage','characterClass','background'])if(typeof npc[field]!=='string'||!npc[field].trim())throw Error(`Falta ${field} no modelo.`);
  if(!Array.isArray(npc.inventory)||npc.inventory.length>100||npc.inventory.some(item=>typeof item.name!=='string'||!Number.isInteger(item.quantity)||item.quantity<1))throw Error('Inventário do modelo inválido.');
  for(const field of ['possessions','skillPriority','languagePriority','featPriority','relations','tags']){
    npc[field]??=[];
    if(!Array.isArray(npc[field])||npc[field].length>200)throw Error(`${field}: informe uma lista de até 200 entradas.`);
    if(field!=='relations'&&npc[field].some(value=>typeof value!=='string'))throw Error(`${field}: informe uma lista de textos.`);
  }
  if(npc.relations.some(link=>!link||typeof link.target!=='string'||!link.target.trim()||['name','kind','text'].some(key=>link[key]!==undefined&&typeof link[key]!=='string')))throw Error('Relações: informe alvo e textos válidos.');
  for(const field of ['job','appearance','clothes','behavior','voice','routine','desire','fear','secret','hook','tactics'])npc[field]=String(npc[field]??'');
  for(const field of ['description','teamId','sourceModule','context','organizationId','environmentId','portrait','token'])if(npc[field]!==undefined&&typeof npc[field]!=='string')throw Error(`${field}: informe texto.`);
  if(npc.anima!==undefined&&typeof npc.anima!=='string')throw Error('Ânima: informe o animal.');
  if(npc.benefitChoices!==undefined&&(!npc.benefitChoices||typeof npc.benefitChoices!=='object'||Array.isArray(npc.benefitChoices)||Object.values(npc.benefitChoices).some(values=>!Array.isArray(values)||values.some(value=>typeof value!=='string'))))throw Error('Escolhas explícitas inválidas.');
  if(npc.portrait)npc.portrait=adapter.safeImage(npc.portrait);
  if(npc.token)npc.token=adapter.safeImage(npc.token);
  return npc;
}

function nativeBiography(npc){
  const labels={description:'Descrição',anima:'Animal da ânima',teamId:'Equipe',context:'Contexto',appearance:'Aparência',clothes:'Vestuário',behavior:'Comportamento',voice:'Voz',routine:'Rotina',desire:'Objetivo',fear:'Receio'};
  const section=(label,text)=>`<h3>${html(label)}</h3><p>${html(text).replace(/\n/g,'<br>')}</p>`;
  return `<h2>${html(npc.name)}</h2><p>Personagem da campanha · ${html(npc.job)}</p>${Object.entries(labels).map(([field,label])=>section(label,npc[field])).join('')}${section('Pertences',npc.possessions.join('; '))}<section class="secret">${section('Segredo',npc.secret)}${section('Gancho',npc.hook)}${section('Combate',npc.tactics)}<h3>Relações</h3><ul data-npc-model-relations="true">${npc.relations.map(link=>`<li>${html(link.name??link.target)} · ${html(link.kind)}: ${html(link.text)}</li>`).join('')}</ul></section>`;
}

/** Atualiza apenas a lista marcada de relações de uma ficha criada por modelo. */
export async function refreshNpcTemplateRelations(input,{game=globalThis.game}={}){
  if(!game.user?.isGM)throw Error('Somente a Mestra pode vincular relações.');
  const npc=normalizeTemplate(input),actors=arr(game.actors);
  const owned=actors.filter(actor=>actor.flags?.[ID]?.npcModel?.id===npc.id);
  if(owned.length!==1||owned[0].flags[ID].npcModel.state!=='created')return false;
  const actor=owned[0];if(actor.hasPlayerOwner)return false;
  const body=String(actor.system.biography??'');
  const marker=/<ul data-npc-model-relations="true">[\s\S]*?<\/ul>/;
  if(!marker.test(body))return false;
  const rows=npc.relations.map(link=>{
    const targets=actors.filter(target=>target.flags?.[ID]?.npcModel?.id===link.target);
    const uuid=targets.length===1&&/^Actor\.[A-Za-z0-9]+$/.test(targets[0].uuid)?targets[0].uuid:null;
    return `<li>${uuid?`@UUID[${uuid}]{${html(link.name??targets[0].name)}}`:html(link.name??link.target)} · ${html(link.kind)}: ${html(link.text)}</li>`;
  });
  const updated=body.replace(marker,`<ul data-npc-model-relations="true">${rows.join('')}</ul>`);
  if(updated!==body)await actor.update({'system.biography':updated});return true;
}

async function prepareTemplate(input,game){
  if(!game.user?.isGM)throw Error('Somente a Mestra pode criar NPCs por modelo.');
  adapter.assertCompatible(game);
  const npc=normalizeTemplate(input),catalog=new Catalog(game);await catalog.load();
  const prepared=await prepareNpc(npc,catalog,engine);
  const signature=await templateSignature(prepared,catalog);
  return {...prepared,catalog,signature};
}

export async function prepareNpcTemplate(input,{game=globalThis.game}={}){
  const row=await prepareTemplate(input,game);
  return {id:row.npc.id,name:row.npc.name,level:row.npc.level,legacy:row.npc.legacy,characterClass:row.npc.characterClass,cash:row.npc.cash,volume:row.volume,capacity:row.limit,inventory:row.gearReport,signature:row.signature,choices:row.choices,trainingChoices:row.trainingChoices};
}

/** Nunca atualiza uma ficha existente. A fila evita duplicação no mesmo cliente. */
export async function createNpcFromTemplate(input,{expectedSignature,game=globalThis.game,ActorClass=globalThis.CONFIG?.Actor?.documentClass}={}){
  const task=creationQueue.then(async()=>{
    if(!game.user?.isGM)throw Error('Somente a Mestra pode criar NPCs por modelo.');
    const npc=normalizeTemplate(input);
    const actors=arr(game.actors),existing=actors.filter(actor=>actor.flags?.[ID]?.npcModel?.id===npc.id);
    if(existing.length>1)throw Error('Há mais de uma ficha para o modelo. Revise os Actors.');
    if(existing.length===1)return {status:existing[0].flags[ID].npcModel.state==='created'?'existing':'needs-review',actorUuid:existing[0].uuid};
    if(actors.some(actor=>norm(actor.name)===norm(npc.name)))throw Error('Já existe uma ficha com esse nome; nenhuma ficha será adotada ou alterada.');
    if(!expectedSignature)throw Error('Gere a prévia do modelo antes de criar a ficha.');
    const row=await prepareTemplate(npc,game);
    if(row.signature!==expectedSignature)throw Error('O modelo ou seus compêndios mudaram. Gere uma nova prévia.');
    const source=adapter.actorSource({...npc,biography:'',selections:row.selections},game.user.id);
    source.system.biography=nativeBiography(npc);
    source.flags[ID].npcModel={id:npc.id,state:'creating',signature:row.signature,anima:npc.anima??'',teamId:npc.teamId??'',tags:npc.tags,sourceModule:npc.sourceModule??'',context:npc.context??'',organizationId:npc.organizationId??'',environmentId:npc.environmentId??''};
    const actor=await ActorClass.create(source);
    if(!actor)throw Error('O Foundry não criou o Actor.');
    try{
      await adapter.addResolvedPlan(actor,row.planItems,row.catalog);
      await adapter.finalizeClassProgression(actor,npc.level);
      await adapter.finalizePathProgression(actor,row.planItems);
      await actor.createEmbeddedDocuments('Item',row.inventory);
      await actor.update(training.actorTrainingUpdate(row.training));
      await adapter.applyHitPointProgression(actor,{level:npc.level,hpMethod:'mean',hpRolls:[]});
      await adapter.refillResources(actor);
      if(Number(actor.system?.level?.value)!==npc.level)throw Error('O nível calculado pelo sistema não corresponde ao modelo.');
      const missing=row.planItems.filter(item=>!arr(actor.items).some(actual=>actual._stats?.compendiumSource===item.entry.uuid));
      if(missing.length)throw Error(`Benefícios não confirmados: ${missing.map(item=>item.entry.name).join(', ')}`);
      await actor.update({[`flags.${ID}.npcModel.state`]:'created'});
      return {status:'created',actorUuid:actor.uuid};
    }catch(error){
      await actor.update({[`flags.${ID}.npcModel.state`]:'needs-review',[`flags.${ID}.npcModel.error`]:error.message});
      throw Error(`${npc.name}: ficha ${actor.uuid} criada com pendência: ${error.message}. Nenhuma ficha será apagada ou recriada automaticamente.`);
    }
  });creationQueue=task.catch(()=>{});return task;
}
function entryByName(catalog,type,name){
  const matches=catalog.items.filter(entry=>(!type||entry.type===type)&&norm(entry.name)===norm(name));
  if(matches.length!==1)throw Error(`${type||'Item'} “${name}”: ${matches.length?'nome ambíguo':'ausente nos compêndios'}.`);
  return matches[0];
}

// Mesmo critério do BenefitsDialog nativo: query seleciona os portadores de feats.
export async function grantOptions(plan,group,catalog,choices){
  if(group.granting!=='feat')return group.options;
  const query=String(group.query??'').split(/[,;]/).map(value=>value.trim()).filter(Boolean);
  const entries=[...plan.roots.map(row=>row.entry),...plan.included.map(row=>row.entry),...Object.values(choices).flat().map(uuid=>catalog.entry(uuid)).filter(Boolean)];
  const documents=await Promise.all([...new Map(entries.map(entry=>[entry.uuid,entry])).values()].map(entry=>catalog.document(entry.uuid)));
  const owners=query.length?documents.filter(doc=>query.includes(doc.type)||query.includes(doc.system?.identifier)):[group.owner];
  const uuids=new Set(owners.flatMap(doc=>arr(doc.system?.feats)));
  return [...uuids].map(uuid=>catalog.entry(uuid)).filter(Boolean);
}

async function prepareNpc(npc,catalog,engine){
  const selections={};
  for(const [type,name] of Object.entries({legacy:npc.legacy,heritage:npc.heritage,class:npc.characterClass,background:npc.background,...(npc.curse?{curse:npc.curse}:{})}))selections[type]=entryByName(catalog,type,name).uuid;
  let choices={},plan,signature='';
  for(let pass=0;pass<24;pass++){
    plan=await engine.buildCharacterPlan(catalog,selections,choices,npc.level);
    const next={},usedSpells=new Set(),preferences=[...(npc.featPriority??[]),npc.path??''];
    for(const group of plan.groups){
      group.options=await grantOptions(plan,group,catalog,choices);
      let options=[...group.options];
      if(group.granting==='path'&&!npc.benefitChoices?.[group.id])options=options.filter(row=>norm(row.name)===norm(npc.path));
      options.sort((a,b)=>{
        const rank=row=>{const at=preferences.findIndex(name=>norm(row.name)===norm(name));return at<0?999:at;};
        return rank(a)-rank(b)||a.name.localeCompare(b.name,'pt-BR');
      });
      if(group.granting==='spell')options=options.filter(row=>!usedSpells.has(row.uuid));
      const keep=(choices[group.id]??[]).filter(uuid=>options.some(row=>row.uuid===uuid));
      const explicit=npc.benefitChoices?.[group.id];
      if(explicit&&(explicit.length!==group.count||new Set(explicit).size!==explicit.length||explicit.some(uuid=>!options.some(option=>option.uuid===uuid))))throw Error(`${npc.name}: escolhas explícitas incompatíveis com ${group.title}.`);
      const selected=explicit??[...keep,...options.map(row=>row.uuid).filter(uuid=>!keep.includes(uuid))].slice(0,group.count);
      if(selected.length!==group.count)throw Error(`${npc.name}: ${group.title} / ${group.granting} precisa de ${group.count} opções válidas; compêndio oferece ${options.length}.`);
      next[group.id]=selected;
      if(group.granting==='spell')selected.forEach(uuid=>usedSpells.add(uuid));
    }
    const current=JSON.stringify(next);
    choices=next;
    if(current===signature)break;
    signature=current;
    if(pass===23)throw Error(`${npc.name}: escolhas não estabilizaram; nenhuma ficha foi gravada.`);
  }
  const errors=engine.validateBenefitChoices(plan,choices);
  if(!plan.included.some(row=>row.entry.uuid===selections.heritage))errors.push('Herança não vinculada ao legado.');
  if(errors.length)throw Error(`${npc.name}: ${errors.join(' ')}`);
  const trainingChoices={'specialist-mode':['mode:aptitudes']};
  const trainingPlan=engine.buildTrainingPlan(npc.characterClass,npc.background,npc.spellcasting??'',trainingChoices,npc.attributes.int,[]);
  const seen={skill:new Set(trainingPlan.fixed.skills),protection:new Set(trainingPlan.fixed.protections),language:new Set(trainingPlan.fixed.languages)};
  for(const [groupIndex,group] of trainingPlan.groups.entries()){
    if(group.id==='specialist-mode')continue;
    const ranked=[...group.options].filter(option=>option.kind!=='spell'&&option.value!=='apti').sort((a,b)=>{
      const rank=option=>{const pref=option.kind==='language'?npc.languagePriority:npc.skillPriority;const at=(pref??[]).indexOf(option.value);return at<0?999:at;};
      return rank(a)-rank(b)||a.id.localeCompare(b.id);
    });
    const selected=[];
    for(const option of ranked){
      if(selected.length===group.count)break;
      if(option.kind==='expertise'&&!seen.skill.has(option.value))continue;
      if(seen[option.kind]?.has(option.value))continue;
      seen[option.kind]?.add(option.value);
      const blocksLater=trainingPlan.groups.slice(groupIndex+1).filter(later=>later.id!=='specialist-mode'&&later.id!=='specialist-expertise').some(later=>{
        const remaining=later.options.filter(candidate=>candidate.kind!=='spell'&&candidate.value!=='apti'&&!seen[candidate.kind]?.has(candidate.value));
        return remaining.length<later.count;
      });
      if(blocksLater){seen[option.kind]?.delete(option.value);continue;}
      selected.push(option.id);
    }
    trainingChoices[group.id]=selected;
  }
  const training=engine.resolveTraining(trainingPlan,trainingChoices);
  if(training.errors.length)throw Error(`${npc.name}: ${training.errors.join(' ')}`);
  const inventory=[];
  for(const requested of npc.inventory){
    const matches=catalog.items.filter(entry=>physical.has(entry.type)&&norm(entry.name)===norm(requested.name));
    if(matches.length!==1)throw Error(`${npc.name}: equipamento “${requested.name}” ${matches.length?'ambíguo':'ausente'}.`);
    const document=await catalog.document(matches[0].uuid);
    const source=engine.embeddedSource(document);
    source.system.quantity=requested.quantity;
    if(requested.rename)source.name=requested.rename;
    if(requested.uniform)source.system.description={...source.system.description,value:`<p>${html(npc.clothes)}</p><p>Visual da campanha sobre o item nativo ${html(requested.name)}. Sem efeitos ou bônus adicionais.</p>`};
    if('equipped' in source.system)source.system.equipped=Boolean(requested.equipped);
    if(requested.equipped&&source.type==='armor'){
      const armorType=source.system.type;
      const needed=armorType==='shield'?'shield':armorType==='heavy'?'heavy':'light';
      if(!training.proficiencies.includes(needed))throw Error(`${npc.name}: falta proficiência para ${requested.name}.`);
    }
    inventory.push(source);
  }
  for(const possession of npc.possessions)inventory.push({name:possession,type:'loot',img:'icons/svg/item-bag.svg',system:{quantity:1,price:0,capacity:0,description:{value:'<p>Pertence narrativo da campanha, sem preço de revenda ou benefício mecânico. Miudeza já acondicionada na carga pessoal; volume próprio não tabelado.</p>'}},flags:{quedaco:{narrativeProp:true}}});
  const volume=inventory.reduce((sum,item)=>sum+(Number(item.system.capacity)||0)*item.system.quantity,0);
  const limit=engine.carryingCapacity(npc.attributes.str);
  if(volume>limit)throw Error(`${npc.name}: carga ${volume} maior que capacidade ${limit}; ajuste antes de criar.`);
  const planItems=engine.resolvedPlanItems(plan,choices);
  const gearReport=npc.inventory.map(item=>`${item.rename??item.name} ×${item.quantity}`).join(', ');
  return {npc,selections,choices,planItems,training,trainingChoices,inventory,volume,limit,gearReport};
}

/** Prepara um documento de NPCs para importação em escala sem gravar Actors. */
export async function prepareNpcBatch(input,{game=globalThis.game}={}){
  if(!game.user?.isGM)throw Error('Somente a Mestra pode preparar lotes de NPCs.');
  adapter.assertCompatible(game);
  const batch=normalizeBatch(input),catalog=new Catalog(game);await catalog.load();
  const rows=[];
  for(const npc of batch.npcs){
    try{
      const normalized=normalizeTemplate(npc);
      const actors=arr(game.actors),existing=actors.filter(actor=>actor.flags?.[ID]?.npcModel?.id===npc.id);
      for(const link of normalized.relations)if(!batch.npcs.some(target=>target.id===link.target)&&!actors.some(target=>target.flags?.[ID]?.npcModel?.id===link.target&&target.flags[ID].npcModel.state==='created'))throw Error(`Relação com NPC não encontrado: ${link.target}.`);
      if(existing.length>1)throw Error('Mais de uma ficha vinculada ao ID; revise os Actors.');
      if(existing.some(actor=>actor.flags[ID].npcModel.state!=='created'))throw Error('Ficha existente com pendência; revise antes de repetir o lote.');
      if(!existing.length&&actors.some(actor=>norm(actor.name)===norm(npc.name)))throw Error('Já existe uma ficha com esse nome; escolha outro nome.');
      const prepared=await prepareNpc(normalized,catalog,engine);
      const signature=await templateSignature(prepared,catalog);
      rows.push({status:'valid',existing:Boolean(existing.length),id:prepared.npc.id,name:prepared.npc.name,level:prepared.npc.level,legacy:prepared.npc.legacy,characterClass:prepared.npc.characterClass,cash:prepared.npc.cash,choices:prepared.choices,trainingChoices:prepared.trainingChoices,signature,volume:prepared.volume,capacity:prepared.limit,inventory:prepared.gearReport});
    }catch(error){rows.push({status:'error',id:npc?.id??null,name:npc?.name??null,error:error.message});}
  }
  return {name:batch.name,total:rows.length,valid:rows.filter(row=>row.status==='valid').length,errors:rows.filter(row=>row.status==='error'),rows,signature:await batchSignature(rows,batch)};
}

/** Cria o lote depois de uma prévia; nenhum NPC é recriado automaticamente. */
export async function createNpcBatch(input,{expectedSignature,game=globalThis.game,ActorClass=globalThis.CONFIG?.Actor?.documentClass}={}){
  if(!game.user?.isGM)throw Error('Somente a Mestra pode criar lotes de NPCs.');
  if(game.users?.activeGM&&game.users.activeGM.id!==game.user.id)throw Error('Execute o lote na sessão da Mestra ativa.');
  const batch=normalizeBatch(input);
  const preview=await prepareNpcBatch(batch,{game});
  if(preview.signature!==expectedSignature)throw Error('O lote ou seus compêndios mudaram. Gere uma nova prévia.');
  if(preview.errors.length)throw Error(`O lote contém ${preview.errors.length} NPC(s) inválido(s); corrija a prévia antes de criar.`);
  const results=[];
  for(const npc of batch.npcs){
    const row=preview.rows.find(item=>item.id===npc.id);
    try{results.push({...await createNpcFromTemplate(npc,{game,ActorClass,expectedSignature:row.signature}),id:npc.id,name:npc.name});}
    catch(error){results.push({status:'error',id:npc.id,name:npc.name,error:error.message});}
  }
  const warnings=[];
  for(const npc of batch.npcs){
    if(!results.some(row=>row.id===npc.id&&row.status==='created'))continue;
    try{await refreshNpcTemplateRelations(npc,{game});}catch(error){warnings.push({id:npc.id,error:error.message});}
  }
  return {name:batch.name,total:results.length,created:results.filter(row=>row.status==='created').length,existing:results.filter(row=>row.status==='existing').length,errors:results.filter(row=>['error','needs-review'].includes(row.status)).length,warnings,results};
}

