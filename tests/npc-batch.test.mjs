import test from 'node:test';
import assert from 'node:assert/strict';
import {prepareNpcBatch,createNpcBatch} from '../src/npc-templates.mjs';
const ID='quedaco-personagens-skyfall-rpg';
const model={id:'arena:mara',name:'Mara',legacy:'Anuro',heritage:'Bufonin',characterClass:'Combatente',background:'Militar',level:1,cash:12,attributes:{str:3,dex:1,con:2,int:0,wis:2,cha:-1},inventory:[],teamId:'norte',relations:[]};
function fixture(){
  const uuid=id=>`Compendium.teste.Item.${id}`;
  const documents=[{id:'legacy',name:'Anuro',type:'legacy',benefits:[{_id:'heritage',type:'heritage',level:0,uuid:uuid('heritage')}]},{id:'heritage',name:'Bufonin',type:'heritage'},{id:'class',name:'Combatente',type:'class'},{id:'background',name:'Militar',type:'background'}].map(row=>({uuid:uuid(row.id),name:row.name,type:row.type,visible:true,system:{benefits:row.benefits??[]},toObject(){return {name:this.name,type:this.type,system:structuredClone(this.system)};}}));
  const game={user:{id:'gm',isGM:true},actors:[],version:'13.351',system:{id:'skyfall'},packs:[{collection:'teste',documentName:'Item',metadata:{system:'skyfall',label:'Criação de personagem'},getIndex:async()=>documents}]};
  for(const document of documents)if(document.type==='class')document.system.hitDie={die:'d10',value:1};
  const ActorClass={async create(source){
    const actor={...structuredClone(source),uuid:`Actor.a${game.actors.length}`,isOwner:true,items:[],system:{...source.system,level:{value:1},resources:{hp:{max:10},ep:{max:3}}},async update(changes){for(const [path,value] of Object.entries(changes)){const keys=path.split('.');let obj=this;for(const key of keys.slice(0,-1))obj=obj[key]??={};obj[keys.at(-1)]=value;}},async createEmbeddedDocuments(_kind,sources){if(this.name==='Falha')throw Error('Falha de item simulada');this.items.push(...sources);return sources;}};
    game.actors.push(actor);return actor;
  }};
  return {game,ActorClass,documents,resolve:async id=>documents.find(row=>row.uuid===id)};
}
test('prévia completa, erros por NPC, assinatura e conflitos bloqueiam antes de criar',async()=>{
  const f=fixture(),previous=globalThis.fromUuid;globalThis.fromUuid=f.resolve;
  try{
    const batch={name:'Arena',npcs:[model,{...model,id:'arena:b',name:'B'}]};
    const preview=await prepareNpcBatch(batch,{game:f.game});
    assert.equal(preview.valid,2);assert.equal(f.game.actors.length,0);assert.match(preview.signature,/^[a-f0-9]{64}$/);
    const invalid=await prepareNpcBatch({npcs:[{...model,level:99}]},{game:f.game});
    assert.equal(invalid.errors.length,1);assert.match(invalid.errors[0].error,/nível/);
    await assert.rejects(createNpcBatch({npcs:[{...model,level:99}]},{game:f.game,expectedSignature:invalid.signature}),/inválido/);
    await assert.rejects(createNpcBatch({...batch,name:'Alterado'},{game:f.game,expectedSignature:preview.signature}),/mudaram/);
    f.documents[1].system.description='Conteúdo alterado';
    await assert.rejects(createNpcBatch(batch,{game:f.game,expectedSignature:preview.signature}),/mudaram/);
    f.game.actors.push({name:'Mara'});
    assert.match((await prepareNpcBatch(batch,{game:f.game})).errors[0].error,/nome/);
  }finally{globalThis.fromUuid=previous;}
});
test('lote cria fichas, vincula relações depois, preserva idempotência e relata falha parcial',async()=>{
  const f=fixture(),previous=globalThis.fromUuid;globalThis.fromUuid=f.resolve;
  try{
    const batch={name:'Arena',npcs:[{...model,relations:[{target:'arena:b',kind:'equipe',text:'Parceiro'}]},{...model,id:'arena:b',name:'B'}]};
    const preview=await prepareNpcBatch(batch,{game:f.game});
    const report=await createNpcBatch(batch,{...f,expectedSignature:preview.signature});
    assert.equal(report.created,2);assert.equal(report.errors,0);
    assert.match(f.game.actors[0].system.biography,/@UUID\[Actor.a1\]/);
    assert.equal(f.game.actors[0].flags[ID].npcModel.teamId,'norte');
    assert.deepEqual(f.game.actors[0].ownership,{default:0,gm:3});
    const repeated=await prepareNpcBatch(batch,{game:f.game});
    assert.equal((await createNpcBatch(batch,{...f,expectedSignature:repeated.signature})).existing,2);
    assert.equal(f.game.actors.length,2);
    const failed={npcs:[{...model,id:'arena:falha',name:'Falha'},{...model,id:'arena:c',name:'C'}]};
    const pending=await prepareNpcBatch(failed,{game:f.game});
    const partial=await createNpcBatch(failed,{...f,expectedSignature:pending.signature});
    assert.equal(partial.created,1);assert.equal(partial.errors,1);
    assert.equal(f.game.actors[2].flags[ID].npcModel.state,'needs-review');
    assert.equal((await prepareNpcBatch(failed,{game:f.game})).errors.length,1);
  }finally{globalThis.fromUuid=previous;}
});
