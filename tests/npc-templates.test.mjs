import test from 'node:test';
import assert from 'node:assert/strict';
import {prepareNpcTemplate,createNpcFromTemplate,refreshNpcTemplateRelations,prepareNpcBatch} from '../src/npc-templates.mjs';
const ID='quedaco-personagens-skyfall-rpg';
const model={id:'agente-teste',name:'Agente de teste',legacy:'Anuro',heritage:'Bufonin',characterClass:'Combatente',background:'Militar',level:1,cash:12,attributes:{str:3,dex:1,con:2,int:0,wis:2,cha:-1},inventory:[]};
test('API de modelos exige mestre e campos concretos antes de carregar compêndios',async()=>{
  await assert.rejects(prepareNpcTemplate(model,{game:{user:{isGM:false}}}),/Mestra/);
  const game={user:{isGM:true},system:{id:'skyfall'},version:'13.351'};
  await assert.rejects(prepareNpcTemplate({...model,level:20},{game}),/nível/);
  await assert.rejects(prepareNpcTemplate({...model,attributes:{str:3}},{game}),/seis/);
});
test('idempotência devolve o Actor existente; nomes coincidentes não são adotados',async()=>{
  const game={user:{isGM:true},actors:[{name:'Outra ficha',uuid:'Actor.a',flags:{[ID]:{npcModel:{id:model.id,state:'created'}}}}]};
  assert.deepEqual(await createNpcFromTemplate(model,{game}),{status:'existing',actorUuid:'Actor.a'});
  game.actors=[{name:model.name,uuid:'Actor.b',hasPlayerOwner:true}];
  await assert.rejects(createNpcFromTemplate(model,{game}),/nome/);
});
test('relações mexem só no bloco marcado da ficha criada pelo Criador',async()=>{
  let writes=0;
  const actor={uuid:'Actor.abc',flags:{[ID]:{npcModel:{id:model.id,state:'created'}}},system:{biography:'<p>Texto editado</p><ul data-npc-model-relations="true"></ul>'},async update(data){this.system.biography=data['system.biography'];writes++;}};
  const target={uuid:'Actor.def',name:'Colega',flags:{[ID]:{npcModel:{id:'colega',state:'created'}}}};
  const game={user:{isGM:true},actors:[actor,target]};
  await refreshNpcTemplateRelations({...model,relations:[{target:'colega',name:'Colega',kind:'parceria',text:'Confia no colega.'}]},{game});
  assert.match(actor.system.biography,/@UUID\[Actor.def\]/);assert.match(actor.system.biography,/Texto editado/);
  await refreshNpcTemplateRelations({...model,relations:[{target:'colega',name:'Colega',kind:'parceria',text:'Confia no colega.'}]},{game});
  assert.equal(writes,1);
  actor.system.biography='<p>Bio substituída à mão</p>';
  assert.equal(await refreshNpcTemplateRelations(model,{game}),false);assert.equal(writes,1);
});

test('prévia resolve compêndio fictício e assinatura muda com inventário ou modelo',async()=>{
  const uuid=id=>`Compendium.teste.Item.${id}`;
  const documents=[
    {id:'legado',name:'Anuro',type:'legacy',benefits:[{_id:'heranca',type:'heritage',level:0,uuid:uuid('heranca')}]},
    {id:'heranca',name:'Bufonin',type:'heritage'},
    {id:'classe',name:'Combatente',type:'class'},
    {id:'origem',name:'Militar',type:'background'},
    {id:'item',name:'Lança',type:'weapon'}
  ].map(row=>({uuid:uuid(row.id),name:row.name,type:row.type,visible:true,system:{benefits:row.benefits??[],capacity:1,quantity:1},toObject(){return {name:this.name,type:this.type,system:structuredClone(this.system)};}}));
  const game={user:{isGM:true},actors:[],version:'13.351',system:{id:'skyfall'},packs:[{collection:'teste',documentName:'Item',metadata:{system:'skyfall',label:'Criação de personagem'},getIndex:async()=>documents}]};
  const previous=globalThis.fromUuid;globalThis.fromUuid=async id=>documents.find(row=>row.uuid===id);
  try{
    const first=await prepareNpcTemplate({...model,inventory:[{name:'Lança',quantity:1}]},{game});
    assert.match(first.signature,/^[0-9a-f]{64}$/);assert.equal(first.volume,1);assert.match(first.inventory,/Lança/);
    const changed=await prepareNpcTemplate({...model,cash:30,inventory:[{name:'Lança',quantity:1}]},{game});
    assert.notEqual(first.signature,changed.signature);
    let creates=0;
    await assert.rejects(createNpcFromTemplate({...model,cash:30,inventory:[{name:'Lança',quantity:1}]},{game,expectedSignature:first.signature,ActorClass:{create:async()=>{creates++;}}}),/mudaram/);
    assert.equal(creates,0);
  }finally{globalThis.fromUuid=previous;}
});

test('lotes exigem IDs estáveis, limitam tamanho e não carregam para jogadores',async()=>{
  await assert.rejects(prepareNpcBatch({npcs:[model]},{game:{user:{isGM:false}}}),/Mestra/);
  const game={user:{isGM:true},system:{id:'skyfall'},version:'13.351'};
  await assert.rejects(prepareNpcBatch({npcs:[model,{...model,name:'Outro'}]},{game}),/ID de NPC repetido/);
  await assert.rejects(prepareNpcBatch({npcs:Array.from({length:201},(_,i)=>({...model,id:`npc-${i}`}))},{game}),/200/);
});

function dependencyFixture(rows){
  const uuid=id=>`Compendium.dependencies.Item.${id}`;
  const documents=rows.map(row=>({uuid:uuid(row.id),name:row.name,type:row.type,visible:true,system:{benefits:[],...row.system},toObject(){return {name:this.name,type:this.type,system:structuredClone(this.system)};}}));
  documents.push({uuid:uuid('legacy'),name:'Anuro',type:'legacy',visible:true,system:{benefits:[{_id:'heritage',type:'heritage',level:0,uuid:uuid('heritage')}]},toObject(){return {name:this.name,type:this.type,system:this.system};}},...['heritage','background'].map((type,index)=>({uuid:uuid(type),name:index?'Militar':'Bufonin',type,visible:true,system:{},toObject(){return {name:this.name,type:this.type,system:this.system};}})));
  return {uuid,resolve:async id=>documents.find(row=>row.uuid===id),game:{user:{isGM:true},actors:[],version:'13.351',system:{id:'skyfall'},packs:[{collection:'dependencies',documentName:'Item',metadata:{system:'skyfall',label:'Criação de personagem'},getIndex:async()=>documents}]}};
}

test('talento de Especialista espera a trilha escolhida antes de declarar compêndio vazio',async()=>{
  const f=dependencyFixture([
    {id:'class',name:'Especialista',type:'class',system:{benefits:[{_id:'feat',type:'grant',granting:'feat',query:'path',level:2}]}},
    {id:'path',name:'Malandro',type:'path',system:{feats:['Compendium.dependencies.Item.feat']}},
    {id:'feat',name:'Talento da trilha',type:'feat'}
  ]),previous=globalThis.fromUuid;globalThis.fromUuid=f.resolve;
  try{
    const preview=await prepareNpcTemplate({...model,characterClass:'Especialista',path:'Malandro',level:2},{game:f.game});
    assert.ok(Object.values(preview.choices).flat().includes(f.uuid('feat')));
    await assert.rejects(prepareNpcTemplate({...model,characterClass:'Especialista',path:'Ausente',level:2},{game:f.game}),/opções válidas/);
  }finally{globalThis.fromUuid=previous;}
});

test('façanha automática corresponde ao estilo e escolha explícita incompatível continua bloqueada',async()=>{
  const u=id=>`Compendium.dependencies.Item.${id}`;
  const f=dependencyFixture([
    {id:'class',name:'Combatente',type:'class',system:{benefits:[{_id:'style',type:'grant',granting:'feat',query:'fighting-style',level:1},{_id:'prowess',type:'feature',uuid:u('prowess'),level:1},{_id:'styles',type:'feature',uuid:u('styles'),level:1}]}},
    {id:'styles',name:'Estilos',type:'feature',system:{identifier:'fighting-style',feats:[u('distance'),u('shield')]}},
    {id:'prowess',name:'Façanhas de combate',type:'feature',system:{identifier:'combat-prowess',feats:[u('pshield'),u('pdistance')],benefits:[{_id:'pick',type:'grant',granting:'feat',query:'combat-prowess',level:0}]}},
    {id:'distance',name:'Combate com Arma à Distância',type:'feat'},
    {id:'shield',name:'Combate com Escudo',type:'feat'},
    {id:'pshield',name:'Façanha com Escudo',type:'feat'},
    {id:'pdistance',name:'Façanha com Arma à Distância',type:'feat'}
  ]),previous=globalThis.fromUuid;globalThis.fromUuid=f.resolve;
  try{
    const preview=await prepareNpcTemplate(model,{game:f.game});
    assert.ok(Object.values(preview.choices).flat().includes(u('pdistance')));
    const key=Object.keys(preview.choices).find(id=>id.includes('|combat-prowess|'));
    await assert.rejects(prepareNpcTemplate({...model,benefitChoices:{[key]:[u('pshield')]}},{game:f.game}),/explícitas incompatíveis/);
  }finally{globalThis.fromUuid=previous;}
});
