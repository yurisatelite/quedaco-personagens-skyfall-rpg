import test from 'node:test';
import assert from 'node:assert/strict';

test('botão da Mestra liga/desliga; entrada do jogador acompanha a permissão',async()=>{
  const callbacks=new Map(),values=new Map([['core.permissions',{ACTOR_CREATE:[3,4]}]]),definitions=new Map();
  class Element{
    constructor(){this.dataset={};this.children=[];this.listeners={};this.disabled=false;}
    querySelector(selector){
      if(selector==='.directory-header')return this;
      if(selector==='[data-quedaco-player-access]')return this.children.find(child=>Object.hasOwn(child.dataset,'quedacoPlayerAccess'));
      if(selector==='[data-quedaco-character-creator]')return this.children.find(child=>Object.hasOwn(child.dataset,'quedacoCharacterCreator'));
      return null;
    }
    prepend(child){child.parent=this;this.children.unshift(child);}
    remove(){this.parent.children=this.parent.children.filter(child=>child!==this);}
    addEventListener(name,callback){this.listeners[name]=callback;}
    setAttribute(name,value){this[name]=value;}
  }
  globalThis.HTMLElement=Element;
  globalThis.document={createElement:()=>new Element(),querySelector:()=>null};
  globalThis.Hooks={once:(key,fn)=>callbacks.set(key,fn),on:(key,fn)=>callbacks.set(key,fn)};
  globalThis.foundry={applications:{api:{ApplicationV2:class{}}}};
  const game=globalThis.game={system:{id:'skyfall'},version:'13.351',user:{id:'gm',isGM:true,can:()=>true},settings:{register(id,key,definition){definitions.set(`${id}.${key}`,definition);values.set(`${id}.${key}`,definition.default);},get:(id,key)=>values.get(`${id}.${key}`),async set(id,key,value){values.set(`${id}.${key}`,value);definitions.get(`${id}.${key}`)?.onChange?.(value);}}};
  const root=new Element();let errors=[];
  globalThis.ui={actors:{render:()=>callbacks.get('renderActorDirectory')({},root)},notifications:{error:error=>errors.push(error)}};
  try{
    const {openCreator}=await import('../src/main.mjs?player-access-bootstrap');
    callbacks.get('init')();callbacks.get('renderActorDirectory')({},root);
    let toggle=root.querySelector('[data-quedaco-player-access]');assert.match(toggle.textContent,/desligada/);
    await toggle.listeners.click({preventDefault(){},stopPropagation(){}});
    toggle=root.querySelector('[data-quedaco-player-access]');assert.match(toggle.textContent,/ligada/);assert.equal(toggle['aria-pressed'],'true');
    game.user.isGM=false;callbacks.get('renderActorDirectory')({},root);
    assert.ok(root.querySelector('[data-quedaco-character-creator]'));assert.equal(root.querySelector('[data-quedaco-player-access]'),undefined);
    game.user.isGM=true;callbacks.get('renderActorDirectory')({},root);
    await root.querySelector('[data-quedaco-player-access]').listeners.click({preventDefault(){},stopPropagation(){}});
    game.user.isGM=false;callbacks.get('renderActorDirectory')({},root);
    assert.equal(root.querySelector('[data-quedaco-character-creator]'),undefined);
    assert.equal(openCreator(),null);assert.ok(errors.some(error=>error.includes('desativou')));
  }finally{for(const key of ['HTMLElement','document','Hooks','foundry','game','ui'])delete globalThis[key];}
});
