import {Catalog} from './catalog.mjs';
import {normalize,validateAttributes} from './rules.mjs';
import {buildCharacterPlan,validateBenefitChoices,prowessByStyle} from './benefits.mjs';
import {assertCompatible} from './adapter.mjs';
import {prepareNpcTemplate,grantOptions} from './npc-templates.mjs';
import {SKILLS,APTITUDES,LANGUAGES,PROFICIENCIES} from './training.mjs';
const words=value=>normalize(value).split(' ').filter(word=>word.length>2);
const has=(text,term)=>Boolean(normalize(term))&&` ${normalize(text)} `.includes(` ${normalize(term)} `);
const stable=value=>{let hash=2166136261;for(const char of value)hash=Math.imul(hash^char.charCodeAt(0),16777619);return hash>>>0;};
const clean=value=>String(value??'').replace(/<[^>]*>/g,' ').replace(/&[^;]+;/g,' ');
const array=value=>Array.from(value??[]);

/** Somente conteúdo da mesa, sem dados dos Actors nem segredos do mundo. */
export async function getNpcCreationCatalog({game=globalThis.game}={}){
  if(!game.user?.isGM)throw Error('Somente a Mestra pode consultar a criação de NPCs.');
  assertCompatible(game);const catalog=await new Catalog(game).load();
  return {items:catalog.items.map(({uuid,name,type})=>({uuid,name,type})),training:{skills:{...SKILLS,...APTITUDES},languages:LANGUAGES,proficiencies:PROFICIENCIES},failures:catalog.failures,mode:'local-rules'};
}

/** Interpretação local por catálogo e perfis declarados. Ambiguidade vira pendência. */
export async function prepareNpcDescription(request,{game=globalThis.game,context={},profiles=[]}={}){
  if(!game.user?.isGM)throw Error('Somente a Mestra pode preparar NPCs por descrição.');
  assertCompatible(game);
  request=structuredClone(request);
  if(!request||typeof request.text!=='string'||!request.text.trim()||request.text.length>24000)throw Error('Descreva o NPC em até 24 mil caracteres.');
  if(!/^[a-z0-9][a-z0-9:-]{0,99}$/.test(request.id??''))throw Error('Pedido precisa de ID estável.');
  const text=request.text,terms=words(text),issues=[],decisions=[],warnings=[];
  const catalog=await new Catalog(game).load();
  const matched=(type,explicit)=>{
    const entries=catalog.list(type);
    if(explicit){const rows=entries.filter(entry=>has(entry.name,explicit)&&has(explicit,entry.name));if(rows.length===1)return rows[0];issues.push(`${type}: “${explicit}” ${rows.length?'ambíguo':'não disponível nos compêndios'}.`);return null;}
    const rows=entries.filter(entry=>has(text,entry.name)||['legacy'].includes(type)&&has(text,entry.name.replace(/o$/,'a')));
    if(rows.length===1)return rows[0];if(rows.length>1)issues.push(`Defina um único ${type}: ${rows.map(row=>row.name).join(', ')}.`);return null;
  };
  const legacy=matched('legacy',request.legacy);
  if(!legacy&&!issues.some(issue=>issue.startsWith('legacy:')))issues.push(has(text,'tritão')||has(text,'tritã')?'Tritão foi solicitado, mas não há legado Tritão acessível. Cadastre a ficha-base autorizada; nenhum outro legado foi usado.':'Informe um legado presente nos compêndios.');
  const requestedLevel=request.level??Number(normalize(text).match(/(?:nivel|nv)\s+(\d+)/)?.[1]);
  if(!Number.isInteger(requestedLevel)||requestedLevel<1||requestedLevel>12)issues.push('Informe o nível entre 1 e 12.');
  const inScope=profile=>(!profile.regionIds?.length||profile.regionIds.includes(context.regionId))&&(!profile.placeIds?.length||profile.placeIds.includes(context.placeId));
  const scoreProfile=profile=>{const lexical=array(profile.terms).reduce((score,term)=>score+(has(request.purpose??text,term)?Math.max(1,words(term).length):0),0);return lexical?lexical+(profile.regionIds?.length?10:0)+(profile.placeIds?.length?20:0):0;};
  const purposes=profiles.filter(profile=>profile.kind==='purpose'&&profile.active!==false&&inScope(profile)&&(!request.purposeProfileId||profile.id===request.purposeProfileId)).map(profile=>({profile,score:request.purposeProfileId?1:scoreProfile(profile)})).filter(row=>row.score>0).sort((a,b)=>b.score-a.score||a.profile.id.localeCompare(b.profile.id));
  const purpose=purposes[0]?.profile;
  if(!purpose)issues.push('Propósito sem perfil: cadastre uma profissão/função que corresponda ao pedido.');
  if(purposes[1]?.score===purposes[0]?.score&&purposes[1]?.profile.id!==purpose?.id)issues.push(`Propósito ambíguo: ${purposes.filter(row=>row.score===purposes[0].score).map(row=>row.profile.name).join(', ')}. Informe purpose.`);
  const animal=request.anima??text.match(/(?:[âa]nima|animal)\s*(?:de|:)?\s*([\p{L}-]+)/iu)?.[1];
  const isGnome=normalize(legacy?.name)==='gnomo';
  const animalProfiles=profiles.filter(profile=>profile.kind==='animal'&&profile.active!==false&&inScope(profile)&&animal&&array(profile.terms).some(term=>has(animal,term)));
  const animalProfile=animalProfiles.length===1?animalProfiles[0]:null;
  if(isGnome&&!animal)issues.push('Gnomo precisa do animal da ânima.');
  if(isGnome&&animal&&!animalProfile)issues.push(`Cadastre um único perfil de ânima para “${animal}”.`);
  if(context.issues?.length)issues.push(...context.issues);
  const statedClass=catalog.list('class').filter(entry=>has(text,entry.name));
  const statedBackground=catalog.list('background').filter(entry=>has(text,entry.name));
  if(statedClass.length>1||statedBackground.length>1)issues.push('Mais de uma classe ou antecedente na descrição; defina as escolhas explicitamente.');
  const cls=matched('class',request.characterClass??statedClass[0]?.name??purpose?.characterClass);
  const background=matched('background',request.background??statedBackground[0]?.name??purpose?.background);
  const linked=[];
  if(legacy){const document=await catalog.document(legacy.uuid);for(const benefit of array(document.system?.benefits))if(benefit.type==='heritage'&&benefit.uuid){const entry=catalog.entry(benefit.uuid);if(entry&&!linked.some(row=>row.uuid===entry.uuid))linked.push(entry);}}
  let heritage;
  const statedHeritages=linked.filter(entry=>has(text,entry.name));
  if(statedHeritages.length>1)issues.push('Defina uma única estrutura de herança.');
  const preferred=request.heritage??statedHeritages[0]?.name??animalProfile?.heritage??purpose?.heritage;
  if(preferred)heritage=linked.find(entry=>normalize(entry.name)===normalize(preferred));
  else if(linked.length===1)heritage=linked[0];
  else if(linked.length>1&&!isGnome){heritage=[...linked].sort((a,b)=>a.uuid.localeCompare(b.uuid))[stable(request.id)%linked.length];decisions.push({field:'heritage',value:heritage.name,reason:'Alternativa válida do legado, distribuição estável pelo ID; proposta de campanha.'});}
  if(!heritage&&legacy)issues.push(`Herança de ${legacy.name} não resolvida${preferred?`: ${preferred}`:''}.`);
  if(!cls&&!issues.some(issue=>issue.startsWith('class:')))issues.push('Classe não resolvida.');
  if(!background&&!issues.some(issue=>issue.startsWith('background:')))issues.push('Antecedente não resolvido.');
  const attributes=request.attributes??purpose?.attributes;
  if(!attributes||validateAttributes(Object.values(attributes),'manual').length||Object.keys(attributes).sort().join(',')!=='cha,con,dex,int,str,wis')issues.push('Perfil precisa dos seis modificadores de atributo válidos.');
  const syllables=['va','na','re','ta','mo','sa','li','ar','do','ve','ra','mi','se','lo','vi','ma'],number=stable(request.id);
  const surname=Array.from({length:6},(_,index)=>syllables[(number>>>(index*5))%16]).join('');
  const name=request.name??text.match(/(?:chamad[oa]|nome[: ]+)\s*["“]([^"”]+)["”]/iu)?.[1]??`${array(purpose?.names).length?purpose.names[number%purpose.names.length]:'NPC'} ${surname[0].toUpperCase()+surname.slice(1)}`;
  if(array(game.actors).some(actor=>normalize(actor.name)===normalize(name)&&actor.flags?.['quedaco-personagens-skyfall-rpg']?.npcModel?.id!==request.id))issues.push('Já existe outra ficha com esse nome. Defina um nome diferente.');
  if(issues.length)return {state:'needs-choices',id:request.id,name,issues,decisions,warnings,mode:'local-rules'};
  const preferences=[...array(animalProfile?.choicePriority),...array(purpose.choicePriority)];
  const selected={},selections={legacy:legacy.uuid,heritage:heritage.uuid,class:cls.uuid,background:background.uuid};
  let plan,previous='';
  const rank=async entry=>{
    const at=preferences.findIndex(name=>normalize(name)===normalize(entry.name));
    const document=await catalog.document(entry.uuid);
    const body=words(`${entry.name} ${clean(document.system?.description?.value??document.system?.description)}`);
    return (at<0?0:10000-at*10)+terms.filter(term=>body.includes(term)).length+array(purpose.keywords).filter(term=>has(body.join(' '),term)).length*3;
  };
  for(let pass=0;pass<24;pass++){
    plan=await buildCharacterPlan(catalog,selections,selected,requestedLevel);
    const pending=[];
    const heritageOwners=new Set([heritage.uuid]);
    const usedSpells=new Set();
    const usedFeats=new Set(plan.included.filter(row=>row.entry.type==='feat').map(row=>row.entry.uuid));
    for(let depth=0;depth<plan.included.length;depth++)for(const row of plan.included)if(heritageOwners.has(row.parentUuid))heritageOwners.add(row.entry.uuid);
    for(const group of plan.groups){
      // Preferências explícitas têm precedência sobre correspondência de texto.
      group.options=await grantOptions(plan,group,catalog,selected);
      const ranked=await Promise.all(group.options.map(async entry=>({entry,score:await rank(entry)})));
      ranked.sort((a,b)=>b.score-a.score||a.entry.uuid.localeCompare(b.entry.uuid));
      const gnomeChoice=isGnome&&(heritageOwners.has(group.owner.uuid)||/gnom.*heran|heran.*gnom/.test(normalize(group.query)));
      let available=gnomeChoice?ranked.filter(row=>preferences.some(pref=>normalize(pref)===normalize(row.entry.name))):ranked;
      if(group.granting==='spell')available=available.filter(row=>!usedSpells.has(row.entry.uuid));
      if(group.granting==='feat')available=available.filter(row=>!usedFeats.has(row.entry.uuid));
      if(group.query==='combat-prowess'){
        const style=plan.groups.find(row=>row.query==='fighting-style');
        const styleName=style&&catalog.entry(selected[style.id]?.[0])?.name;
        const expected=prowessByStyle[normalize(styleName)];
        if(expected)available=available.filter(row=>normalize(row.entry.name)===expected);
      }
      const values=request.benefitChoices?.[group.id]??available.slice(0,group.count).map(row=>row.entry.uuid);
      selected[group.id]=values;
      if(group.granting==='spell')values.forEach(uuid=>usedSpells.add(uuid));
      if(group.granting==='feat')values.forEach(uuid=>usedFeats.add(uuid));
      if(values.length!==group.count)pending.push(`${group.title}: faltam ${group.count} escolhas compatíveis com o conceito e o perfil.`);
    }
    const next=JSON.stringify(selected);if(next===previous){issues.push(...pending);break;}previous=next;
    if(pass===23)issues.push('As escolhas não estabilizaram. Revise o perfil.');
  }
  if(plan)issues.push(...validateBenefitChoices(plan,selected));
  const inventory=structuredClone(request.inventory??purpose.inventory??[]);
  const model={id:request.id,name,legacy:legacy.name,heritage:heritage.name,characterClass:cls.name,background:background.name,level:requestedLevel,attributes,cash:request.cash??purpose.cash??0,inventory,
    description:text,job:request.purpose??purpose.name,anima:isGnome?animal:'',context:context.summary??'',regionId:context.regionId??'',placeId:context.placeId??'',organizationId:context.organizationId??'',environmentId:context.environmentId??'',sourceModule:request.sourceModule??'',teamId:request.teamId??'',benefitChoices:selected,
    skillPriority:purpose.skillPriority??[],languagePriority:purpose.languagePriority??[],featPriority:preferences,relations:request.relations??[],tags:request.tags??[],possessions:purpose.possessions??[],
    appearance:request.appearance??'',clothes:request.clothes??purpose.clothes??'',behavior:request.behavior??purpose.behavior??'',desire:request.desire??purpose.desire??'',...(request.spellcasting??purpose.spellcasting?{spellcasting:request.spellcasting??purpose.spellcasting}:{})};
  for(const group of plan?.groups??[])for(const uuid of selected[group.id]??[])decisions.push({field:group.id,value:catalog.entry(uuid)?.name??uuid,reason:preferences.some(pref=>normalize(pref)===normalize(catalog.entry(uuid)?.name))?'Preferência do perfil de propósito/ânima.':'Correspondência local com o conceito; alternativa válida proposta para revisão.'});
  decisions.push({field:'profile',value:purpose.name,reason:`Perfil de campanha ${purpose.id}; não altera as regras do sistema.`},{field:'location',value:context.summary??'',reason:'Cadastro compartilhado da mesa.'},{field:'cash',value:String(model.cash),reason:'Bolsa definida pelo perfil/pedido em Trocados; não é uma rolagem de riqueza inicial.'},{field:'attributes',value:JSON.stringify(attributes),reason:'Distribuição do perfil de campanha, validada como modificadores manuais.'});
  if(issues.length)return {state:'needs-choices',id:request.id,name,model,issues:[...new Set(issues)],decisions,warnings,mode:'local-rules'};
  try{const preview=await prepareNpcTemplate(model,{game});return {state:'ready',id:request.id,name,model,preview,signature:preview.signature,issues:[],decisions,warnings,mode:'local-rules'};}
  catch(error){return {state:'needs-choices',id:request.id,name,model,issues:[error.message],decisions,warnings,mode:'local-rules'};}
}
