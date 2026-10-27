import {ABILITIES,normalize,classRules,backgroundRules,startingMoney,carryingCapacity} from './rules.mjs';
import {buildCharacterPlan,validateBenefitChoices,prowessByStyle} from './benefits.mjs';
import {grantOptions} from './npc-templates.mjs';
import {buildTrainingPlan,resolveTraining,APTITUDES,aptitudeKey} from './training.mjs';
import {buildClassEquipmentPlan,buildBackgroundEquipmentPlan,resolveEquipmentPlan,mergeEquipmentResults,totalVolume} from './equipment.mjs';

// Perfis de campanha já usados pelo QUEDAÇO. São propostas, não novas regras:
// toda opção precisa existir no grupo concedido pelo compêndio da mesa.
export const ANIMAL_PROFILES=[
  {name:'Cobra',terms:['cobra','serpente'],traits:['Dentes Afiados','Camuflagem','Escalador']},
  {name:'Gato',terms:['gato','gata','felino'],traits:['Predador','Escalador','Camuflagem']},
  {name:'Gavião',terms:['gaviao','aguia'],traits:['Predador','Corredor','Oportunista']}
];
const ROLES=[
  {name:'Guarda',terms:['guarda','soldado','lutador','lutadora'],className:'Combatente',background:'Militar',priorities:['str','con','dex','wis','cha','int']},
  {name:'Navegante',terms:['marinheiro','marinheira','navegante','barqueiro','pescador'],className:'Combatente',background:'Navegante',priorities:['dex','con','str','wis','int','cha']},
  {name:'Batedor',terms:['batedor','batedora','cacador','cacadora','rastreador'],className:'Combatente',background:'Caçador',priorities:['dex','wis','con','str','int','cha']},
  {name:'Negociante',terms:['mercador','mercadora','comerciante','negociante'],className:'Especialista',background:'Comerciante',priorities:['cha','int','wis','dex','con','str']},
  {name:'Erudito',terms:['erudito','erudita','pesquisador','pesquisadora','historiador'],className:'Especialista',background:'Erudito',priorities:['int','wis','con','dex','cha','str']},
  {name:'Ocultista',terms:['mago','maga','conjurador','conjuradora'],className:'Ocultista',background:'Agouro',priorities:['wis','con','dex','int','cha','str']}
];
export function shuffled(values,random=Math.random){
  const result=[...values];for(let i=result.length-1;i>0;i--){const j=Math.floor(random()*(i+1));[result[i],result[j]]=[result[j],result[i]];}return result;
}
const mentions=(text,name)=>` ${normalize(text)} `.includes(` ${normalize(name)} `);
const aliases={tora:['anao','ana','anoes','anas'],gnomo:['gnoma','gnomos','gnomas']};

/** Interpretação local explícita: nomes do catálogo e parâmetros, sem serviço de IA. */
export function interpretRequest(catalog,input={}){
  const text=String(input.text??'').slice(0,8000),issues=[],fixed={};
  const levelMention=text.match(/n[ií]vel\s*(\d+)/iu),level=Number(input.level||levelMention?.[1]||1);
  if(!Number.isInteger(level)||level<1||level>12)issues.push('O nível deve estar entre 1 e 12.');
  for(const type of ['legacy','heritage','class','background','curse']){
    if(input.fixed?.[type]){
      const entry=catalog.entry(input.fixed[type]);
      if(!entry||entry.type!==type)issues.push(`Escolha fixa inválida: ${type}.`);else fixed[type]=entry.uuid;
      continue;
    }
    const matches=catalog.list(type).filter(entry=>mentions(text,entry.name)||(aliases[normalize(entry.name)]??[]).some(alias=>mentions(text,alias)));
    if(matches.length>1)issues.push(`A descrição cita mais de uma opção de ${type}; use os campos para definir qual manter.`);
    else if(matches.length)fixed[type]=matches[0].uuid;
  }
  const noCurse=input.noCurse===true||/sem\s+maldi[cç][aã]o/iu.test(text);
  if(noCurse&&fixed.curse)issues.push('A descrição pede uma maldição e também pede sem maldição.');
  const count=Number(input.count??1);
  if(!Number.isInteger(count)||count<1||count>20)issues.push('Escolha de 1 a 20 personagens.');
  const animal=String(input.animal||text.match(/(?:[âa]nima|animal)\s*(?:de|:)?\s*([\p{L}-]+)/iu)?.[1]||'').trim();
  return {text,level,count,fixed,noCurse,animal,variedRoles:input.variedRoles!==false,issues};
}

async function chooseBenefits(catalog,selections,level,random,animal){
  let choices={},plan,previous='';
  const ordering=new Map();
  for(let pass=0;pass<24;pass++){
    plan=await buildCharacterPlan(catalog,selections,choices,level);
    const next={},usedSpells=new Set(),usedFeats=new Set(plan.included.filter(row=>row.entry.type==='feat').map(row=>row.entry.uuid));
    const gnomeOwners=new Set([selections.heritage]);
    for(let depth=0;depth<plan.included.length;depth++)for(const row of plan.included)if(gnomeOwners.has(row.parentUuid))gnomeOwners.add(row.entry.uuid);
    for(const group of plan.groups){
      group.options=await grantOptions(plan,group,catalog,{...choices,...next});
      if(!ordering.has(group.id))ordering.set(group.id,shuffled(group.options.map(row=>row.uuid),random));
      const order=ordering.get(group.id);for(const row of group.options)if(!order.includes(row.uuid))order.push(row.uuid);
      let options=[...group.options].sort((a,b)=>order.indexOf(a.uuid)-order.indexOf(b.uuid));
      if(group.granting==='spell')options=options.filter(row=>!usedSpells.has(row.uuid));
      if(group.granting==='feat')options=options.filter(row=>!usedFeats.has(row.uuid));
      if(animal&&gnomeOwners.has(group.owner.uuid)&&group.granting==='feat')options=options.filter(row=>animal.traits.some(name=>normalize(name)===normalize(row.name)));
      if(group.query==='combat-prowess'&&normalize(group.title)==='facanhas de combate'){
        const style=plan.groups.find(row=>row.query==='fighting-style');
        const styleUuid=style&&(next[style.id]??choices[style.id])?.[0];
        const expected=prowessByStyle[normalize(catalog.entry(styleUuid)?.name)];
        if(expected)options=options.filter(row=>normalize(row.name)===expected);
      }
      const keep=(choices[group.id]??[]).filter(uuid=>options.some(row=>row.uuid===uuid));
      next[group.id]=[...keep,...options.map(row=>row.uuid).filter(uuid=>!keep.includes(uuid))].slice(0,group.count);
      if(group.granting==='spell')next[group.id].forEach(uuid=>usedSpells.add(uuid));
      if(group.granting==='feat')next[group.id].forEach(uuid=>usedFeats.add(uuid));
    }
    const current=JSON.stringify(next);choices=next;
    if(current===previous)break;previous=current;
    if(pass===23)throw Error('As escolhas de progressão não estabilizaram. Revise o personagem.');
  }
  return {choices,plan,issues:validateBenefitChoices(plan,choices)};
}

/** Busca entre blocos para não gastar uma perícia exigida por um bloco posterior. */
export function chooseTraining(className,backgroundName,spellcasting,intelligence,random=Math.random,spells=[]){
  const choices={'specialist-mode':[random()<.5?'mode:aptitudes':'mode:languages']};
  const plan=buildTrainingPlan(className,backgroundName,spellcasting,choices,intelligence,spells);
  const seen={skill:new Set(plan.fixed.skills),protection:new Set(plan.fixed.protections),language:new Set(plan.fixed.languages),spell:new Set()};
  let attempts=0;
  const visit=index=>{
    if(++attempts>30000)return false;
    if(index===plan.groups.length)return !resolveTraining(plan,choices).errors.length;
    const group=plan.groups[index];
    if(group.id==='specialist-mode')return visit(index+1);
    const options=shuffled(group.options.flatMap(option=>option.value==='apti'?Object.keys(APTITUDES).map(value=>({...option,actual:value})):option),random);
    const pick=(start,selected)=>{
      if(selected.length===group.count){choices[group.id]=selected;return visit(index+1);}
      for(let i=start;i<options.length;i++){
        const option=options[i],value=option.actual??option.value;
        if(selected.includes(option.id)||seen[option.kind]?.has(value))continue;
        if(option.kind==='expertise'&&!seen.skill.has(value))continue;
        if(option.actual)choices[aptitudeKey(group.id)]=[value];
        seen[option.kind]?.add(value);
        const blocksLater=plan.groups.slice(index+1).filter(later=>!['specialist-mode','specialist-expertise'].includes(later.id)).some(later=>{
          const available=later.options.filter(candidate=>candidate.value==='apti'?Object.keys(APTITUDES).some(key=>!seen.skill.has(key)):!seen[candidate.kind]?.has(candidate.value));
          return available.length<later.count;
        });
        if(!blocksLater&&pick(i+1,[...selected,option.id]))return true;
        seen[option.kind]?.delete(value);
        if(option.actual)delete choices[aptitudeKey(group.id)];
      }
      return false;
    };
    return pick(0,[]);
  };
  if(!visit(0))throw Error('Não foi possível completar o treinamento sem repetir concessões. Revise as escolhas.');
  return {choices,plan,resolved:resolveTraining(plan,choices)};
}

async function chooseEquipment(catalog,className,backgroundName,proficiencies,random){
  let choices={},classPlan;
  for(let pass=0;pass<3;pass++){
    classPlan=await buildClassEquipmentPlan(catalog,className,choices);
    for(const group of classPlan.groups){const keep=choices[group.id]??[];choices[group.id]=[...keep,...shuffled(group.options,random).map(option=>option.id).filter(id=>!keep.includes(id))].slice(0,group.count);}
  }
  // Rebuild once with the final martial-weapon mode so its count is authoritative.
  classPlan=await buildClassEquipmentPlan(catalog,className,choices);
  for(const group of classPlan.groups)choices[group.id]=(choices[group.id]??[]).slice(0,group.count);
  const backgroundPlan=await buildBackgroundEquipmentPlan(catalog,backgroundName,proficiencies);
  for(const group of backgroundPlan.groups)choices[group.id]=shuffled(group.options,random).slice(0,group.count).map(option=>option.id);
  const resolved=mergeEquipmentResults(await resolveEquipmentPlan(catalog,classPlan,choices),await resolveEquipmentPlan(catalog,backgroundPlan,choices));
  return {choices,resolved,plan:{fixed:[...classPlan.fixed,...backgroundPlan.fixed],groups:[...classPlan.groups,...backgroundPlan.groups],notes:backgroundPlan.notes}};
}

export async function generateCharacter(catalog,request,{random=Math.random,index=0}={}){
  if(request.issues.length)throw Error(request.issues.join(' '));
  const choose=values=>shuffled(values,random)[0];
  const selections={...request.fixed},issues=[],notes=[];
  const roleMatches=ROLES.filter(role=>role.terms.some(term=>mentions(request.text,term)));
  const availableRoles=(roleMatches.length?roleMatches:request.count>1&&request.variedRoles?ROLES:[]).filter(role=>catalog.list('class').some(entry=>normalize(entry.name)===normalize(role.className))&&catalog.list('background').some(entry=>normalize(entry.name)===normalize(role.background)));
  const role=availableRoles.length?availableRoles[index%availableRoles.length]:null;
  if(role){
    selections.class??=catalog.list('class').find(entry=>normalize(entry.name)===normalize(role.className))?.uuid;
    selections.background??=catalog.list('background').find(entry=>normalize(entry.name)===normalize(role.background))?.uuid;
    notes.push(`Função sugerida: ${role.name}. É uma proposta de campanha; classe e antecedente fixos têm prioridade.`);
  }
  if(selections.heritage&&!selections.legacy){
    const compatible=[];
    for(const entry of catalog.list('legacy'))if((await catalog.linkedItems(entry.uuid,{type:'heritage',level:0})).some(heritage=>heritage.uuid===selections.heritage))compatible.push(entry);
    if(!compatible.length)throw Error('A herança fixa não está vinculada a um legado acessível.');
    selections.legacy=choose(compatible).uuid;
  }
  selections.legacy??=choose(catalog.list('legacy'))?.uuid;
  selections.class??=choose(catalog.list('class').filter(entry=>classRules(entry.name)))?.uuid;
  selections.background??=choose(catalog.list('background').filter(entry=>backgroundRules(entry.name)))?.uuid;
  if(!selections.legacy||!selections.class||!selections.background)throw Error('Faltam legados, classes ou antecedentes acessíveis nos compêndios.');
  const legacy=catalog.entry(selections.legacy),className=catalog.entry(selections.class).name,backgroundName=catalog.entry(selections.background).name;
  const gnome=normalize(legacy.name)==='gnomo';
  let animal=gnome?(request.animal?ANIMAL_PROFILES.find(profile=>profile.terms.some(term=>mentions(request.animal,term))):choose(ANIMAL_PROFILES)):null;
  if(gnome&&!animal)issues.push(`Ânima “${request.animal}”: defina as características manualmente; não há um perfil de campanha para esse animal.`);
  const heritages=await catalog.linkedItems(selections.legacy,{type:'heritage',level:0});
  if(selections.heritage&&!heritages.some(entry=>entry.uuid===selections.heritage))throw Error('A herança fixa não pertence ao legado escolhido.');
  selections.heritage??=(gnome&&animal?heritages.find(entry=>normalize(entry.name)==='1 heranca maior e 2 menores'):null)?.uuid??choose(heritages)?.uuid;
  if(!selections.heritage)throw Error(`Nenhuma herança vinculada a ${legacy.name} está acessível.`);
  if(!selections.curse&&!request.noCurse)selections.curse=choose([null,...catalog.list('curse').map(entry=>entry.uuid)]);
  if(!selections.curse)delete selections.curse;
  const slots=shuffled([0,1,2,3,4,5],random),base=[3,2,1,1,0,-1];
  if(role){const ranking=shuffled(role.priorities.slice(0,3),random).concat(role.priorities.slice(3));Object.keys(ABILITIES).forEach((key,i)=>{slots[i]=ranking.indexOf(key);});}
  const boost=choose(slots.map((slot,i)=>base[slot]<3?i:null).filter(value=>value!==null));
  const attributes=Object.fromEntries(Object.keys(ABILITIES).map((key,i)=>[key,base[slots[i]]+(i===boost?1:0)]));
  const spellcasting=shuffled(['int','wis','cha'],random).sort((a,b)=>attributes[b]-attributes[a])[0];
  const name=`${choose(['Nara','Ravi','Iara','Tavi','Mira','Varek','Lira','Saren','Neri','Teren'])} ${choose(['Brasa','Pedraverde','Ventofrio','do Vale','Ferroluz','Alvorada'])} ${index+1}`;
  const draft={name,biography:[request.text,role?`Função proposta: ${role.name}.`:'',gnome?`Ânima: ${request.animal||animal?.name||'a definir'}.`:''].filter(Boolean).join('\n'),level:request.level,selections,noCurse:!selections.curse,attributes,method:'fixed',slots,boost,spellcasting,hpMethod:'fixed',hpRolls:[],portrait:'',token:'',cash:0,moneyOverride:null,animal:gnome?(request.animal||animal?.name||''):''};
  const benefits=await chooseBenefits(catalog,selections,request.level,random,animal);
  issues.push(...benefits.issues);
  if(gnome)notes.push('Ânima é um perfil narrativo de campanha; confira as características propostas nos compêndios.');
  const usedSpells=new Set(benefits.plan.groups.filter(group=>group.granting==='spell').flatMap(group=>benefits.choices[group.id]??[]));
  const cantrips=[];
  for(const entry of catalog.list('spell'))if(!usedSpells.has(entry.uuid)&&Array.from((await catalog.document(entry.uuid)).system?.descriptors??[]).includes('cantrip'))cantrips.push(entry);
  let training,equipment;
  try{training=chooseTraining(className,backgroundName,spellcasting,attributes.int,random,cantrips);}catch(error){issues.push(error.message);}
  const dice=rule=>Array.from({length:rule.dice},()=>Math.floor(random()*(rule.sides??6))+1).reduce((sum,value)=>sum+value,0);
  const sums={class:dice(classRules(className).money),background:dice(backgroundRules(backgroundName))};
  const money=startingMoney(className,backgroundName,sums.class,sums.background);
  if(training){
    try{
      for(let attempt=0;attempt<16;attempt++){
        equipment=await chooseEquipment(catalog,className,backgroundName,training.resolved.proficiencies,random);
        if(totalVolume(equipment.resolved.items)<=carryingCapacity(attributes.str))break;
      }
      issues.push(...equipment.resolved.errors);
      if(totalVolume(equipment.resolved.items)>carryingCapacity(attributes.str))issues.push('A carga sorteada excede a capacidade. Ajuste o equipamento na revisão.');
    }catch(error){issues.push(error.message);}
  }
  return {draft,benefitChoices:benefits.choices,trainingChoices:training?.choices??{},equipmentChoices:equipment?.choices??{},sums,issues:[...new Set(issues)],notes,money,createdActorId:null};
}
