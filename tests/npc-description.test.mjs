import test from 'node:test';
import assert from 'node:assert/strict';
import {prepareNpcDescription,getNpcCreationCatalog} from '../src/npc-description.mjs';
const u=id=>`Compendium.test.Item.${id}`;
function fixture(){
  const grant=(id,query,quantity)=>({_id:id,type:'grant',granting:'feat',query,quantity});
  const docs=[
    {id:'anuro',name:'Anuro',type:'legacy',benefits:[{_id:'h',type:'heritage',uuid:u('bufonin')}]},
    {id:'bufonin',name:'Bufonin',type:'heritage'},
    {id:'gnomo',name:'Gnomo',type:'legacy',benefits:[{_id:'h',type:'heritage',uuid:u('gnomeh')},{_id:'h2',type:'heritage',uuid:u('gnomeh2')}]},
    {id:'gnomeh',name:'1 Herança Maior e 2 Menores',type:'heritage',benefits:[{_id:'m',type:'feature',uuid:u('major')},{_id:'n',type:'feature',uuid:u('minor')}]},
    {id:'gnomeh2',name:'2 Heranças Maiores',type:'heritage',benefits:[{_id:'m2',type:'feature',uuid:u('major2')}]},
    {id:'major2',name:'Duas maiores',type:'feature',identifier:'major2',feats:['predador','dentes'],benefits:[grant('choose-major2','major2',2)]},
    {id:'major',name:'Heranças maiores',type:'feature',identifier:'major',feats:['predador','dentes'],benefits:[grant('choose-major','major',1)]},
    {id:'minor',name:'Heranças menores',type:'feature',identifier:'minor',feats:['escalador','camuflagem','corredor','oportunista'],benefits:[grant('choose-minor','minor',2)]},
    ...['predador','dentes','escalador','camuflagem','corredor','oportunista'].map((id,i)=>({id,type:'feat',name:['Predador','Dentes Afiados','Escalador','Camuflagem','Corredor','Oportunista'][i]})),
    {id:'cls',name:'Combatente',type:'class'},{id:'bg',name:'Militar',type:'background'},
    {id:'path',name:'Protetor dos Ermos',type:'path'},{id:'weapon',name:'Adaga',type:'weapon'}
  ].map(row=>({uuid:u(row.id),name:row.name,type:row.type,visible:true,system:{identifier:row.identifier,benefits:row.benefits??[],feats:(row.feats??[]).map(u),hitDie:{die:'d10'},capacity:1},toObject(){return {name:this.name,type:this.type,system:structuredClone(this.system)};}}));
  const game={user:{id:'gm',isGM:true},version:'13.351',system:{id:'skyfall'},actors:[],packs:[{collection:'test',documentName:'Item',metadata:{system:'skyfall',label:'Criação de personagem'},getIndex:async()=>docs}]};
  const profiles=[{id:'lutador',name:'Lutador',kind:'purpose',terms:['guarda','batedora'],characterClass:'Combatente',background:'Militar',attributes:{str:3,dex:1,con:2,int:0,wis:2,cha:-1},inventory:[{name:'Adaga',quantity:1}],names:['Nara'],keywords:['defesa']},...[
    ['gato',['Predador','Escalador','Camuflagem']],['cobra',['Dentes Afiados','Escalador','Camuflagem']],['gavião',['Predador','Corredor','Oportunista']]
  ].map(([animal,choicePriority])=>({id:animal,name:animal,kind:'animal',terms:[animal],heritage:'1 Herança Maior e 2 Menores',choicePriority}))];
  return {game,profiles,context:{summary:'Arquipélago de Huma',regionId:'huma'},resolve:async uuid=>docs.find(doc=>doc.uuid===uuid)};
}
test('descrição resolve legado, nível, propósito, equipamento e escolhas até o nível pedido',async()=>{
  const f=fixture(),previous=globalThis.fromUuid;globalThis.fromUuid=f.resolve;
  try{
    const result=await prepareNpcDescription({id:'teste:guarda',text:'Um Anuro guarda em Huma nível 3'},{...f});
    assert.equal(result.state,'ready',JSON.stringify(result.issues));assert.equal(result.model.level,3);assert.equal(result.model.background,'Militar');
    assert.ok(Object.values(result.model.benefitChoices).flat().includes(u('path')));assert.equal(f.game.actors.length,0);
    const same=await prepareNpcDescription({id:'teste:guarda',text:'Um Anuro guarda em Huma nível 3'},{...f});assert.equal(result.signature,same.signature);
  }finally{globalThis.fromUuid=previous;}
});
test('ânima orienta heranças concretas, preserva decisões e pede informação quando falta',async()=>{
  const f=fixture(),previous=globalThis.fromUuid;globalThis.fromUuid=f.resolve;
  try{
    const byAnimal={};
    for(const animal of ['gato','cobra','gavião']){
      const result=await prepareNpcDescription({id:`teste:${animal==='gavião'?'gaviao':animal}`,text:`Uma gnoma com ânima de ${animal}, batedora em Huma, nível 1`},{...f});
      assert.equal(result.state,'ready',JSON.stringify(result.issues));assert.equal(result.model.anima,animal);
      byAnimal[animal]=Object.values(result.model.benefitChoices).flat();
    }
    assert.ok(byAnimal.cobra.includes(u('dentes')));assert.ok(byAnimal.gato.includes(u('predador')));assert.ok(byAnimal['gavião'].includes(u('corredor')));
    const missing=await prepareNpcDescription({id:'teste:missing',text:'Uma gnoma batedora em Huma nível 1'},{...f});assert.equal(missing.state,'needs-choices');assert.ok(missing.issues.some(issue=>issue.includes('animal')));
    f.profiles.find(profile=>profile.id==='gato').choicePriority=['Inexistente'];
    const invalid=await prepareNpcDescription({id:'teste:bad',text:'Uma gnoma batedora com ânima de gato nível 1'},{...f});assert.equal(invalid.state,'needs-choices');
  }finally{globalThis.fromUuid=previous;}
});
test('Tritão ausente, nível ausente, propósito desconhecido e acesso de jogador não são inventados',async()=>{
  const f=fixture(),previous=globalThis.fromUuid;globalThis.fromUuid=f.resolve;
  try{
  const triton=await prepareNpcDescription({id:'teste:tritao',text:'Cria um tritão que mora no arquipélago de Uma, guarda nível 2'},{...f});
  assert.equal(triton.state,'needs-choices');assert.ok(triton.issues.some(issue=>issue.includes('Tritão')));
  await assert.rejects(getNpcCreationCatalog({game:{user:{isGM:false}}}),/Mestra/);
  const result=await prepareNpcDescription({id:'teste:pending',text:'Um Anuro em Huma'},{...f});assert.ok(result.issues.some(issue=>issue.includes('nível')));assert.ok(result.issues.some(issue=>issue.includes('Propósito')));
  }finally{globalThis.fromUuid=previous;}
});

test('perfis regionais prevalecem e estrutura de duas heranças maiores exige duas opções concretas',async()=>{
  const f=fixture(),previous=globalThis.fromUuid;globalThis.fromUuid=f.resolve;
  try{
    f.profiles.push({...f.profiles[0],id:'guarda-huma',name:'Guarda de Huma',regionIds:['huma']});
    const regional=await prepareNpcDescription({id:'teste:regional',text:'Um Anuro guarda em Huma nível 1'},{...f});
    assert.equal(regional.state,'ready');assert.ok(regional.decisions.some(row=>row.field==='profile'&&row.value==='Guarda de Huma'));
    f.profiles.find(profile=>profile.id==='cobra').choicePriority=['Predador','Dentes Afiados'];
    const both=await prepareNpcDescription({id:'teste:duas',text:'Um gnomo batedora em Huma nível 1',anima:'cobra',heritage:'2 Heranças Maiores'},{...f});
    assert.equal(both.state,'ready',JSON.stringify(both.issues));assert.deepEqual(Object.values(both.model.benefitChoices).flat().sort(),[u('predador'),u('dentes')].sort());
  }finally{globalThis.fromUuid=previous;}
});

test('perfil explícito do planejador não muda para outro perfil por coincidência de vocabulário',async()=>{
  const f=fixture(),previous=globalThis.fromUuid;globalThis.fromUuid=f.resolve;
  try{
    f.profiles.push({...f.profiles[0],id:'regional',name:'Regional',regionIds:['huma']});
    const result=await prepareNpcDescription({id:'teste:perfil-fixo',text:'Um Anuro guarda em Huma nível 1',purposeProfileId:'lutador'},{...f});
    assert.equal(result.state,'ready');assert.ok(result.decisions.some(row=>row.field==='profile'&&row.value==='Lutador'));
    const missing=await prepareNpcDescription({id:'teste:perfil-ausente',text:'Um Anuro guarda em Huma nível 1',purposeProfileId:'ausente'},{...f});
    assert.equal(missing.state,'needs-choices');
  }finally{globalThis.fromUuid=previous;}
});
