import test from 'node:test';
import assert from 'node:assert/strict';
import {setPlayerCreationEnabled} from '../src/player-access.mjs';

test('um único botão abre o criador original; configuração fica dentro da mesma aplicação',async()=>{
  const callbacks=new Map(),values=new Map([['core.permissions',{ACTOR_CREATE:[3,4]}]]),definitions=new Map();
  class Element{
    constructor(){this.dataset={};this.children=[];this.listeners={};}
    querySelector(selector){
      if(selector==='.directory-header')return this;
      if(selector==='[data-quedaco-player-access]')return this.children.find(child=>Object.hasOwn(child.dataset,'quedacoPlayerAccess'));
      if(selector==='[data-quedaco-character-creator]')return this.children.find(child=>Object.hasOwn(child.dataset,'quedacoCharacterCreator'));
      return null;
    }
    prepend(child){child.parent=this;this.children.unshift(child);}
    remove(){this.parent.children=this.parent.children.filter(child=>child!==this);}
    addEventListener(name,callback){this.listeners[name]=callback;}
  }
  globalThis.HTMLElement=Element;
  globalThis.document={createElement:()=>new Element(),querySelector:()=>null};
  globalThis.Hooks={once:(key,fn)=>callbacks.set(key,fn),on:(key,fn)=>callbacks.set(key,fn)};
  globalThis.foundry={applications:{api:{ApplicationV2:class{}}}};
  const game=globalThis.game={system:{id:'skyfall'},version:'13.351',user:{id:'gm',isGM:true,can:()=>true},settings:{register(id,key,definition){definitions.set(`${id}.${key}`,definition);values.set(`${id}.${key}`,definition.default);},get:(id,key)=>values.get(`${id}.${key}`),async set(id,key,value){values.set(`${id}.${key}`,value);definitions.get(`${id}.${key}`)?.onChange?.(value);}}};
  const root=new Element(),errors=[];
  globalThis.ui={actors:{render:()=>callbacks.get('renderActorDirectory')({},root)},notifications:{error:error=>errors.push(error)}};
  try{
    const {openCreator}=await import('../src/main.mjs?single-entry');
    const {CreatorApp}=await import('../src/app.mjs');
    const original=CreatorApp.prototype.start;
    CreatorApp.prototype.start=function(){return this;};
    try{
      callbacks.get('init')();callbacks.get('renderActorDirectory')({},root);callbacks.get('renderActorDirectory')({},root);
      assert.equal(root.children.length,1);assert.equal(root.querySelector('[data-quedaco-player-access]'),undefined);
      const app=openCreator();assert.ok(app instanceof CreatorApp);assert.equal(app.screen,'home');
      app.loading=false;
      const html=await app._renderHTML();assert.match(html,/Passo a passo/);assert.match(html,/Personagem aleatório/);assert.match(html,/Grupo por descrição/);assert.match(html,/data-op="settings"/);
      await setPlayerCreationEnabled(true,{game});game.user.isGM=false;callbacks.get('renderActorDirectory')({},root);
      assert.equal(root.children.length,1);
      const playerApp=openCreator();playerApp.loading=false;const playerHtml=await playerApp._renderHTML();
      assert.doesNotMatch(playerHtml,/Grupo por descrição|data-op="settings"/);
      game.user.isGM=true;await setPlayerCreationEnabled(false,{game});game.user.isGM=false;callbacks.get('renderActorDirectory')({},root);
      assert.equal(root.children.length,0);assert.equal(openCreator(),null);assert.ok(errors.some(error=>error.includes('desativou')));
    }finally{CreatorApp.prototype.start=original;}
  }finally{for(const key of ['HTMLElement','document','Hooks','foundry','game','ui'])delete globalThis[key];}
});
