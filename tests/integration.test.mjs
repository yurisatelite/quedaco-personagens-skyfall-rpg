import test from 'node:test';
import assert from 'node:assert/strict';
import {actorSource,addDocument,addResolvedPlan,addInventory,safeImage,applyHitPointProgression,classOrigins} from '../src/adapter.mjs';
import {auditCatalog,BOOK_CONTENT} from '../src/coverage.mjs';
import {Catalog} from '../src/catalog.mjs';
test('Actor usa t/p/k, proprietário explícito, token vinculado e texto escapado',()=>{
  const source=actorSource({name:'Teste',attributes:{str:0,dex:1,con:2,int:3,wis:0,cha:-1},cash:1027,spellcasting:'int',biography:'<script>1</script>',selections:{}},'player1');
  assert.deepEqual(source.system.currency,{k:1,p:2,t:7});assert.equal(source.system.currency.gp,undefined);assert.deepEqual(source.ownership,{default:0,player1:3});assert.equal(source.prototypeToken.actorLink,true);assert.equal(source.system.biography,'&lt;script&gt;1&lt;/script&gt;');
});
test('inclusão conserva efeitos e imagem sem modificar o compêndio',async()=>{
  const raw={_id:'original',name:'Combatente',type:'class',img:'art/class.webp',system:{level:5,hitDie:{die:'1d10',value:0}},effects:[{name:'Benefício'}]};
  let sent;
  const actor={isOwner:true,items:[],createEmbeddedDocuments:async(type,data)=>{sent=data[0];return data;}};
  await addDocument(actor,{type:'class',uuid:'Compendium.test.classes.Item.a',toObject:()=>structuredClone(raw)});
  assert.equal(sent._id,undefined);assert.equal(sent.img,raw.img);assert.deepEqual(sent.effects,raw.effects);assert.equal(sent.system.level,1);assert.equal(sent.system.initial,true);assert.equal(sent.system.hitDie.value,1);assert.equal(raw.system.level,5);
});
test('conteúdo ausente é reportado, universos alternativos incluídos',()=>{
  const items=Object.entries(BOOK_CONTENT).flatMap(([type,names])=>names.map(name=>({type,name,img:'art.webp'})));
  assert.equal(auditCatalog(items).missing.length,0);assert.equal(auditCatalog(items.filter(i=>i.name!=='Naga')).missing[0].name,'Naga');assert.equal(BOOK_CONTENT.legacy.length,16);
});
test('falha de pack e documento invisível não somem silenciosamente',async()=>{
  const game={items:[],packs:[{collection:'hidden',documentName:'Item',visible:false},{collection:'broken',documentName:'Item',visible:true,metadata:{system:'skyfall'},getIndex:async()=>{throw Error('offline')}},{collection:'ok',documentName:'Item',visible:true,metadata:{system:'skyfall',label:'Livro'},getIndex:async()=>[{_id:'1',type:'legacy',name:'Humani',img:'art.webp'}]}]};
  const catalog=await new Catalog(game).load();assert.equal(catalog.failures.length,2);assert.equal(catalog.items.length,1);assert.equal(catalog.items[0].uuid,'Compendium.ok.Item.1');
  await assert.rejects(()=>catalog.document('Compendium.other.Item.secret'));
});

test('catálogo ignora Mundo e escolhe a cópia de criação de personagem',async()=>{
  const makePack=(collection,label,id)=>({collection,documentName:'Item',visible:true,metadata:{system:'skyfall',label},getIndex:async()=>[{_id:id,type:'legacy',name:'Anuro',img:'anuro.webp',uuid:`Compendium.${collection}.Item.${id}`,system:{identifier:'anuro'}}]});
  const game={version:'13.351',system:{id:'skyfall',version:'1.0.1'},items:[{type:'legacy',name:'Anuro',uuid:'Item.world'}],packs:[makePack('world-copy','Mundo','1'),makePack('creation','Criação de Personagem','2')]};
  const catalog=await new Catalog(game).load();
  assert.equal(catalog.items.length,1);
  assert.equal(catalog.items[0].source,'Criação de Personagem');
  assert.equal(catalog.entry('Compendium.world-copy.Item.1').uuid,'Compendium.creation.Item.2');
  assert.equal(catalog.report().duplicatesRemoved,1);
});
test('legados com identifier compartilhado continuam separados no criador',async()=>{
  const names=['Anuro','Draco','Elfe','Gnomo','Humani','Kishin','Sanguir','Tatsunoko','Tôra','Urodelo','Walshie','Herculen','Petalin','Jotun','Naga','Querub'];
  const pack={collection:'creation',documentName:'Item',visible:true,metadata:{system:'skyfall',label:'Criação de Personagem'},getIndex:async()=>names.map((name,index)=>({_id:String(index),type:'legacy',name,img:'art.webp',system:{identifier:'legacy'}}))};
  const catalog=await new Catalog({items:[],packs:[pack],version:'13.351',system:{id:'skyfall',version:'1.0.1'}}).load();
  assert.deepEqual(catalog.list('legacy').map(item=>item.name),[...names].sort((a,b)=>a.localeCompare(b,'pt-BR')));
});
test('caminhos de imagem recusam protocolos executáveis e locais',()=>{
  assert.equal(safeImage('javascript:alert(1)'),'icons/svg/mystery-man.svg');assert.equal(safeImage('modules/art/portrait.webp'),'modules/art/portrait.webp');
});
test('catálogo resolve somente heranças vinculadas pelo benefício do legado',async()=>{
  const legacyUuid='Compendium.skyfall-core.character-creation.Item.legacy';
  const heritageUuid='Compendium.skyfall-core.character-creation.Item.heritage';
  const legacy={uuid:legacyUuid,visible:true,system:{benefits:[{type:'heritage',level:0,uuid:heritageUuid}]}};
  const heritage={uuid:heritageUuid,visible:true};
  const previous=globalThis.fromUuid;
  globalThis.fromUuid=async uuid=>uuid===legacyUuid?legacy:heritage;
  try {
    const catalog=new Catalog({items:[],packs:[],version:'13.351',system:{id:'skyfall',version:'1.0.1'}});
    catalog.items=[{uuid:legacyUuid,type:'legacy',name:'Legado'},{uuid:heritageUuid,type:'heritage',name:'Herança'}];
    assert.deepEqual((await catalog.linkedItems(legacyUuid,{type:'heritage',level:0})).map(i=>i.name),['Herança']);
  } finally {globalThis.fromUuid=previous;}
});
test('auditoria do grafo acusa herança solta e não confunde grant sem UUID',async()=>{
  const legacyUuid='Compendium.skyfall-core.character-creation.Item.legacy';
  const linkedUuid='Compendium.skyfall-core.character-creation.Item.linked';
  const looseUuid='Compendium.skyfall-core.character-creation.Item.loose';
  const docs=new Map([[legacyUuid,{uuid:legacyUuid,visible:true,system:{benefits:[{type:'heritage',uuid:linkedUuid},{type:'grant',uuid:'',query:'legacy;curse'}]}}],[linkedUuid,{uuid:linkedUuid,visible:true,system:{benefits:[]}}],[looseUuid,{uuid:looseUuid,visible:true,system:{benefits:[]}}]]);
  const previous=globalThis.fromUuid;globalThis.fromUuid=async uuid=>docs.get(uuid);
  try {
    const catalog=new Catalog({items:[],packs:[],version:'13.351',system:{id:'skyfall',version:'1.0.1'}});
    catalog.items=[{uuid:legacyUuid,type:'legacy',name:'Legado'},{uuid:linkedUuid,type:'heritage',name:'Ligada'},{uuid:looseUuid,type:'heritage',name:'Solta'}];
    const audit=await catalog.auditBenefits(['legacy','heritage']);
    assert.equal(audit.missing.length,0);assert.deepEqual(audit.unlinkedHeritages.map(i=>i.name),['Solta']);assert.equal(audit.benefits,2);
  } finally {globalThis.fromUuid=previous;}
});
test('plano resolvido suprime diálogos nativos apenas durante a inclusão',async()=>{
  let prompts=0,sent;
  const previous=globalThis.skyfall;
  globalThis.skyfall={applications:{BenefitsDialog:{prompt:()=>{prompts+=1;}}}};
  const document={uuid:'Compendium.book.Item.a',type:'feature',toObject:()=>({_id:'a',name:'Benefício',type:'feature',system:{origin:[]},_stats:{}})};
  const actor={isOwner:true,items:[],createEmbeddedDocuments:async(_type,sources)=>{sent=sources;globalThis.skyfall.applications.BenefitsDialog.prompt();return sources;}};
  try {
    await addResolvedPlan(actor,[{entry:{uuid:document.uuid},document,originId:'origin-a'}],{document:async()=>document});
    assert.equal(prompts,0);assert.deepEqual(sent[0].system.origin,['origin-a']);
    globalThis.skyfall.applications.BenefitsDialog.prompt();assert.equal(prompts,1);
  } finally {globalThis.skyfall=previous;}
});
test('inventário aplica a quantidade do conjunto sem alterar o compêndio',async()=>{
  const raw={_id:'source',name:'Adaga',type:'weapon',system:{quantity:1},_stats:{}};let sent;
  const document={uuid:'Compendium.book.Item.dagger',toObject:()=>structuredClone(raw)};
  const actor={isOwner:true,createEmbeddedDocuments:async(_type,data)=>{sent=data;return data;}};
  await addInventory(actor,[{entry:{uuid:document.uuid},quantity:2}],{document:async()=>document});
  assert.equal(sent[0]._id,undefined);assert.equal(sent[0].system.quantity,2);assert.equal(raw.system.quantity,1);
});

test('progressão corrige a média do Skyfall sem apagar outros bônus de vida',async()=>{
  globalThis.game={settings:{get:()=> 'mean'}};
  let update;
  const actor={items:[{type:'class',system:{initial:true,hitDie:{die:'1d10'}}}],system:{modifiers:{hp:{totalExtra:['2']}}},update:async data=>{update=data;}};
  await applyHitPointProgression(actor,{level:4,hpMethod:'fixed',hpRolls:[]});
  assert.deepEqual(update['system.modifiers.hp.levelRoll'].slice(0,4),[0,6,6,6]);
  assert.deepEqual(update['system.modifiers.hp.totalExtra'],['2','3']);
});

test('níveis de classe usam as origens nativas que a ficha Skyfall exibe manualmente',()=>{
  assert.deepEqual(classOrigins(4),['class-01','class-02','class-03','class-04']);
  assert.deepEqual(classOrigins(99).slice(-1),['class-12']);
});
