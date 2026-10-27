import test from 'node:test';
import assert from 'node:assert/strict';
import {actorFolders,creationFolder,configurePlayerCreation,registerPlayerAccess,PLAYER_FOLDER_KEY} from '../src/player-access.mjs';
import {createDraft,MODULE_ID} from '../src/adapter.mjs';

function world({isGM=true,enabled=false,folderId=''}={}){
  const folders=new Map([
    ['dragon',{id:'dragon',name:'Jogadores Era do Dragão',type:'Actor'}],
    ['cravokia',{id:'cravokia',name:'Jogadores 2 Era Cravokia',type:'Actor'}],
    ['journal',{id:'journal',name:'Segredos',type:'JournalEntry'}]
  ]);
  folders[Symbol.iterator]=function*(){yield* this.values();};
  const values=new Map([['core.permissions',{ACTOR_CREATE:[2,3,4],ITEM_CREATE:[3,4]}]]),writes=[];
  const game={user:{id:'rafael',isGM,can:()=>true},folders,system:{id:'skyfall'},version:'13.351',writes,
    settings:{register:(scope,key,definition)=>values.set(`${scope}.${key}`,structuredClone(definition.default)),
      get:(scope,key)=>values.get(`${scope}.${key}`),set:async(scope,key,value)=>{writes.push([scope,key,value]);values.set(`${scope}.${key}`,value);}}};
  registerPlayerAccess(game);values.set(`${MODULE_ID}.allowPlayerCreation`,enabled);values.set(`${MODULE_ID}.${PLAYER_FOLDER_KEY}`,folderId);
  return game;
}
test('pasta por ID distingue campanhas e mostra hierarquia somente de Atores',()=>{
  const game=world({folderId:'cravokia'});
  assert.equal(creationFolder(game),'cravokia');
  assert.deepEqual(actorFolders(game).map(folder=>folder.id),['cravokia','dragon']);
  game.folders.get('cravokia').folder='dragon';
  assert.equal(actorFolders(game).find(folder=>folder.id==='cravokia').label,'Jogadores Era do Dragão / Jogadores 2 Era Cravokia');
});
test('pasta removida ou de outro tipo bloqueia criação, sem fallback para raiz',()=>{
  for(const folderId of ['removida','journal'])assert.throws(()=>creationFolder(world({folderId})),/pasta/);
  assert.throws(()=>creationFolder(world({isGM:false})),/pasta/);
  assert.equal(creationFolder(world()),null);
});
test('configuração exige Mestra ativa, booleano e pasta válida antes de qualquer escrita',async()=>{
  const game=world({isGM:false});
  await assert.rejects(configurePlayerCreation({enabled:true,folderId:'cravokia'},{game}),/Mestra/);
  game.user.isGM=true;game.users={activeGM:{id:'outra'}};
  await assert.rejects(configurePlayerCreation({enabled:true,folderId:'cravokia'},{game}),/ativa/);
  delete game.users;
  await assert.rejects(configurePlayerCreation({enabled:'sim',folderId:'cravokia'},{game}),/ligado/);
  for(const folderId of ['','removida','journal'])await assert.rejects(configurePlayerCreation({enabled:true,folderId},{game}),/pasta/);
  assert.equal(game.writes.length,0);
});
test('libera na pasta selecionada e restaura apenas permissões concedidas pelo módulo',async()=>{
  const game=world();
  await configurePlayerCreation({enabled:true,folderId:'cravokia'},{game});
  assert.equal(game.settings.get(MODULE_ID,PLAYER_FOLDER_KEY),'cravokia');
  assert.equal(game.settings.get(MODULE_ID,'allowPlayerCreation'),true);
  assert.deepEqual(game.settings.get('core','permissions'),{ACTOR_CREATE:[2,3,4,1],ITEM_CREATE:[3,4]});
  await configurePlayerCreation({enabled:false,folderId:'cravokia'},{game});
  assert.deepEqual(game.settings.get('core','permissions').ACTOR_CREATE,[2,3,4]);
});
test('criação usa conta da sessão e pasta configurada, ignorando campos do rascunho',async()=>{
  const previousGame=globalThis.game,previousActor=globalThis.Actor;let calls=0;
  globalThis.game=world({isGM:false,enabled:true,folderId:'cravokia'});
  globalThis.Actor={create:async source=>{calls++;return source;}};
  const draft={name:'Viajante',attributes:{str:0,dex:1,con:2,int:3,wis:0,cha:-1},cash:0,selections:{},folder:'dragon',userId:'outro',ownership:{default:3,outro:3}};
  try{
    const actor=await createDraft(draft);
    assert.equal(actor.folder,'cravokia');assert.deepEqual(actor.ownership,{default:0,rafael:3});assert.equal(actor.flags[MODULE_ID].creator,'rafael');
    game.folders.delete('cravokia');await assert.rejects(createDraft(draft),/pasta/);assert.equal(calls,1);
  }finally{globalThis.game=previousGame;globalThis.Actor=previousActor;}
});
