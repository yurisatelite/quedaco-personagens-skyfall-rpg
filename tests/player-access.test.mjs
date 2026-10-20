import test from 'node:test';
import assert from 'node:assert/strict';
import {assertCreatorAccess,registerPlayerAccess,setPlayerCreationEnabled,playerCreationEnabled} from '../src/player-access.mjs';
import {createDraft,MODULE_ID} from '../src/adapter.mjs';
function setup(nativeRoles=[2,3,4]){
  const storage=new Map([['core.permissions',{ACTOR_CREATE:nativeRoles,ITEM_CREATE:[3,4]}]]),settings=new Map();
  const game={version:'13.351',system:{id:'skyfall'},user:{id:'gm',isGM:true,can:()=>true},settings:{register(id,key,value){settings.set(`${id}.${key}`,value);storage.set(`${id}.${key}`,structuredClone(value.default));},get:(id,key)=>structuredClone(storage.get(`${id}.${key}`)),async set(id,key,value){storage.set(`${id}.${key}`,structuredClone(value));settings.get(`${id}.${key}`)?.onChange?.(value);return value;}}};
  registerPlayerAccess(game);return {game,storage};
}
test('padrão desligado, acesso da Mestra preservado; jogadores só com duas permissões',async()=>{
  const {game}=setup();assert.equal(playerCreationEnabled(game),false);assert.doesNotThrow(()=>assertCreatorAccess(game));
  game.user.isGM=false;assert.throws(()=>assertCreatorAccess(game),/desativou/);
  await assert.rejects(setPlayerCreationEnabled(true,{game}),/Mestra/);
  game.user.isGM=true;await setPlayerCreationEnabled(true,{game});game.user.isGM=false;
  assert.doesNotThrow(()=>assertCreatorAccess(game));game.user.can=()=>false;assert.throws(()=>assertCreatorAccess(game),/permissão/);
});
test('liga concede papéis de jogadores; desliga restaura somente concessões próprias',async()=>{
  const {game}=setup();
  await setPlayerCreationEnabled(true,{game});await setPlayerCreationEnabled(true,{game});
  assert.deepEqual(game.settings.get('core','permissions'),{ACTOR_CREATE:[2,3,4,1,2].filter((n,i,a)=>a.indexOf(n)===i),ITEM_CREATE:[3,4]});
  await setPlayerCreationEnabled(false,{game});assert.equal(playerCreationEnabled(game),false);
  assert.deepEqual(game.settings.get('core','permissions'),{ACTOR_CREATE:[2,3,4],ITEM_CREATE:[3,4]});
  await setPlayerCreationEnabled(false,{game});assert.deepEqual(game.settings.get('core','permissions').ACTOR_CREATE,[2,3,4]);
});
test('fechar acesso bloqueia createDraft em janela já aberta sem tocar Actors existentes',async()=>{
  const {game}=setup();globalThis.game=game;let calls=0;globalThis.Actor={async create(data){calls++;return data;}};
  await setPlayerCreationEnabled(true,{game});game.user={id:'player',isGM:false,can:()=>true};
  const draft={name:'Aventureiro',attributes:{str:1,dex:2,con:1,int:0,wis:0,cha:-1},cash:0};
  const actor=await createDraft(draft);assert.equal(calls,1);assert.equal(actor.ownership.player,3);assert.equal(actor.ownership.default,0);
  game.user.isGM=true;await setPlayerCreationEnabled(false,{game});game.user.isGM=false;
  await assert.rejects(createDraft(draft),/desativou/);assert.equal(calls,1);assert.equal(actor.ownership.player,3);
  delete globalThis.game;delete globalThis.Actor;
});
test('falha parcial conserva dados de restauração e nunca liga antes da permissão',async()=>{
  const {game}=setup([3,4]);const original=game.settings.set;
  game.settings.set=async(id,key,value)=>{if(id==='core')throw Error('sem conexão');return original(id,key,value);};
  await assert.rejects(setPlayerCreationEnabled(true,{game}),/conexão/);assert.equal(playerCreationEnabled(game),false);
  game.settings.set=original;await setPlayerCreationEnabled(false,{game});assert.deepEqual(game.settings.get('core','permissions').ACTOR_CREATE,[3,4]);
});
