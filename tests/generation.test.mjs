import test from 'node:test';
import assert from 'node:assert/strict';
import {interpretRequest,generateCharacter,chooseTraining} from '../src/generation.mjs';
import {validateAttributes,BACKGROUNDS} from '../src/rules.mjs';
import {generationFixture,seeded} from './generation-fixture.mjs';
test('descrição reconhece anões, nível e escolhas fixas; conflitos são explícitos',()=>{
  const c=generationFixture(),r=interpretRequest(c,{text:'Quatro anões de nível 4 no passado',count:4});
  assert.equal(r.level,4);assert.equal(c.entry(r.fixed.legacy).name,'Tôra');assert.deepEqual(r.issues,[]);
  assert.equal(interpretRequest(c,{text:'nível 4',level:2}).level,2);
  assert.ok(interpretRequest(c,{text:'Combatente Especialista',count:0}).issues.length>=2);
  assert.ok(interpretRequest(c,{level:13,count:21}).issues.length>=2);
});
test('treinamento de três classes e vinte antecedentes resolve sem duplicatas em vários sorteios',()=>{
  for(const cls of ['Combatente','Especialista','Ocultista'])for(const bg of BACKGROUNDS)for(const seed of [1,14,73]){
    const result=chooseTraining(cls,bg.name,'wis',2,seeded(seed));
    assert.deepEqual(result.resolved.errors,[],`${cls} / ${bg.name}`);
    assert.equal(new Set(result.resolved.skills).size,result.resolved.skills.length);
  }
});
test('geração completa conserva legado fixo, inclui progressão até 12, dinheiro e equipamento',async()=>{
  const c=generationFixture();
  for(const cls of ['Combatente','Especialista','Ocultista'])for(const level of [1,4,12]){
    const row=await generateCharacter(c,interpretRequest(c,{text:`anão ${cls} nível ${level}`,noCurse:true}),{random:seeded(level),index:2});
    assert.deepEqual(row.issues,[],`${cls} ${level}: ${row.issues.join(' ')}`);
    assert.equal(row.draft.selections.legacy,c.list('legacy')[0].uuid);
    assert.equal(row.draft.level,level);assert.equal(row.draft.noCurse,true);
    const bases=row.draft.slots.map(i=>[3,2,1,1,0,-1][i]);
    assert.deepEqual(validateAttributes(Object.values(row.draft.attributes),'fixed',bases,row.draft.boost),[]);
    assert.ok(row.money.cash>0);assert.ok(Object.keys(row.equipmentChoices).length);
    if(level>=2)assert.ok(Object.keys(row.benefitChoices).some(key=>key.includes('path-choice|2')));
    if(level>=7)assert.ok(Object.keys(row.benefitChoices).some(key=>key.includes('path-choice|7')));
  }
});
test('ânimas usam somente características disponíveis e animal desconhecido exige revisão',async()=>{
  const c=generationFixture();
  for(const animal of ['gato','cobra','gavião']){
    const row=await generateCharacter(c,interpretRequest(c,{text:`gnomo ânima de ${animal} Combatente nível 1`}),{random:seeded()});
    assert.deepEqual(row.issues,[]);assert.equal(row.draft.animal,animal);
    const traits=Object.values(row.benefitChoices).flat().map(id=>c.entry(id)?.name);
    assert.equal(traits.includes('Dentes Afiados'),animal==='cobra');
  }
  const row=await generateCharacter(c,interpretRequest(c,{text:'gnomo ânima de tubarão Combatente nível 1'}),{random:seeded()});
  assert.ok(row.issues.some(issue=>issue.includes('perfil')));
});
test('herança fixa incompatível é rejeitada, e geração nunca chama Actor.create',async()=>{
  const c=generationFixture();globalThis.Actor={create:()=>assert.fail('Não criar Actors durante a prévia')};
  try{
    await assert.rejects(generateCharacter(c,interpretRequest(c,{text:'anão',fixed:{heritage:c.list('heritage')[1].uuid}})),/não pertence/);
    const a=await generateCharacter(c,interpretRequest(c,{text:'anão Combatente',noCurse:true}),{random:seeded(10)});
    const b=await generateCharacter(c,interpretRequest(c,{text:'anão Combatente',noCurse:true}),{random:seeded(120)});
    assert.notDeepEqual(a.draft.attributes,b.draft.attributes);
    const fixedHeritage=await generateCharacter(c,interpretRequest(c,{fixed:{heritage:c.list('heritage')[0].uuid}}),{random:seeded(82)});
    assert.equal(c.entry(fixedHeritage.draft.selections.legacy).name,'Tôra');
  }finally{delete globalThis.Actor;}
});
test('grupo conserva todos os Tôra e distribui funções de campanha sem impor escolhas futuras',async()=>{
  const c=generationFixture();
  for(const name of ['Navegante','Caçador','Comerciante','Erudito','Agouro'])c.items.push({uuid:`Compendium.fixture.Item.bg${name}`,name,type:'background',system:{benefits:[],feats:[]}});
  const request=interpretRequest(c,{text:'quatro anões de nível 4 em uma expedição ao passado',count:4});
  const rows=[];for(let index=0;index<4;index++)rows.push(await generateCharacter(c,request,{index,random:seeded(index+15)}));
  assert.equal(new Set(rows.map(row=>row.draft.selections.legacy)).size,1);
  assert.equal(new Set(rows.map(row=>row.draft.selections.background)).size,4);
  assert.equal(new Set(rows.map(row=>row.draft.name)).size,4);
  for(const row of rows){assert.deepEqual(row.issues,[]);assert.match(row.draft.biography,/Função proposta/);}
});
