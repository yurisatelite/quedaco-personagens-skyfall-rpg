import test from 'node:test';
import assert from 'node:assert/strict';
import {generateCharacter,interpretRequest} from '../src/generation.mjs';
import {generationFixture,seeded} from './generation-fixture.mjs';
globalThis.foundry={applications:{api:{ApplicationV2:class{}}}};
const {CreatorApp}=await import('../src/app.mjs');
function setup(){
  globalThis.game={user:{id:'gm',isGM:true,can:()=>true},actors:new Map(),world:{id:'test'},settings:{get:()=>true}};
  const app=new CreatorApp();app.catalog=generationFixture();app.loading=false;app.screen='group';return app;
}
test('proposta usa o criador original e passa novamente pelos validadores na revisão',async()=>{
  const app=setup();
  for(const cls of ['Combatente','Especialista','Ocultista']){
    const row=await generateCharacter(app.catalog,interpretRequest(app.catalog,{text:`anão ${cls} nível 4`}),{random:seeded(42)});
    await app.loadProposal(row,0);await app.prepareBenefitPlan();await app.prepareTrainingPlan();await app.prepareEquipmentPlan();
    assert.deepEqual(app.errors(),[],cls);
    const html=await app._renderHTML();assert.match(html,/Identidade/);assert.match(html,/sy-wallet/);
    assert.equal((html.match(/data-op="createCharacter"/g)??[]).length,1);
  }
});
test('edição de texto não reconstrói a interface ao perder foco e não perde o clique seguinte',async()=>{
  const app=setup();let renders=0;app.rerender=async()=>{renders++;};
  await app.handleChange({target:{name:'gen-text',value:'anões nível 4'}});
  assert.equal(app.generator.text,'anões nível 4');assert.equal(renders,0);
  await app.handleChange({target:{name:'name',value:'Rafael'}});assert.equal(app.draft.name,'Rafael');assert.equal(renders,0);
});
test('grupo exige revisão de todas as fichas antes da primeira escrita e não repete as criadas',async()=>{
  const app=setup();const request=interpretRequest(app.catalog,{text:'anão Combatente nível 4'});
  app.generated=await Promise.all([0,1].map(index=>generateCharacter(app.catalog,request,{index,random:seeded(index+1)})));
  const original=CreatorApp.prototype.createCharacter;let writes=0,fail=true;
  CreatorApp.prototype.createCharacter=async function(){writes++;if(writes===2&&fail)throw Error('Falha simulada');this.actor={id:`actor${writes}`};this.message='Criada';};
  try{
    await assert.rejects(app.createProposals(),/Revise/);assert.equal(writes,0);
    app.generated.forEach(row=>row.reviewed=true);
    await assert.rejects(app.createProposals(),/Falha simulada/);assert.equal(app.generated[0].createdActorId,'actor1');assert.equal(app.generated[1].createdActorId,null);
    fail=false;await app.createProposals();assert.equal(writes,3);assert.equal(app.generated[0].createdActorId,'actor1');assert.equal(app.generated[1].createdActorId,'actor3');
    await assert.rejects(app.createProposals(),/Não há fichas/);assert.equal(writes,3);
  }finally{CreatorApp.prototype.createCharacter=original;}
});
test('grupo bloqueia acesso de jogador mesmo quando a criação individual está liberada',async()=>{
  const app=setup();game.user.isGM=false;
  await assert.rejects(app.generateProposals(),/Mestra/);await assert.rejects(app.createProposals(),/Mestra/);
});
