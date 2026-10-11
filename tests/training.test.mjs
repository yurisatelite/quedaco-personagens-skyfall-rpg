import test from 'node:test';
import assert from 'node:assert/strict';
import {buildTrainingPlan,resolveTraining,actorTrainingUpdate} from '../src/training.mjs';

test('Combatente recebe bases e exige escolhas sem duplicar antecedente',()=>{
  const plan=buildTrainingPlan('Combatente','Militar','int',{},1,[]);
  const choices={'class-protection':['protection:str'],'class-skills':['skill:cult','skill:perc'],'class-language':['language:bo'],'background-skills':['skill:medi'],'background-languages':['language:kia']};
  const resolved=resolveTraining(plan,choices);
  assert.deepEqual(resolved.errors,[]);assert.deepEqual(resolved.proficiencies,['simple','martial','light','heavy','shield']);
  assert.ok(resolved.skills.includes('fitn'));assert.ok(resolved.skills.includes('navi'));assert.ok(resolved.skills.includes('medi'));assert.ok(resolved.protections.includes('con'));assert.ok(resolved.protections.includes('str'));
  const update=actorTrainingUpdate(resolved);assert.equal(update['system.skills.fitn.value'],1);assert.equal(update['system.abilities.str.proficient'],true);
});

test('Especialista alterna corretamente entre aptidões e três idiomas',()=>{
  const base={'specialist-mode':['mode:aptitudes']};
  const plan=buildTrainingPlan('Especialista','Agouro','int',base,0,[]);
  assert.ok(plan.groups.some(group=>group.id==='specialist-aptitudes'));assert.equal(plan.groups.find(group=>group.id==='class-languages').count,1);
  const languages=buildTrainingPlan('Especialista','Agouro','int',{'specialist-mode':['mode:languages']},0,[]);
  assert.equal(languages.groups.find(group=>group.id==='class-languages').count,3);
});

test('Ocultista não aceita proteção ou perícia duplicada',()=>{
  const plan=buildTrainingPlan('Ocultista','Erudito','int',{},2,[{uuid:'spell-a',name:'Luz'}]);
  const choices={'class-protection':['protection:int'],'occultist-core-skill':['skill:arca'],'class-skills':['skill:arca','skill:cult','skill:perc'],'class-languages':['language:bo','language:kia'],'background-skills':['skill:doct','skill:medi'],'background-languages':['language:anuri','language:celestial','language:draconic'],'intelligence-bonus':['spell:spell-a']};
  const resolved=resolveTraining(plan,choices);
  assert.ok(resolved.errors.some(error=>error.includes('INT')&&error.includes('já foi concedido')));assert.ok(resolved.errors.some(error=>error.includes('Arcanismo')&&error.includes('já foi concedido')));
});

test('todos os 20 antecedentes têm treinamento mapeado',()=>{
  const names=['Agente de organização','Agouro','Aristocrata','Artista','Assistente Magitec','Caçador','Comerciante','Contrabandista','Cosmopolita','Detetive','Devedor','Erudito','Estudioso Feérico','Herói do Povo','Juramentado','Militar','Navegante','Procurado','Proletário','Viajante Intrépido'];
  for(const name of names)assert.doesNotThrow(()=>buildTrainingPlan('Combatente',name,'int',{},0,[]),name);
});

test('Aptidão genérica exige escolher qual e concede a aptidão específica',()=>{
  const plan=buildTrainingPlan('Ocultista','Artista','int',{},0,[]);
  const base={'class-protection':['protection:dex'],'occultist-core-skill':['skill:arca'],'class-skills':['skill:apti','skill:cult','skill:doct'],'class-languages':['language:elvish','language:kia'],'background-skills':['skill:pres'],'background-languages':['language:bo']};
  const pendente=resolveTraining(plan,base);
  assert.ok(pendente.errors.some(error=>error.includes('escolha qual Aptidão')));
  const pronto=resolveTraining(plan,{...base,'class-skills:apti':['forg']});
  assert.deepEqual(pronto.errors,[]);
  assert.ok(pronto.skills.includes('forg'));
  assert.ok(!pronto.skills.includes('apti'));
});

test('Navegação sai da lista genérica de perícias (entra pela Aptidão)',()=>{
  const plan=buildTrainingPlan('Especialista','Agouro','',{},0,[]);
  const skills=plan.groups.find(group=>group.id==='class-skills').options.map(option=>option.value);
  assert.ok(skills.includes('apti'));
  assert.ok(!skills.includes('navi'));
});
