import {normalize,ABILITIES} from './rules.mjs';

export const SKILLS={pres:'Apresentação',apti:'Aptidão',arca:'Arcanismo',cult:'Cultura',dipl:'Diplomacia',doct:'Doutrinas',stea:'Furtividade',inti:'Intimidação',insi:'Intuição',magi:'Magitec',rogu:'Malandragem',mani:'Manipulação',medi:'Medicina',natu:'Natureza',perc:'Percepção',fitn:'Preparo Físico',navi:'Aptidão (Navegação)'};
export const APTITUDES={forg:'Forja',pois:'Veneno',fish:'Pescaria',alch:'Alquimia',dist:'Destilação',cart:'Cartografia',tail:'Alfaiataria',cook:'Culinária',pain:'Pintura',craf:'Artesanato',navi:'Navegação',inst:'Instrumentos'};
export const APTITUDE_ICONS={forg:'fa-hammer',pois:'fa-skull-crossbones',fish:'fa-fish',alch:'fa-flask',dist:'fa-vial',cart:'fa-map',tail:'fa-scissors',cook:'fa-utensils',pain:'fa-paintbrush',craf:'fa-toolbox',navi:'fa-dharmachakra',inst:'fa-music'};
export const SKILL_ICONS={pres:'fa-masks-theater',apti:'fa-screwdriver-wrench',arca:'fa-hat-wizard',cult:'fa-landmark',dipl:'fa-handshake',doct:'fa-place-of-worship',stea:'fa-user-ninja',inti:'fa-hand-fist',insi:'fa-eye',magi:'fa-gears',rogu:'fa-mask',mani:'fa-chess-knight',medi:'fa-kit-medical',natu:'fa-leaf',perc:'fa-binoculars',fitn:'fa-person-running',...APTITUDE_ICONS};
export const PROFICIENCIES={simple:'Armas Simples',martial:'Armas Marciais',light:'Armaduras Leves',heavy:'Armaduras Pesadas',shield:'Escudos'};
export const LANGUAGES={abyssal:'Abissal',anuri:'Anuri',bo:'Bo',celestial:'Celestial',draconic:'Dracônico',toranio:'Tôranio',elvish:'Élfico',kia:'Kia',kishi:'Kishi',vampy:'Vampy'};
const skillOptions=(ids=Object.keys(SKILLS).filter(id=>id!=='navi'))=>ids.map(id=>({id:`skill:${id}`,label:SKILLS[id]??APTITUDES[id]??id,kind:'skill',value:id}));
/** Onde fica qual Aptidão (livro: a perícia vira "Aptidão com __") foi escolhida para a opção genérica `apti` de um bloco. */
export const aptitudeKey=groupId=>`${groupId}:apti`;
const expertiseOptions=()=>[...Object.entries(SKILLS).filter(([id])=>!['apti','navi'].includes(id)),...Object.entries(APTITUDES).map(([id,label])=>[id,`Aptidão com ${label}`])].map(([id,label])=>({id:`expertise:${id}`,label,kind:'expertise',value:id}));
const aptitudeOptions=()=>Object.entries(APTITUDES).map(([id,label])=>({id:`skill:${id}`,label:`Aptidão com ${label}`,kind:'skill',value:id}));
const languageOptions=()=>Object.entries(LANGUAGES).map(([id,label])=>({id:`language:${id}`,label,kind:'language',value:id}));
const protectionOptions=(ids=['str','dex','con','int','wis','cha'])=>ids.map(id=>({id:`protection:${id}`,label:ABILITIES[id]??id.toUpperCase(),kind:'protection',value:id}));
const group=(id,title,count,options)=>({id,title,count,options});

const CLASS={
  combatente:{proficiencies:['simple','martial','light','heavy','shield'],skills:['fitn','navi'],protections:['con'],groups:[group('class-protection','Proteção de Combatente',1,protectionOptions(['str','dex'])),group('class-skills','Perícias de Combatente',2,skillOptions(['cult','inti','insi','perc','natu'])),group('class-language','Idioma de Combatente',1,languageOptions())]},
  especialista:{proficiencies:['simple','light'],skills:[],protections:[],groups:[group('class-protections','Proteções de Especialista',2,protectionOptions()),group('class-skills','Perícias de Especialista',5,skillOptions()),group('specialist-mode','Aptidões e idiomas',1,[{id:'mode:aptitudes',label:'Duas Aptidões e um idioma',kind:'mode',value:'aptitudes'},{id:'mode:languages',label:'Três idiomas',kind:'mode',value:'languages'}])]},
  ocultista:{proficiencies:['simple'],skills:[],protections:[],groups:[group('class-protection','Proteção adicional de Ocultista',1,protectionOptions()),group('occultist-core-skill','Conhecimento de Ocultista',1,skillOptions(['arca','doct','natu'])),group('class-skills','Outras perícias de Ocultista',3,skillOptions(['apti','arca','cult','doct','insi','magi','medi','natu','perc'])),group('class-languages','Idiomas de Ocultista',2,languageOptions())]}
};
const BACKGROUND={
  'agente de organizacao':[['pres','inti'],1],'agouro':[['arca','doct'],1],'aristocrata':[['cult','dipl'],3],
  'artista':[['pres','apti'],1],'assistente magitec':[['arca','magi'],0,['vampy']],
  'cacador':[['stea','natu'],1],'comerciante':[['dipl','mani'],2],'contrabandista':[['apti','rogu'],1],
  'cosmopolita':[['dipl','insi'],3],'detetive':[['insi','perc'],1],'devedor':[['stea','rogu'],1],
  'erudito':[['arca','cult','doct','medi','natu'],3,[],2],'estudioso feerico':[['arca','natu'],0,['elvish'],1,['Feérico']],
  'heroi do povo':[Object.keys(SKILLS).filter(id=>id!=='navi'),1],'juramentado':[['perc','medi'],2],
  'militar':[['medi','fitn'],1],'navegante':[['navi','cult'],2],'procurado':[['stea','rogu'],2],
  'proletario':[['fitn','apti'],1],'viajante intrepido':[['natu','perc'],2,['bo']]
};

export function buildTrainingPlan(className,backgroundName,spellcasting='',choices={},intelligence=0,spells=[]) {
  const cls=CLASS[normalize(className)];if(!cls)throw Error('Classe sem treinamento mapeado.');
  const bg=BACKGROUND[normalize(backgroundName)];if(!bg)throw Error('Antecedente sem treinamento mapeado.');
  const fixed={proficiencies:[...cls.proficiencies],skills:[...cls.skills],protections:[...cls.protections],languages:['common',...(bg[2]??[])],notes:[...(bg[4]??[])]};
  if(normalize(className)==='ocultista'&&spellcasting)fixed.protections.push(spellcasting);
  const groups=cls.groups.map(item=>({...item,options:[...item.options]}));
  if(normalize(className)==='especialista') {
    const mode=choices['specialist-mode']?.[0];
    if(mode==='mode:aptitudes')groups.push(group('specialist-aptitudes','Aptidões de Especialista',2,aptitudeOptions()),group('class-languages','Idioma de Especialista',1,languageOptions()));
    if(mode==='mode:languages')groups.push(group('class-languages','Idiomas de Especialista',3,languageOptions()));
  }
  groups.push(group('background-skills',`Perícia de ${backgroundName}`,bg[3]??1,skillOptions(bg[0])));
  if(bg[1])groups.push(group('background-languages',`Idiomas de ${backgroundName}`,bg[1],languageOptions()));
  const extras=Math.floor(Math.max(0,intelligence)/2);
  if(extras)groups.push(group('intelligence-bonus','Bônus de INT',extras,[...skillOptions(),...spells.map(item=>({id:`spell:${item.uuid}`,label:`Truque: ${item.name}`,kind:'spell',value:item.uuid}))]));
  if(normalize(className)==='especialista')groups.push(group('specialist-expertise','Especialidade: perícia expert',1,expertiseOptions()));
  return {fixed,groups};
}

export function resolveTraining(plan,choices={}) {
  const result={proficiencies:new Set(plan.fixed.proficiencies),skills:new Set(plan.fixed.skills),expertise:new Set(),protections:new Set(plan.fixed.protections),languages:new Set(plan.fixed.languages),spells:[],notes:[...plan.fixed.notes]};
  const errors=[];const seen={skill:new Set(result.skills),protection:new Set(result.protections),language:new Set(result.languages),spell:new Set()};
  for(const group of plan.groups) {
    const selected=(choices[group.id]??[]).filter(Boolean);
    if(selected.length!==group.count)errors.push(`${group.title}: escolha ${group.count===1?'uma opção':`${group.count} opções`}.`);
    if(new Set(selected).size!==selected.length)errors.push(`${group.title}: não repita a mesma opção.`);
    for(const id of selected) {
      const option=group.options.find(item=>item.id===id);
      if(!option){errors.push(`${group.title}: opção inválida.`);continue;}
      if(option.kind==='mode')continue;
      if(option.kind==='expertise'){if(!result.skills.has(option.value)){errors.push(`${group.title}: “${option.label}” precisa ser uma perícia treinada.`);continue;}result.expertise.add(option.value);continue;}
      if(option.kind==='skill'&&option.value==='apti'){
        const aptitude=(choices[aptitudeKey(group.id)]??[])[0];
        if(!aptitude||!APTITUDES[aptitude]){errors.push(`${group.title}: escolha qual Aptidão.`);continue;}
        if(seen.skill.has(aptitude)){errors.push(`${group.title}: “Aptidão com ${APTITUDES[aptitude]}” já foi concedida por outra escolha.`);continue;}
        seen.skill.add(aptitude);result.skills.add(aptitude);continue;
      }
      if(seen[option.kind]?.has(option.value)){errors.push(`${group.title}: “${option.label}” já foi concedido por outra escolha.`);continue;}
      seen[option.kind]?.add(option.value);
      if(option.kind==='spell')result.spells.push(option.value);else result[`${option.kind}s`].add(option.value);
    }
  }
  return {errors,proficiencies:[...result.proficiencies],skills:[...result.skills],expertise:[...result.expertise],protections:[...result.protections],languages:[...result.languages],spells:result.spells,notes:result.notes};
}

export function actorTrainingUpdate(resolved,{force=false}={}) {
  if(resolved.errors.length&&!force)throw Error(resolved.errors.join(' '));
  const update={'system.proficiencies':resolved.proficiencies,'system.languages':resolved.languages};
  for(const id of resolved.skills)update[`system.skills.${id}.value`]=1;
  for(const id of resolved.expertise??[])update[`system.skills.${id}.value`]=2;
  for(const id of resolved.protections)update[`system.abilities.${id}.proficient`]=true;
  return update;
}
