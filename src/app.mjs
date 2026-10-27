import {Catalog} from './catalog.mjs';
import {ABILITIES,classRules,backgroundRules,startingMoney,conventionalRoll,validateAttributes,hitPoints,wallet,carryingCapacity} from './rules.mjs';
import {buildCharacterPlan,validateBenefitChoices,resolvedPlanItems} from './benefits.mjs';
import {buildTrainingPlan,resolveTraining,actorTrainingUpdate,SKILLS,APTITUDES,LANGUAGES,SKILL_ICONS,PROFICIENCIES,aptitudeKey} from './training.mjs';
import {buildClassEquipmentPlan,buildBackgroundEquipmentPlan,resolveEquipmentPlan,mergeEquipmentResults,shopItems,resolvePurchases,totalVolume,itemVolume} from './equipment.mjs';
import {MODULE_ID,escapeHTML as e,safeImage,baixarArquivo,createDraft,addResolvedPlan,addInventory,refillResources,applyHitPointProgression,finalizeClassProgression,finalizePathProgression} from './adapter.mjs';
import {classProgression,requiresSpellcasting} from './progression.mjs';
import {assertCreatorAccess,playerCreationEnabled,configurePlayerCreation,actorFolders,PLAYER_FOLDER_KEY} from './player-access.mjs';
import {STEPS,STAGES,stageFor,brand,navigation,modeCards} from './creator-layout.mjs';
import {interpretRequest,generateCharacter} from './generation.mjs';
import {grantOptions} from './npc-templates.mjs';
const TYPES={1:'legacy',2:'heritage',3:'curse',4:'background',5:'class'};
const LABELS={legacy:'Legados',heritage:'Heranças',curse:'Maldições',background:'Antecedentes',class:'Classes',path:'Trilhas',feature:'Características',feat:'Talentos',ability:'Habilidades',spell:'Magias',weapon:'Armas',armor:'Armaduras',clothing:'Vestimentas',equipment:'Equipamentos',consumable:'Consumíveis',loot:'Outros itens',sigil:'Sigilos',seal:'Selos'};
const number=(n)=>n==null?'—':n;
export class CreatorApp extends foundry.applications.api.ApplicationV2 {
  static DEFAULT_OPTIONS={id:'quedaco-personagens-skyfall-rpg',classes:['sy-creator','qd-ui'],tag:'section',window:{title:'QUEDAÇO · Personagens Skyfall RPG',resizable:true,minimizable:true},position:{width:1240,height:820}};
  constructor(options={}) {
    options.position={width:Math.min(1240,(globalThis.innerWidth??1400)-32),height:Math.min(820,(globalThis.innerHeight??950)-32),...options.position};
    super(options);this.catalog=new Catalog(game);this.step=0;this.query='';this.type='spell';this.loading=true;this.busy=false;this.showShopInfo=(()=>{try{return localStorage.getItem('quedaco-shop-info')==='1';}catch{return false;}})();this.showItemInfo=(()=>{try{return localStorage.getItem('quedaco-item-info')!=='0';}catch{return true;}})();this.detail=null;this.actor=null;
    this.draft={name:'',biography:'',level:1,selections:{},noCurse:false,attributes:{str:1,dex:1,con:2,int:3,wis:0,cha:0},method:'fixed',slots:[2,3,1,0,4,5],boost:5,spellcasting:'',hpMethod:'fixed',hpRolls:[],portrait:'',token:'',cash:0,moneyOverride:null};
    this.heritageOptions=[];this.attributesFinalized=false;this.equipmentFinalized=false;this._restoreScroll=null;this.visited=new Set();this._scrollDetailIntoView=false;this._scrollNpcIntoView=false;this.attentionStep=null;
    this.sums={class:null,background:null};this.rolls=[];this.rollSlots=[0,1,2,3,4,5];this.swap=[0,1];this.extra=new Set();this.benefitChoices={};this.benefitPlan=null;this.trainingChoices={};this.trainingPlan=null;this.trainingResolved=null;this.equipmentChoices={};this.equipmentPlan=null;this.equipmentResolved=null;this.purchasesCash=new Map();this.purchasesBudget=new Map();this.shopQuery='';this.purchaseResolved=null;this._cantrips=null;
    this.screen='home';this.summaryOpen=false;this.summaryHidden=false;this.generator={text:'',level:'',count:4,fixed:{},animal:'',noCurse:false,variedRoles:true};this.generated=[];this._editingRow=null;
  }
  get _draftKey(){return `quedaco-rascunho:${game.world?.id??'mundo'}:${game.user?.id??'usuario'}`;}
  saveDraft(){
    if(this.loading||this.actor||this.screen!=='manual'||this._editingRow!==null)return;
    try{localStorage.setItem(this._draftKey,JSON.stringify({savedAt:Date.now(),step:this.step,draft:this.draft,benefitChoices:this.benefitChoices,trainingChoices:this.trainingChoices,equipmentChoices:this.equipmentChoices,extra:[...this.extra],purchasesCash:[...this.purchasesCash],purchasesBudget:[...this.purchasesBudget],sums:this.sums,rolls:this.rolls,rollSlots:this.rollSlots,swap:this.swap,attributesFinalized:this.attributesFinalized,equipmentFinalized:this.equipmentFinalized,visited:[...this.visited]}));}catch{}
  }
  clearSavedDraft(){try{localStorage.removeItem(this._draftKey);}catch{}}
  async restoreDraft(){
    let saved=null;try{saved=JSON.parse(localStorage.getItem(this._draftKey)??'null');}catch{}
    if(!saved?.draft||!(saved.draft.name?.trim()||Object.keys(saved.draft.selections??{}).length))return;
    const when=new Date(saved.savedAt).toLocaleString('pt-BR');
    const ok=await foundry.applications.api.DialogV2.confirm({window:{title:'Rascunho encontrado'},content:`<p>Há um personagem em andamento${saved.draft.name?.trim()?` (<strong>${e(saved.draft.name)}</strong>)`:''}, salvo em ${e(when)}. Continuar de onde parou?</p>`,yes:{label:'Continuar'},no:{label:'Começar do zero'}});
    if(!ok){this.clearSavedDraft();return;}
    this.draft={...this.draft,...saved.draft};this.step=saved.step??0;this.benefitChoices=saved.benefitChoices??{};this.trainingChoices=saved.trainingChoices??{};this.equipmentChoices=saved.equipmentChoices??{};this.extra=new Set(saved.extra??[]);this.purchasesCash=new Map(saved.purchasesCash??[]);this.purchasesBudget=new Map(saved.purchasesBudget??[]);this.sums=saved.sums??this.sums;this.rolls=saved.rolls??[];this.rollSlots=saved.rollSlots??this.rollSlots;this.swap=saved.swap??this.swap;this.attributesFinalized=Boolean(saved.attributesFinalized);this.equipmentFinalized=Boolean(saved.equipmentFinalized);this.visited=new Set(saved.visited??[]);
    this.screen='manual';
    if(this.draft.selections.legacy)try{this.heritageOptions=await this.catalog.linkedItems(this.draft.selections.legacy,{type:'heritage',level:0});}catch{}
  }
  async start(){assertCreatorAccess(game);await this.render(true);try{await this.catalog.load();}catch(err){this.message=err.message;}this.loading=false;try{await this.restoreDraft();}catch(err){console.error(MODULE_ID,err);}return this.render(true);}
  selected(type){return this.catalog.items.find(i=>i.uuid===this.draft.selections[type]);}
  money(){try{const base=startingMoney(this.selected('class')?.name,this.selected('background')?.name,this.sums.class,this.sums.background);if(this.draft.moneyOverride!=null&&this.draft.moneyOverride>=0)return {...base,cash:this.draft.moneyOverride,wallet:wallet(this.draft.moneyOverride)};return base;}catch{return null;}}
  attrErrors(){const bases=[3,2,1,1,0,-1],values=Object.values(this.draft.attributes);const errors=validateAttributes(values,this.draft.method,this.draft.slots.map(i=>bases[i]),this.draft.boost);if(this.draft.method==='fixed'&&new Set(this.draft.slots).size!==6)errors.push('Use cada posição da distribuição uma única vez.');if(['conventional','ordered'].includes(this.draft.method)&&this.rolls.length!==6)errors.push('Role os seis conjuntos antes de continuar.');return errors;}
  renderPlayerSettings(){
    if(!game.user.isGM)return '<p>Somente a Mestra pode configurar o acesso.</p>';
    this.playerSettings??={enabled:playerCreationEnabled(game),folderId:game.settings.get(MODULE_ID,PLAYER_FOLDER_KEY)};
    return `<span class="sy-eyebrow">PREPARAÇÃO DA MESA</span><h2>Criação dos jogadores</h2><p>Libere o criador inteiro. Cada jogador escolhe livremente e recebe Owner na própria ficha.</p><section class="sy-choice"><label class="sy-inline"><input type="checkbox" name="playerEnabled" ${this.playerSettings.enabled?'checked':''}> Liberar criação para todos os jogadores</label><label>Pasta dos personagens<select name="playerFolder"><option value="">Selecione uma pasta existente</option>${actorFolders(game).map(folder=>`<option value="${e(folder.id)}" ${folder.id===this.playerSettings.folderId?'selected':''}>${e(folder.label)}</option>`).join('')}</select></label><p class="sy-note">A Mestra vê todas as fichas. Cada jogador vê as que criou. Isso não muda o personagem principal da conta.</p><small>A liberação concede também a permissão nativa de criar Atores. Ao desligar, o módulo retira somente as permissões que concedeu.</small></section>`;
  }
  renderGenerator(){
    const group=this.screen==='group',g=this.generator;
    const select=(type,label)=>`<label>${label}<select name="gen-${type}"><option value="">Sortear / interpretar descrição</option>${this.catalog.list(type).filter(entry=>type!=='heritage'||!g.fixed.legacy||this.heritageOptions.some(option=>option.uuid===entry.uuid)).map(entry=>`<option value="${e(entry.uuid)}" ${g.fixed[type]===entry.uuid?'selected':''}>${e(entry.name)}</option>`).join('')}</select></label>`;
    return `<div class="sy-generation-heading"><span class="sy-eyebrow">${group?'PREPARE UMA CENA INTEIRA':'DEIXE OS DADOS SUGERIREM'}</span><h2>${group?'Grupo por descrição':'Personagem aleatório'}</h2><p>Fixe o que importa. O restante será escolhido entre as opções acessíveis da mesa.</p></div><div class="sy-generation-layout"><section class="sy-generator-form"><label>Conceito e contexto<textarea name="gen-text" rows="4" placeholder="Quatro anões de nível 4 numa expedição ao passado, com funções diferentes…">${e(g.text)}</textarea></label><div class="sy-form-grid">${group?`<label>Quantidade<input name="gen-count" type="number" min="1" max="20" value="${g.count}"></label>`:''}<label>Nível<select name="gen-level"><option value="">Da descrição (padrão: 1)</option>${Array.from({length:12},(_,i)=>`<option value="${i+1}" ${Number(g.level)===i+1?'selected':''}>Nível ${i+1}</option>`).join('')}</select></label>${select('legacy','Legado fixo')}${select('heritage','Herança fixa')}${select('class','Classe fixa')}${select('background','Antecedente fixo')}${select('curse','Maldição fixa')}</div>${group?`<label class="sy-inline"><input type="checkbox" name="gen-variedRoles" ${g.variedRoles?'checked':''}> Variar as funções do grupo</label>`:''}<label class="sy-inline"><input type="checkbox" name="gen-noCurse" ${g.noCurse?'checked':''}> Sem maldição</label><label>Animal da ânima (gnomos)<input name="gen-animal" value="${e(g.animal)}" placeholder="Ex.: gato, cobra ou gavião"></label><small>Perfis de ânima são propostas de campanha. Outros animais ficam para escolha manual; o módulo não inventa benefícios.</small>${this.generated.length?'<button data-op="generate">Gerar novas propostas</button>':''}<p class="sy-muted">Interpretação local: reconhece nomes do catálogo, “anão” como Tôra e nível. O contexto fica na história. Confira a leitura abaixo antes de criar.</p></section><section class="sy-generated-results" aria-label="Prévia dos personagens"><h3>${this.generated.length?'Revise seu grupo':'Sua prévia aparece aqui'}</h3>${this.interpreted?`<p class="sy-note">Entendido: ${this.interpreted.count} personagem(ns), nível ${this.interpreted.level}${Object.entries(this.interpreted.fixed).map(([,uuid])=>` · ${e(this.catalog.entry(uuid)?.name)}`).join('')}. Demais escolhas sorteadas.</p>`:''}${!this.generated.length?'<div class="sy-empty-state">◇<p>Nenhuma ficha será criada durante a geração da prévia.</p></div>':this.generated.map((row,index)=>row.error?`<article class="sy-preview-card"><h3>Personagem ${index+1}</h3><p class="sy-alert">${e(row.error)}</p><button data-op="rerollGenerated" data-index="${index}">Tentar novamente</button></article>`:`<article class="sy-preview-card ${row.createdActorId?'is-created':''}"><div class="sy-preview-title"><h3>${e(row.draft.name)}</h3><span class="sy-tag-auto">${row.createdActorId?'Criado':'Nível '+row.draft.level}</span></div><p>${['legacy','heritage','class','background','curse'].map(type=>this.catalog.entry(row.draft.selections[type])?.name).filter(Boolean).map(e).join(' · ')}</p>${row.draft.animal?`<p>Ânima: ${e(row.draft.animal)}</p>`:''}<p class="sy-preview-abilities">${Object.entries(row.draft.attributes).map(([key,value])=>`${ABILITIES[key]} ${value>0?'+':''}${value}`).join(' · ')}</p><small>${Object.keys(row.benefitChoices).length} blocos de progressão · T$ ${row.money?.cash??'—'}</small>${row.notes.map(note=>`<p class="sy-muted">${e(note)}</p>`).join('')}${row.issues.map(issue=>`<p class="sy-alert">${e(issue)}</p>`).join('')}<div class="sy-row">${row.createdActorId?`<button data-op="openGenerated" data-index="${index}">Abrir ficha</button>`:`<button data-op="editGenerated" data-index="${index}">Revisar / editar</button><button data-op="rerollGenerated" data-index="${index}">Sortear este novamente</button>`}</div>${!row.createdActorId?`<label class="sy-inline"><input type="checkbox" name="reviewGenerated-${index}" ${row.reviewed?'checked':''} ${row.issues.length?'disabled':''}> Revisei as escolhas e quero criar esta ficha</label>`:''}</article>`).join('')}</section></div>`;
  }
  snapshot(){return structuredClone({draft:this.draft,benefitChoices:this.benefitChoices,trainingChoices:this.trainingChoices,equipmentChoices:this.equipmentChoices,sums:this.sums,createdActorId:this.actor?.id??null,step:this.step,visited:[...this.visited],attributesFinalized:this.attributesFinalized,equipmentFinalized:this.equipmentFinalized});}
  async loadProposal(row,index=null){
    this.draft=structuredClone(row.draft);this.benefitChoices=structuredClone(row.benefitChoices);this.trainingChoices=structuredClone(row.trainingChoices);this.equipmentChoices=structuredClone(row.equipmentChoices);this.sums={...row.sums};
    this.actor=row.createdActorId?game.actors.get(row.createdActorId):null;this._editingRow=index;
    this.benefitPlan=null;this.trainingResolved=null;this.equipmentResolved=null;this.benefitPlan=null;this.purchasesCash.clear();this.purchasesBudget.clear();
    this.attributesFinalized=row.attributesFinalized??true;this.equipmentFinalized=row.equipmentFinalized??true;this.step=row.step??12;this.visited=new Set(row.visited??Array.from({length:13},(_,i)=>i));
    this.heritageOptions=await this.catalog.linkedItems(this.draft.selections.legacy,{type:'heritage',level:0});
    this.screen='manual';
  }
  async generateProposals(index=null){
    if(this.screen==='group'&&!game.user.isGM)throw Error('Somente a Mestra pode gerar grupos.');
    assertCreatorAccess(game);
    const request=interpretRequest(this.catalog,{...this.generator,count:this.screen==='group'?this.generator.count:1});
    if(request.issues.length)throw Error(request.issues.join(' '));
    this.interpreted=request;
    if(index===null&&this.generated.some(row=>row.createdActorId))throw Error('Há fichas já criadas nesta prévia. Volte ao início para preparar outro grupo.');
    await this.showBusy('Preparando personagens…');
    const rows=index===null?[]:[...this.generated];
    const indexes=index===null?Array.from({length:request.count},(_,i)=>i):[index];
    for(const i of indexes){
      this.busyText(`Preparando personagem ${i+1} de ${request.count}…`);
      try{rows[i]=await generateCharacter(this.catalog,request,{index:i});}catch(error){rows[i]={error:error.message};}
    }
    this.generated=rows;this._scrollGeneratedIntoView=true;
  }
  async createProposals(){
    assertCreatorAccess(game);
    if(this.screen==='group'&&!game.user.isGM)throw Error('Somente a Mestra pode criar grupos.');
    const pending=this.generated.filter(row=>!row.createdActorId);
    if(!pending.length)throw Error('Não há fichas novas para criar.');
    if(pending.some(row=>row.error||row.issues.length||!row.reviewed))throw Error('Revise cada personagem, resolva as pendências e marque as fichas que deseja criar.');
    await this.showBusy('Conferindo as fichas…');
    const workers=[];
    for(const [index,row] of this.generated.entries()){
      if(row.createdActorId)continue;
      const worker=new CreatorApp();worker.catalog=this.catalog;await worker.loadProposal(row,index);
      await worker.prepareBenefitPlan();await worker.prepareTrainingPlan();await worker.prepareEquipmentPlan();
      const errors=worker.errors();if(errors.length){row.issues=errors;row.reviewed=false;throw Error(`${row.draft.name}: ${errors.join(' ')}`);}
      workers.push({worker,row});
    }
    for(const {worker,row} of workers){
      this.busyText(`Criando ${row.draft.name}…`);
      try{await worker.createCharacter(false);row.createdActorId=worker.actor.id;row.notes.push(worker.message);}
      catch(error){if(worker.actor)row.createdActorId=worker.actor.id;row.notes.push(error.message);throw error;}
    }
    this.message='Fichas criadas na pasta configurada, com Owner para a conta que realizou a criação.';
  }
  async _renderHTML(){
    this.saveDraft();
    if(!this.loading&&this.visited.size)this.visited.add(this.step);
    const toolbar=`<div class="sy-toolbar">${this.screen!=='home'?'<button data-op="home">← Início</button>':''}${this.screen==='manual'?'<button data-op="fillRandom" title="Mantém as escolhas atuais de legado, herança, classe e antecedente">Sortear restante</button><button data-op="summary" aria-expanded="'+((this.element?.clientWidth??globalThis.innerWidth??1240)>1000?!this.summaryHidden:this.summaryOpen)+'">Resumo</button>':''}${game.user.isGM?'<button data-op="settings">Jogadores</button>':''}<details class="sy-tools"><summary aria-label="Ferramentas">⋯</summary><button data-op="audit">Conferir conteúdo</button></details></div>`;
    const header=`<header>${brand()}${toolbar}</header>`;
    const message=this.message?`<p class="sy-alert" role="status">${e(this.message)}</p>`:'';
    if(this.screen==='home')return `<div class="sy-shell">${header}<main class="sy-home">${message}<span class="sy-eyebrow">SUA PRÓXIMA HISTÓRIA COMEÇA AQUI</span><h2>Quem você vai ser?</h2><p>Crie um aventureiro de Skyfall com o conteúdo da sua mesa.</p>${this.loading?'<p role="status">Carregando os compêndios acessíveis…</p>':modeCards(game.user.isGM)}<div class="sy-home-note"><span aria-hidden="true">◇</span><p>Escolhas livres. Regras dos seus compêndios. A ficha só é criada depois da sua revisão.</p></div></main><footer><small>Skyfall RPG · níveis 1–12</small><small>${this.catalog.items.length} opções acessíveis na mesa</small></footer></div>`;
    if(this.screen==='settings')return `<div class="sy-shell">${header}<main class="sy-home sy-settings">${message}${this.renderPlayerSettings()}</main><footer><button data-op="home">Voltar</button><button class="sy-primary qd-button qd-button--primary" data-op="saveSettings">Salvar configuração</button></footer></div>`;
    if(['random','group'].includes(this.screen))return `<div class="sy-shell">${header}<main class="sy-generation">${message}${this.renderGenerator()}</main><footer><button data-op="home">Voltar</button><small>Prévia local · nenhum serviço de IA externo</small>${this.generated.length?'<button class="sy-primary qd-button qd-button--primary" data-op="createGenerated">Criar fichas revisadas</button>':'<button class="sy-primary qd-button qd-button--primary" data-op="generate">Gerar prévia</button>'}</footer></div>`;
    const selected=this.selected('class');let hp='—';try{hp=hitPoints(selected?.name,this.draft.attributes.con,this.draft.level,this.draft.hpMethod==='rolled'?this.draft.hpRolls:null);}catch{}
    const money=this.money(),purchases=money?resolvePurchases(this.catalog,money.cash,money.equipmentBudget,this.purchasesCash,this.purchasesBudget):null,displayWallet=purchases?wallet(Math.max(0,purchases.cashRemaining)):money?.wallet;
    const body=this.loading?'<p>Carregando…</p>':await this.renderStep();
    const summary=`<aside aria-label="Resumo do personagem"><div class="sy-summary-heading"><small>SEU PERSONAGEM</small><button data-op="summary" aria-label="Recolher resumo">×</button></div><h3>${e(this.draft.name||'Novo aventureiro')}</h3><small>Nível ${this.draft.level}</small>${this.draft.portrait?`<img class="sy-portrait" src="${e(safeImage(this.draft.portrait))}" alt="Retrato">`:''}<div class="sy-stats"><div>Vida<strong>${hp} <small>PV</small></strong></div><div>Ênfase<strong>${selected?this.draft.level*3:'—'} <small>PE</small></strong></div></div><dl>${['legacy','heritage','curse','background','class'].filter(type=>this.selected(type)).map(type=>`<div><dt>${LABELS[type]}</dt><dd>${e(this.selected(type).name)}</dd></div>`).join('')}</dl>${!Object.values(this.draft.selections).some(Boolean)?'<p class="sy-empty">Suas escolhas aparecerão aqui.</p>':''}<h3 class="sy-wallet-title">Bolsa</h3><div class="sy-stats sy-wallet qd-equal-cards">${['k','p','t'].map(k=>`<div><small>${k.toUpperCase()}$</small><strong>${number(displayWallet?.[k])}</strong></div>`).join('')}</div>${money?.debt?`<p>Dívida: T$ ${money.debt}</p>`:''}${money?.equipmentBudget?`<p>Verba de exploração: T$ ${purchases?.budgetRemaining??money.equipmentBudget}</p>`:''}</aside>`;
    const stage=stageFor(this.step),done=Array.from({length:12},(_,i)=>this.visited.has(i)&&this.stepDone(i)).filter(Boolean).length;
    return `<div class="sy-shell ${this.summaryOpen?'is-summary-open':''} ${this.summaryHidden?'is-summary-hidden':''}">${header}<div class="sy-mobile-nav"><label>Etapa<select name="jumpStep">${STEPS.map((label,i)=>`<option value="${i}" ${this.step===i?'selected':''}>${i+1}. ${label}</option>`).join('')}</select></label><small>${STAGES[stage].title} · ${stage+1} de 5</small></div><div class="sy-layout">${navigation(this)}<main>${message}${this.attentionStep===this.step&&this.stepIssues(this.step).length?`<p class="sy-alert" role="alert">${e(this.stepIssues(this.step)[0])}</p>`:''}<div class="sy-step-heading"><span class="sy-eyebrow">${STAGES[stage].title} · ${stage+1} de 5</span><small>Etapa ${this.step+1} de 13</small></div><h2>${STEPS[this.step]}</h2>${body}</main>${summary}</div><footer><button data-op="previous" ${this.step===0?'disabled':''}>← Voltar</button><div class="sy-progress"><small>${this.actor?'Ficha criada':done+' de 12 etapas preparadas'}</small><progress max="12" value="${done}" aria-label="Progresso da criação"></progress></div>${this._editingRow!==null?'<button data-op="returnGenerated">Salvar na prévia</button>':''}<button class="sy-primary qd-button qd-button--primary" data-op="${this.step===12?(this.actor?'openActor':'createCharacter'):'next'}" ${this.step===12&&!this.actor&&this.errors().length?'disabled':''}>${this.step===12?(this.actor?'Abrir ficha':'Criar ficha'):'Continuar →'}</button></footer></div>`;
  }
  _scrollKeys(){const seen={};return this.element?[...this.element.querySelectorAll('.sy-layout>main,.sy-layout>nav,.sy-layout>aside,.sy-home,.sy-generation,.sy-option-grid,.sy-shop,.sy-shop-category')].map(el=>{const base=`${el.tagName}.${el.className}`;seen[base]=(seen[base]??-1)+1;return [`${base}#${seen[base]}`,el];}):[];}
  _replaceHTML(result,content){
    const state=this._resetScroll?null:Object.fromEntries(this._scrollKeys().map(([key,el])=>[key,[el.scrollTop,el.scrollLeft]]));
    content.innerHTML=result;this._resetScroll=false;
    if(state)for(const [key,el] of this._scrollKeys()){const at=state[key];if(at){el.scrollTop=at[0];el.scrollLeft=at[1];}}
  }
  _scroller(){return this.element?.querySelector?.('.sy-layout>main, .sy-shell>main')??this.element?.querySelector?.('.window-content')??null;}
  async rerender(preserve=true){if(!this.element)return;this._resetScroll=!preserve;return this.render(true);}
  _onRender(context,options){
    super._onRender(context,options);if(!this.element)return;
    const root=this.element,scroller=this._scroller();
    if(this._scrollGeneratedIntoView){this._scrollGeneratedIntoView=false;root.querySelector('.sy-generated-results')?.scrollIntoView({block:'start'});}
    if(this._scrollDetailIntoView){this._scrollDetailIntoView=false;root.querySelector?.('.sy-detail')?.scrollIntoView({block:'nearest',behavior:'smooth'});}
    const close=root.querySelector('.window-header button[data-action="close"]');if(close){close.classList.remove('fa-solid','fa-xmark','icon');close.textContent='×';close.title='Fechar';close.setAttribute('aria-label','Fechar');}
    const menu=root.querySelector('.window-header button[data-action="toggleControls"]');if(menu){menu.classList.remove('fa-solid','fa-ellipsis-vertical','icon');menu.textContent='⋯';menu.title='Opções da janela';}
    const windowHeader=root.querySelector('.window-header');
    if(windowHeader&&!windowHeader.querySelector('[data-sy-minimize]')){
      const minimize=document.createElement('button');minimize.type='button';minimize.className='header-control';minimize.dataset.syMinimize='';minimize.textContent='−';minimize.title='Minimizar';minimize.setAttribute('aria-label','Minimizar');minimize.addEventListener('click',()=>this.minimized?this.maximize():this.minimize());windowHeader.insertBefore(minimize,menu??close);
      const expand=document.createElement('button');expand.type='button';expand.className='header-control';expand.textContent='⤢';expand.title='Ajustar à tela / restaurar';expand.setAttribute('aria-label',expand.title);expand.addEventListener('click',()=>{if(this._normalPosition){this.setPosition(this._normalPosition);this._normalPosition=null;}else{this._normalPosition={...this.position};this.setPosition({left:16,top:16,width:innerWidth-32,height:innerHeight-32});}});windowHeader.insertBefore(expand,minimize);
    }
    root.addEventListener('click',this._click??=(event)=>this.handleClick(event));
    root.addEventListener('change',this._change??=(event)=>this.handleChange(event));
    root.addEventListener('input',this._input??=(event)=>{
      if(['name','biography','animal'].includes(event.target.name)){this.draft[event.target.name]=event.target.value;this.saveDraft();return;}
      if(['gen-text','gen-animal'].includes(event.target.name)){this.generator[event.target.name.slice(4)]=event.target.value;return;}
      if(!['query','shopQuery'].includes(event.target.name))return;
      const name=event.target.name;clearTimeout(this._searchTimer);this._searchTimer=setTimeout(()=>{if(name==='query')this.query=event.target.value;else this.shopQuery=event.target.value;this.rerender(true);},180);
    });
  }
  stepIssues(i){
    if(i===0)return this.draft.name.trim()?[]:['Informe o nome do personagem no Conceito.'];
    if(TYPES[i]){
      if(i===2&&this.selected('legacy')?.name==='Gnomo'&&!this.draft.animal?.trim())return ['Informe o animal da ânima do gnomo.'];
      if(i===3)return this.selected('curse')||this.draft.noCurse?[]:['Escolha uma maldição ou confirme “Sem maldição”.'];
      return this.selected(TYPES[i])?[]:[`Escolha um ${LABELS[TYPES[i]].slice(0,-1).toLowerCase()} para concluir esta etapa.`];
    }
    if(i===6)return this.benefitPlan?validateBenefitChoices(this.benefitPlan,this.benefitChoices):['Confira as escolhas de progressão e benefícios.'];
    if(i===7)return this.attributesFinalized&&!this.attrErrors().length?[]:this.attrErrors().length?this.attrErrors():['Confirme os atributos e a vida desta ficha.'];
    if(i===8)return this.trainingResolved&&!this.trainingResolved.errors.length?[]:this.trainingResolved?.errors??['Confira as perícias e proficiências.'];
    if(i===9)return this.money()?[]:['Informe ou role os valores iniciais de dinheiro.'];
    if(i===10)return this.equipmentFinalized&&this.equipmentResolved&&!this.equipmentResolved.errors.length?[]:this.equipmentResolved?.errors??['Finalize as escolhas de equipamento inicial.'];
    if(i===11)return this.visited.has(i)?[]:['Abra a etapa de retrato e token para conferi-la.'];
    return this.actor?[]:['Crie a ficha para concluir a revisão.'];
  }
  stepDone(i){return !this.stepIssues(i).length;}
  async renderStep(){
    const d=this.draft;
    if(this.step===0)return `<label>Nome<input name="name" value="${e(d.name)}" maxlength="100"></label><label>Conceito e história<textarea name="biography" rows="7">${e(d.biography)}</textarea></label><label>Nível inicial<select name="level">${Array.from({length:12},(_,i)=>i+1).map(level=>`<option value="${level}" ${d.level===level?'selected':''}>Nível ${level}</option>`).join('')}</select></label><p>O QUEDAÇO monta todas as concessões registradas pela classe até o nível escolhido e separa as escolhas por nível.</p>`;
    if(TYPES[this.step])return this.renderCatalog(TYPES[this.step]);
    if(this.step===6)return this.renderBenefits();
    if(this.step===7)return this.renderAttributes();
    if(this.step===8)return this.renderTraining();
    if(this.step===9)return this.renderMoney();
    if(this.step===10)return this.renderEquipment();
    if(this.step===11)return `<p>As imagens são opcionais. Você pode criar a ficha agora e defini-las depois.</p><div class="sy-media-grid"><section class="sy-media-choice"><button data-op="portrait">Escolher retrato</button>${d.portrait?`<img class="sy-large-portrait" src="${e(safeImage(d.portrait))}" alt="Retrato escolhido"><button data-op="clearMedia" data-kind="portrait">Remover retrato</button>`:'<small>Nenhum retrato escolhido.</small>'}</section><section class="sy-media-choice"><button data-op="token">Escolher token</button>${d.token?`<img class="sy-large-portrait" src="${e(safeImage(d.token))}" alt="Token escolhido"><button data-op="clearMedia" data-kind="token">Remover token</button>`:'<small>Nenhum token escolhido.</small>'}</section></div><p class="sy-note">A integração direta com o Tokenizer fica reservada para uma próxima versão; a ficha já pode ser criada sem token.</p>`;
    return this.renderReview();
  }
  async prepareBenefitPlan(){this.benefitPlan=await buildCharacterPlan(this.catalog,this.draft.selections,this.benefitChoices,this.draft.level);for(const group of this.benefitPlan.groups)group.options=await grantOptions(this.benefitPlan,group,this.catalog,this.benefitChoices);return this.benefitPlan;}
  async renderBenefits(){
    if(!this.selected('legacy')||!this.selected('heritage')||!this.selected('background')||!this.selected('class'))return '<p>Escolha legado, herança, antecedente e classe para montar a progressão.</p>';
    const plan=await this.prepareBenefitPlan();
    const className=this.selected('class')?.name;
    const prog=Object.fromEntries(classProgression(className,this.draft.level).map(p=>[p.level,p]));
    const spellPicks=new Set(plan.groups.filter(g=>g.granting==='spell').flatMap(g=>this.benefitChoices[g.id]??[]).filter(Boolean));
    const renderGroup=group=>{const selected=this.benefitChoices[group.id]??[],complete=selected.filter(Boolean).length===group.count,empty=group.options.length===0;return `<section class="sy-choice">${complete?'<span class="sy-done" aria-label="Bloco concluído">✓</span>':''}<h3>${e(group.title)}</h3><small>${selected.filter(Boolean).length} de ${group.count} escolhidas</small>${empty?`<p class="sy-alert">${group.granting==='path'?'Nenhuma trilha acessível foi encontrada. Confira se o compêndio de Criação de Personagem está ativo e se há itens do tipo Trilha.':'Nenhuma opção acessível foi encontrada para esta escolha.'}</p>`:`<div class="sy-option-grid">${group.options.map(option=>{const chosen=selected.includes(option.uuid),dupSpell=group.granting==='spell'&&!chosen&&spellPicks.has(option.uuid);return `<article class="sy-option ${chosen?'is-selected':''} ${dupSpell?'is-disabled':''}"><button class="sy-help" data-op="detail" data-uuid="${e(option.uuid)}" aria-label="Ver descrição" title="Ver descrição">?</button><img src="${e(safeImage(option.img))}" alt=""><strong>${e(option.name)}</strong><button data-op="chooseBenefit" data-group="${e(group.id)}" data-uuid="${e(option.uuid)}" aria-pressed="${chosen}" ${dupSpell?'disabled':''}>${chosen?'✓ Escolhido':dupSpell?'Já escolhida em outro nível':'Escolher'}</button></article>`;}).join('')}</div>`}</section>`;};
    const levelBlocks=Array.from({length:this.draft.level},(_,i)=>{
      const lvl=i+1,gs=plan.groups.filter(g=>g.atLevel===lvl),inc=plan.included.filter(item=>(item.atLevel||1)===lvl),p=prog[lvl];
      const autoItems=inc.map(item=>`<li><img src="${e(safeImage(item.entry.img))}" alt=""><span>${e(item.entry.name)}</span><button class="sy-help" data-op="detail" data-uuid="${e(item.entry.uuid)}" aria-label="Ver descrição" title="Ver descrição">?</button></li>`).join('');
      const feat=p?.feature&&p.feature!=='Progressão automática da classe'?p.feature:'';
      // Quando há uma decisão neste nível, a característica da tabela só dá
      // contexto à escolha. O selo "auto" é reservado para ganhos sem escolha.
      const showAutoTag=!gs.length;
      const levelFeature=feat&&!showAutoTag?`<small class="sy-level-feature">${e(feat)} · escolha deste nível</small>`:'';
      const autoLine=feat&&showAutoTag?`<p class="sy-auto-line"><span class="sy-tag-auto">auto</span><span>${e(feat)}<small> · conforme a progressão de ${e(className)}, nível ${lvl}</small></span></p>`:'';
      const hasAuto=Boolean(autoItems||autoLine);
      return `<section class="sy-level"><div class="sy-level-head"><h3>Nível ${lvl}</h3>${levelFeature}${p?`<small>${e(p.hitPoints)} · ${p.emphasis} PE · Prof. +${p.proficiency}</small>`:''}</div>${hasAuto?`<div class="sy-level-auto">${autoLine}${autoItems?`<ul class="sy-benefit-list">${autoItems}</ul>`:''}</div>`:''}${gs.length?gs.map(renderGroup).join(''):(hasAuto?'':'<p class="sy-note">Sem escolhas ou concessões novas neste nível — apenas os avanços da tabela de classe.</p>')}</section>`;
    }).join('');
    const errors=validateBenefitChoices(plan,this.benefitChoices);
    const spell=requiresSpellcasting(className,plan)?`<label>Atributo-chave de conjuração<select name="spellcasting"><option value="">Selecione…</option>${['int','wis','cha'].map(k=>`<option value="${k}" ${this.draft.spellcasting===k?'selected':''}>${ABILITIES[k]}</option>`).join('')}</select></label>`:'';
    return `${errors.length?`<div class="sy-alert-top">${errors.map(error=>`<p class="sy-alert">${e(error)}</p>`).join('')}</div>`:''}<p>Cada nível aparece abaixo, de 1 até ${this.draft.level}. Concessões automáticas entram sozinhas; onde há decisão, o bloco de escolha aparece no nível certo.</p>${spell}${levelBlocks}`;
  }
  async cantrips(){
    if(this._cantrips)return this._cantrips;
    const spells=this.catalog.list('spell'),flags=await Promise.all(spells.map(async entry=>{const indexed=entry.system?.descriptors;const descriptors=indexed!==undefined?indexed:(await this.catalog.document(entry.uuid)).system?.descriptors;return Array.from(descriptors??[]).includes('cantrip');}));const result=spells.filter((_,index)=>flags[index]);
    this._cantrips=result;return result;
  }
  async renderDetail(){return '';}
  async showDetail(uuid){
    const DialogV2=foundry.applications.api.DialogV2;
    try{
      const doc=await this.catalog.document(uuid);const fragments=[doc.system.description?.value,doc.system.effect?.descriptive,doc.system.attack?.hit,doc.system.attack?.miss,doc.system.special?.descriptive].filter(Boolean);
      const body=await foundry.applications.ux.TextEditor.implementation.enrichHTML(fragments.join('<hr>')||'<p>Sem descrição registrada.</p>',{secrets:false,relativeTo:doc});
      new DialogV2({window:{title:doc.name},position:{width:560},classes:['sy-detail-modal'],content:`<div class="sy-detail-body" style="max-height:60vh;overflow:auto">${body}</div>`,buttons:[{action:'ok',label:'OK',default:true},{action:'sheet',label:'Abrir ficha original',callback:()=>{doc.sheet.render(true);}}]}).render({force:true});
    }catch(err){this.message=err.message;}
  }
  async prepareTrainingPlan(){
    this.trainingPlan=buildTrainingPlan(this.selected('class')?.name,this.selected('background')?.name,this.draft.spellcasting,this.trainingChoices,this.attributesFinalized?this.draft.attributes.int:0,await this.cantrips());
    this.trainingResolved=resolveTraining(this.trainingPlan,this.trainingChoices);return this.trainingPlan;
  }
  async renderTraining(){
    if(!this.selected('class')||!this.selected('background'))return '<p>Escolha classe e antecedente para montar as proficiências.</p>';
    const plan=await this.prepareTrainingPlan(),resolved=this.trainingResolved;
    const fixed=[...plan.fixed.proficiencies.map(value=>`Equipamento: ${PROFICIENCIES[value]??value}`),...plan.fixed.skills.map(value=>`Perícia: ${SKILLS[value]??APTITUDES[value]??value}`),...plan.fixed.protections.map(value=>`Proteção: ${ABILITIES[value]??value.toUpperCase()}`),...plan.fixed.languages.map(value=>`Idioma: ${LANGUAGES[value]??value}`)];
    const used=new Set([...plan.fixed.skills.map(value=>`skill:${value}`),...plan.fixed.protections.map(value=>`protection:${value}`),...plan.fixed.languages.map(value=>`language:${value}`)]);for(const [groupId,ids] of Object.entries(this.trainingChoices)){if(groupId.endsWith(':apti')){for(const id of ids??[])used.add(`skill:${id}`);continue;}const group=plan.groups.find(item=>item.id===groupId);for(const id of ids??[]){const option=group?.options.find(item=>item.id===id);if(option&&!['mode','expertise'].includes(option.kind))used.add(`${option.kind}:${option.value}`);}}
    const groups=plan.groups.map(g=>{const selected=this.trainingChoices[g.id]??[],complete=selected.length===g.count;return `<fieldset class="sy-choice">${complete?'<span class="sy-done" aria-label="Bloco concluído">✓</span>':''}<legend>${e(g.title)}</legend><small>${selected.length} de ${g.count} escolhidas</small><div class="sy-check-grid">${g.options.map(option=>{const chosen=selected.includes(option.id),duplicate=!chosen&&!['mode','expertise'].includes(option.kind)&&used.has(`${option.kind}:${option.value}`),full=!chosen&&selected.length>=g.count;return `<label class="${chosen?'is-selected':''} ${duplicate?'is-disabled':''} ${option.kind==='skill'&&option.value==='apti'?'sy-apti-option':''}"><input type="checkbox" name="training" data-group="${e(g.id)}" data-option="${e(option.id)}" ${chosen?'checked':''} ${duplicate||full?'disabled':''}>${['skill','expertise'].includes(option.kind)&&SKILL_ICONS[option.value]?`<i class="fa-solid ${SKILL_ICONS[option.value]} sy-apt-icon" aria-hidden="true"></i>`:''}${e(option.kind==='skill'&&option.value==='apti'?'Aptidão…':option.label)}${duplicate?' · já escolhido':''}</label>`;}).join('')}</div>${this.renderAptitudePick(g,selected,used)}</fieldset>`;}).join('');
    return `<p>Cada bloco mostra seu limite. Perícias, proteções e idiomas já escolhidos ficam bloqueados nos blocos seguintes. “Expert” eleva uma perícia treinada para o grau 2 na ficha.</p><div class="sy-note">${e(fixed.join(' · '))}</div>${plan.fixed.notes.map(note=>`<p class="sy-alert">O idioma ${e(note)} aparece no antecedente, mas não existe na lista nativa do Skyfall 1.0.1; ele será preservado nas notas da criação.</p>`).join('')}${groups}${resolved.errors.map(error=>`<p class="sy-alert">${e(error)}</p>`).join('')}`;
  }
  renderAptitudePick(group,selected,used){
    if(!selected.includes('skill:apti'))return '';
    const chosen=(this.trainingChoices[aptitudeKey(group.id)]??[])[0];
    return `<div class="sy-apti-pick"><strong>Qual Aptidão?</strong><small>No livro, a perícia passa a se chamar “Aptidão com __”.</small><div class="sy-check-grid">${Object.entries(APTITUDES).map(([id,label])=>{const taken=id!==chosen&&used.has(`skill:${id}`);return `<label class="${id===chosen?'is-selected':''} ${taken?'is-disabled':''}"><input type="radio" name="trainingApt" value="${e(id)}" data-group="${e(group.id)}" ${id===chosen?'checked':''} ${taken?'disabled':''}><i class="fa-solid ${SKILL_ICONS[id]} sy-apt-icon" aria-hidden="true"></i>${e(label)}${taken?' · já escolhido':''}</label>`;}).join('')}</div></div>`;
  }
  async prepareEquipmentPlan(){if(!this.trainingResolved)await this.prepareTrainingPlan();const classPlan=await buildClassEquipmentPlan(this.catalog,this.selected('class')?.name,this.equipmentChoices);const backgroundPlan=await buildBackgroundEquipmentPlan(this.catalog,this.selected('background')?.name,this.trainingResolved.proficiencies);const money=this.money()??{cash:0,equipmentBudget:0};this.purchaseResolved=resolvePurchases(this.catalog,money.cash,money.equipmentBudget,this.purchasesCash,this.purchasesBudget);this.equipmentPlan={fixed:[...classPlan.fixed,...backgroundPlan.fixed],groups:[...classPlan.groups,...backgroundPlan.groups],notes:backgroundPlan.notes};this.equipmentResolved=mergeEquipmentResults(await resolveEquipmentPlan(this.catalog,classPlan,this.equipmentChoices),await resolveEquipmentPlan(this.catalog,backgroundPlan,this.equipmentChoices),this.purchaseResolved);return this.equipmentPlan;}
  descriptorLabel(id){
    const key=String(id).toUpperCase(),i18n=game.i18n;
    for(const group of ['EQUIPMENT','DAMAGE','CATEGORY','DIVERSE']){const path=`SKYFALL.DESCRIPTORS.${group}.${key}`;if(i18n.has(path))return i18n.localize(path).replace(/:REMOVE$/,'');}
    return String(id);
  }
  async itemInfo(entry){
    try{
      const system=(await this.catalog.document(entry.uuid)).system??{};
      const descriptors=Array.from(system.descriptors??[]);
      const parts=[];let damage='';
      if(entry.type==='weapon'&&system.damage?.die){const versatile=descriptors.includes('versatile')&&system.damage.versatile&&system.damage.versatile!==system.damage.die?`/${system.damage.versatile}`:'';damage=`Dano ${system.damage.die}${versatile}`;parts.push(damage);}
      if(entry.type==='armor'&&Number(system.dr)>0){damage=`RD ${system.dr}`;parts.push(damage);}
      if(Number.isFinite(Number(system.price)))parts.push(`T$ ${system.price}`);
      parts.push(`${itemVolume({system})} vol.`);
      const text=new DOMParser().parseFromString(system.description?.value??'','text/html').body.textContent.replace(/\s+/g,' ').trim();
      return {damage,stats:parts.join(' · '),descriptors:descriptors.map(id=>this.descriptorLabel(id)),text:text.length>140?`${text.slice(0,137)}…`:text,full:text};
    }catch{return null;}
  }
  renderItemInfo(info,compact=false){
    if(!info)return '';
    return `<div class="sy-item-info">${compact?(info.damage?`<small>${e(info.damage)}</small>`:''):`<small>${e(info.stats)}</small>`}${info.descriptors.length?`<span class="sy-item-tags">${info.descriptors.map(label=>`<em>${e(label)}</em>`).join('')}</span>`:''}${info.text?`<small class="sy-item-text" title="${e(info.full)}">${e(info.text)}</small>`:''}</div>`;
  }
  async renderEquipment(){
    if(!this.selected('class'))return '<p>Escolha uma classe para montar o equipamento inicial.</p>';
    const plan=await this.prepareEquipmentPlan();
    const fixed=plan.fixed.map(item=>`${item.quantity>1?`${item.quantity}× `:''}${item.entry.name}`).join(' · ');
    const infos=new Map();if(this.showItemInfo)await Promise.all(plan.groups.flatMap(group=>group.options.map(option=>option.items[0]?.entry)).filter(Boolean).map(async entry=>{if(!infos.has(entry.uuid))infos.set(entry.uuid,await this.itemInfo(entry));}));
    const infoToggle=`<div class="sy-info-toggle"><button type="button" role="switch" aria-checked="${this.showItemInfo}" data-op="toggleItemInfo" class="${this.showItemInfo?'is-on':''}"><span class="sy-switch" aria-hidden="true"></span>Detalhes dos itens</button><small>Dano, preço, volume, descritores e descrição em cada cartão.</small></div>`;
    const groups=infoToggle+plan.groups.map(group=>{const selected=this.equipmentChoices[group.id]??[],complete=selected.filter(Boolean).length===group.count;return `<section class="sy-choice">${complete?'<span class="sy-done" aria-label="Bloco concluído">✓</span>':''}<h3>${e(group.title)}</h3><small>${selected.filter(Boolean).length} de ${group.count} escolhidas</small><div class="sy-option-grid">${group.options.map(option=>{const item=option.items[0]?.entry,chosen=selected.includes(option.id);return `<article class="sy-option ${chosen?'is-selected':''}">${item?`<button class="sy-help" data-op="openSheet" data-uuid="${e(item.uuid)}" aria-label="Ver item" title="Ver item">?</button><img src="${e(safeImage(item.img))}" alt="">`:''}<strong>${e(option.label)}</strong>${this.showItemInfo&&item?this.renderItemInfo(infos.get(item.uuid)):''}<button data-op="chooseEquipment" data-group="${e(group.id)}" data-option="${e(option.id)}" aria-pressed="${chosen}">${chosen?'✓ Escolhido':'Escolher'}</button></article>`;}).join('')}</div></section>`;}).join('');
    const initialErrors=this.equipmentResolved.errors.filter(error=>!error.includes('compra')&&!error.includes('Compras')),canFinalize=!initialErrors.length;
    if(!this.equipmentFinalized)return `<p>As quantidades e munições adequadas são adicionadas automaticamente. Finalize o equipamento inicial para liberar a loja.</p>${fixed?`<p><strong>Itens fixos:</strong> ${e(fixed)}</p>`:''}${plan.notes.map(note=>`<p class="sy-note">${e(note)}</p>`).join('')}${groups}${initialErrors.map(error=>`<p class="sy-alert">${e(error)}</p>`).join('')}<button class="sy-primary qd-button qd-button--primary" data-op="finalizeEquipment" ${canFinalize?'':'disabled'}>Finalizar equipamento inicial</button>`;
    const money=this.money()??{cash:0,equipmentBudget:0},shop=shopItems(this.catalog,this.shopQuery),volume=totalVolume(this.equipmentResolved.items),capacity=carryingCapacity(this.draft.attributes.str);
    const shopInfos=new Map();
    if(this.showShopInfo){for(let i=0;i<shop.length;i+=20)await Promise.all(shop.slice(i,i+20).map(async item=>{shopInfos.set(item.uuid,await this.itemInfo(item));}));}
    const categories=[...new Set(shop.map(item=>item.type))];const categoryBlocks=categories.map(category=>`<section class="sy-shop-category"><h3>${e(LABELS[category]??category)}</h3>${shop.filter(item=>item.type===category).map(item=>{const cashQty=this.purchasesCash.get(item.uuid)??0,budgetQty=this.purchasesBudget.get(item.uuid)??0;return `<article class="sy-shop-item"><img src="${e(safeImage(item.img))}" alt=""><span><strong>${e(item.name)}</strong><small>T$ ${item.system.price} · ${itemVolume(item)} vol.</small>${this.showShopInfo?this.renderItemInfo(shopInfos.get(item.uuid),true):''}</span><button data-op="buyCash" data-uuid="${e(item.uuid)}">T$ +</button>${money.equipmentBudget&&['equipment','consumable','loot'].includes(item.type)?`<button data-op="buyBudget" data-uuid="${e(item.uuid)}">Verba +</button>`:''}</article>`;}).join('')}</section>`).join('');
    const cart=[...new Set([...this.purchasesCash.keys(),...this.purchasesBudget.keys()])].map(uuid=>{const item=this.catalog.entry?.(uuid)??this.catalog.items.find(entry=>entry.uuid===uuid),cashQty=this.purchasesCash.get(uuid)??0,budgetQty=this.purchasesBudget.get(uuid)??0;return item?`<article class="sy-cart-item"><img src="${e(safeImage(item.img))}" alt=""><span><strong>${e(item.name)}</strong><small>${cashQty?`${cashQty} pela bolsa`:''}${cashQty&&budgetQty?' · ':''}${budgetQty?`${budgetQty} pela verba`:''}</small></span>${cashQty?`<button data-op="removeCash" data-uuid="${e(uuid)}" aria-label="Remover da bolsa">×</button>`:''}${budgetQty?`<button data-op="removeBudget" data-uuid="${e(uuid)}" aria-label="Remover da verba">×</button>`:''}</article>`:'';}).join('');
    return `<div class="sy-complete-line"><span class="sy-done">✓</span><strong>Equipamento inicial finalizado</strong><button data-op="editEquipment">Alterar escolhas</button></div><h3>Compras adicionais</h3><div class="sy-stats"><div>Bolsa restante<strong>T$ ${this.purchaseResolved.cashRemaining}</strong></div>${money.equipmentBudget?`<div>Verba restante<strong>T$ ${this.purchaseResolved.budgetRemaining}</strong></div>`:''}<div>Volume<strong>${volume} / ${capacity}</strong></div></div>${volume>capacity?'<p class="sy-alert">O inventário ultrapassa a capacidade baseada em FOR.</p>':''}<div class="sy-info-toggle"><button type="button" role="switch" aria-checked="${this.showShopInfo}" data-op="toggleShopInfo" class="${this.showShopInfo?'is-on':''}"><span class="sy-switch" aria-hidden="true"></span>Detalhes dos itens</button><small>Dano, descritores e descrição na loja.</small></div><label>Buscar item para comprar<input name="shopQuery" value="${e(this.shopQuery)}"></label><div class="sy-shop-columns">${categoryBlocks||'<p>Nenhum item encontrado.</p>'}</div><section class="sy-cart"><h3>Carrinho</h3>${cart||'<small>Nenhum item adicional.</small>'}</section>${this.purchaseResolved.errors.map(error=>`<p class="sy-alert">${e(error)}</p>`).join('')}`;
  }
  async renderCatalog(type,extra=false){
    let list=this.catalog.list(type,this.query);
    if(type==='heritage') {
      if(!this.selected('legacy')) return '<p>Escolha primeiro um legado. As heranças serão mostradas conforme os vínculos oficiais do compêndio.</p>';
      const allowed=new Set(this.heritageOptions.map(item=>item.uuid));
      list=list.filter(item=>allowed.has(item.uuid));
    }
    const cards=list.map(i=>{const chosen=extra?this.extra.has(i.uuid):this.draft.selections[type]===i.uuid;return `<article class="sy-card ${chosen?'is-selected':''}">${chosen?'<span class="sy-done" aria-label="Escolhido">✓</span>':''}<button class="sy-help" data-op="detail" data-uuid="${e(i.uuid)}" aria-label="Ver descrição" title="Ver descrição">?</button><img src="${e(safeImage(i.img))}" alt="${e(i.name)}" loading="lazy"><div><h3>${e(i.name)}</h3><button data-op="${extra?'extra':'select'}" data-type="${type}" data-uuid="${e(i.uuid)}" aria-pressed="${chosen}">${extra?(chosen?'Remover':'Separar'):(chosen?'✓ Escolhido':'Escolher')}</button></div></article>`;}).join('');
    const searchable=!['heritage','curse'].includes(type),search=searchable?`<label>Buscar em ${e(LABELS[type])}<input name="query" value="${e(this.query)}" placeholder="Buscar pelo nome…"></label>`:'';
    const missing=this.attentionStep===this.step&&!this.stepDone(this.step);
    const animalField=type==='heritage'&&this.selected('legacy')?.name==='Gnomo'?`<section class="sy-choice"><h3>Ânima do gnomo</h3><label>Qual é o animal?<input name="animal" value="${e(this.draft.animal??'')}" placeholder="Ex.: gato, cobra, gavião…"></label><small>Escolha a estrutura de herança abaixo e confira suas características na Formação.</small></section>`:'';

    return `${animalField}${type==='legacy'?`<p class="sy-note"><strong>${list.length}</strong> legados disponíveis nesta mesa.</p>`:''}${type==='curse'?`<button class="${this.draft.noCurse?'is-selected':''} ${missing?'sy-required':''}" data-op="noCurse" aria-pressed="${this.draft.noCurse}">${this.draft.noCurse?'✓ Sem maldição':'Sem maldição'}</button>`:''}${search}${extra?'<p>Separe os documentos que deseja consultar.</p>':''}${missing?`<p class="sy-alert sy-required-message">${e(this.stepIssues(this.step)[0])}</p>`:''}<div class="sy-grid ${missing?'sy-required-grid':''}">${cards||'<p>Nenhum documento encontrado. Confira os compêndios e suas permissões.</p>'}</div>${await this.renderDetail()}`;
  }
  renderAttributes(){
    const d=this.draft,keys=Object.keys(ABILITIES),base=[3,2,1,1,0,-1];
    let fields=keys.map((key,i)=>`<label>${ABILITIES[key]}${d.method==='fixed'?`<select name="slot-${i}">${base.map((v,j)=>`<option value="${j}" ${d.slots[i]===j?'selected':''}>${v>=0?'+':''}${v}${j===2?' (A)':j===3?' (B)':''}</option>`).join('')}</select>`:d.method==='conventional'?`<select name="rollslot-${i}">${this.rolls.map((r,j)=>`<option value="${j}" ${this.rollSlots[i]===j?'selected':''}>Rolagem ${j+1}: ${r.value}</option>`).join('')}</select>`:`<input name="attr-${key}" type="number" min="-4" max="4" value="${d.attributes[key]}" ${d.method==='ordered'?'disabled':''}>`}</label>`).join('');
    const hpChoice=d.level>1?`<section class="sy-choice"><h3>Vida dos níveis 2 a ${d.level}</h3><label>Método<select name="hpMethod"><option value="fixed" ${d.hpMethod==='fixed'?'selected':''}>Valor fixo da classe</option><option value="rolled" ${d.hpMethod==='rolled'?'selected':''}>Rolar os dados de vida</option></select></label>${d.hpMethod==='rolled'?`<button data-op="rollHitPoints">Rolar ${d.level-1} dado(s) de vida</button><p>${d.hpRolls.length?`Resultados: ${d.hpRolls.join(', ')}`:'Rolagem pendente.'}</p>`:'<p>O bônus fixo da classe e CON são aplicados automaticamente em cada nível.</p>'}</section>`:'';
    return `<label>Método<select name="method">${[['fixed','Valores fixos'],['conventional','Rolagem convencional'],['ordered','Rolagem em ordem'],['manual','Digitar modificadores acordados com o mestre']].map(([v,l])=>`<option value="${v}" ${d.method===v?'selected':''}>${l}</option>`).join('')}</select></label><div class="sy-attributes">${fields}</div>${d.method==='fixed'?`<label>Atributo que recebe +1<select name="boost">${keys.map((k,i)=>`<option value="${i}" ${d.boost===i?'selected':''}>${ABILITIES[k]}</option>`).join('')}</select></label>`:''}${['conventional','ordered'].includes(d.method)?`<div class="sy-row"><button data-op="rollAttributes">Rolar seis conjuntos de 4d6</button><button data-op="rerollLowest" ${!this.rolls.length||!this.attrErrors().length?'disabled':''}>Rerrolar o menor</button></div><ol>${this.rolls.map(r=>`<li>${r.dice.join(' + ')} · descarta ${r.discarded} → ${r.total} → ${r.value}</li>`).join('')}</ol>`:''}${d.method==='ordered'&&this.rolls.length?`<div class="sy-row">${[0,1].map(i=>`<label>Trocar atributo ${i+1}<select name="swap-${i}">${keys.map((k,j)=>`<option value="${j}" ${this.swap[i]===j?'selected':''}>${ABILITIES[k]}</option>`).join('')}</select></label>`).join('')}<button data-op="swap">Aplicar uma troca</button></div>`:''}${hpChoice}<p>Resultado: ${keys.map(k=>`${ABILITIES[k]} ${d.attributes[k]}`).join(' · ')}</p>${this.attrErrors().map(t=>`<p class="sy-alert">${e(t)}</p>`).join('')}<small>Os seis conjuntos de 4d6 seguem a regra do livro. No nível 1, a vida usa o máximo do dado da classe + CON.</small>`;
  }
  renderMoney(){
    const rules={class:classRules(this.selected('class')?.name)?.money,background:backgroundRules(this.selected('background')?.name)};
    if(!rules.class||!rules.background)return '<p>Escolha classe e antecedente com regras de dinheiro conhecidas.</p>';
    const result=this.money();
    const summary=result?`<section class="sy-money-total"><h3>Total inicial</h3><div class="sy-stats"><div>Classe<strong>T$ ${result.fromClass}</strong></div><div>Antecedente<strong>T$ ${result.fromBackground}</strong></div><div>Bolsa final<strong>T$ ${result.cash}</strong></div></div>${result.equipmentBudget?`<p>O valor do antecedente é uma verba separada de T$ ${result.equipmentBudget}; o valor da classe continua na bolsa.</p>`:''}</section>`:'';
    const override=this.draft.moneyOverride;
    return Object.entries(rules).map(([key,r])=>`<section><h3>${key==='class'?'Classe':'Antecedente'} · ${r.dice}d${r.sides??6}${r.bonus?` + ${r.bonus}`:''}</h3><label>Soma dos dados, sem o bônus<input name="money-${key}" type="number" min="${r.dice}" max="${r.dice*(r.sides??6)}" value="${this.sums[key]??''}" ${override!=null?'disabled':''}></label><div class="sy-row"><button data-op="rollMoney" data-kind="${key}" ${override!=null?'disabled':''}>Rolar ${r.dice}d${r.sides??6}</button><button data-op="clearMoney" data-kind="${key}" ${override!=null||this.sums[key]==null?'disabled':''}>Limpar</button></div>${r.budgetOnly?'<p>Esta quantia é verba para equipamentos de exploração, não dinheiro livre.</p>':''}${r.debt?'<p>A dívida equivale a dez vezes o valor recebido pelo antecedente.</p>':''}</section>`).join('')+`<section class="sy-choice"><h3>Ajuste do mestre</h3><label>Total final acordado em T$ (opcional — substitui a soma dos dados acima)<input name="moneyOverride" type="number" min="0" value="${override??''}"></label>${override!=null?'<p class="sy-note">Usando o valor acordado com o mestre. Limpe o campo para voltar às rolagens.</p>':''}</section>`+summary+'<p>1 Pilar = 10 Trocados · 1 K = 1.000 Trocados.</p><small>Campos aceitam resultados de dados físicos. O bônus é somado uma única vez.</small>';
  }
  errors(){const errors=[];if(!this.selected('curse')&&!this.draft.noCurse)errors.push('Escolha uma maldição ou confirme Sem maldição.');if(this.equipmentResolved&&Number.isInteger(this.draft.attributes.str)&&totalVolume(this.equipmentResolved.items)>carryingCapacity(this.draft.attributes.str))errors.push('O inventário ultrapassa a capacidade de carga.');if(this.selected('legacy')?.name==='Gnomo'&&!this.draft.animal?.trim())errors.push('Informe o animal da ânima do gnomo na etapa Herança.');if(!this.draft.name.trim())errors.push('Nome não informado.');for(const t of ['legacy','heritage','background','class'])if(!this.selected(t))errors.push(`${LABELS[t]}: escolha pendente.`);if(this.benefitPlan){if(!this.benefitPlan.included.some(item=>item.entry.uuid===this.draft.selections.heritage))errors.push('A herança escolhida não pertence ao legado selecionado.');errors.push(...validateBenefitChoices(this.benefitPlan,this.benefitChoices));const spellGroupIds=new Set(this.benefitPlan.groups.filter(g=>g.granting==='spell').map(g=>g.id));const spellPicks=Object.entries(this.benefitChoices).filter(([gid])=>spellGroupIds.has(gid)).flatMap(([,list])=>list??[]).filter(Boolean);if(new Set(spellPicks).size!==spellPicks.length)errors.push('Há uma magia escolhida em mais de um nível. Remova a repetição.');if(requiresSpellcasting(this.selected('class')?.name,this.benefitPlan)&&!this.draft.spellcasting)errors.push('Escolha o atributo-chave de conjuração.');}else errors.push('Progressão e benefícios ainda não foram conferidos.');if(this.draft.hpMethod==='rolled'&&this.draft.level>1&&this.draft.hpRolls.length!==this.draft.level-1)errors.push('Role todos os dados de vida dos níveis adicionais.');if(this.trainingResolved){errors.push(...this.trainingResolved.errors);const benefitUuids=new Set(Object.values(this.benefitChoices).flat());if(this.trainingResolved.spells.some(uuid=>benefitUuids.has(uuid)))errors.push('O bônus de INT não pode repetir um truque já escolhido como benefício de classe.');}else errors.push('Perícias e proficiências ainda não foram conferidas.');if(this.equipmentResolved)errors.push(...this.equipmentResolved.errors);else errors.push('Equipamento inicial de classe ainda não foi conferido.');errors.push(...this.attrErrors());if(!this.money())errors.push('Dinheiro inicial ainda não foi determinado.');return errors;}
  async renderReview(){
    if(this.selected('legacy')&&this.selected('heritage')&&this.selected('background')&&this.selected('class')){await this.prepareBenefitPlan();await this.prepareTrainingPlan();await this.prepareEquipmentPlan();}
    const errors=this.errors(),money=this.money(),bag=money?wallet(this.purchaseResolved?.cashRemaining??money.cash):null;
    const row=(label,value)=>`<div><dt>${e(label)}</dt><dd>${e(value??'—')}</dd></div>`;
    const training=this.trainingResolved;
    const skills=training?.skills.map(id=>SKILLS[id]??APTITUDES[id]??id).join(', ');
    const benefits=this.benefitPlan?.groups.map(group=>`<li><small>Nível ${group.atLevel} · ${e(group.title)}</small><span>${(this.benefitChoices[group.id]??[]).map(id=>e(this.catalog.entry(id)?.name??'Opção indisponível')).join(' · ')||'Escolha pendente'}</span></li>`).join('');
    return `<p class="sy-note">${this.actor?'Ficha criada.':'Confira suas escolhas antes de criar a ficha.'} Personagem de nível ${this.draft.level}; retrato e token são opcionais.</p>${errors.map(error=>`<p class="sy-alert">${e(error)}</p>`).join('')}<div class="sy-review-grid"><section class="sy-choice"><h3>${e(this.draft.name||'Sem nome')}</h3><dl>${['legacy','heritage','curse','background','class'].map(type=>row(LABELS[type],this.selected(type)?.name??(type==='curse'&&this.draft.noCurse?'Sem maldição':'—'))).join('')}${this.draft.animal?row('Ânima',this.draft.animal):''}</dl>${this.draft.biography?`<details><summary>Conceito e história</summary><p>${e(this.draft.biography).replace(/\n/g,'<br>')}</p></details>`:''}</section><section class="sy-choice"><h3>Atributos e treinamento</h3><div class="sy-review-attributes">${Object.entries(this.draft.attributes).map(([key,value])=>`<span><small>${ABILITIES[key]}</small><strong>${value??'—'}</strong></span>`).join('')}</div><dl>${row('Perícias',skills)}${row('Expert',training?.expertise.map(id=>SKILLS[id]??APTITUDES[id]??id).join(', '))}${row('Proficiências',training?.proficiencies.map(id=>PROFICIENCIES[id]??id).join(', '))}${row('Idiomas',training?.languages.map(id=>id==='common'?'Comum':LANGUAGES[id]??id).join(', '))}</dl></section><section class="sy-choice"><h3>Progressão até o nível ${this.draft.level}</h3><ul class="sy-review-benefits">${benefits||'<li>Sem escolhas adicionais registradas.</li>'}</ul><small>As concessões automáticas são aplicadas junto das escolhas de cada nível.</small></section><section class="sy-choice"><h3>Inventário e bolsa</h3><div class="sy-stats sy-wallet qd-equal-cards">${['k','p','t'].map(key=>`<div><small>${key.toUpperCase()}$</small><strong>${bag?.[key]??'—'}</strong></div>`).join('')}</div><ul>${this.equipmentResolved?.items.map(item=>`<li>${item.quantity} × ${e(item.entry.name)}</li>`).join('')||'<li>Equipamento pendente.</li>'}</ul>${this.equipmentResolved?`<small>Volume: ${totalVolume(this.equipmentResolved.items)} / ${Number.isInteger(this.draft.attributes.str)?carryingCapacity(this.draft.attributes.str):'—'}</small>`:''}${money?.debt?`<p>Dívida: T$ ${money.debt}</p>`:''}${money?.equipmentBudget?`<p>Verba de exploração: T$ ${money.equipmentBudget}</p>`:''}</section></div>${!this.actor&&errors.length?'<button data-op="createAnyway">Criar mesmo assim e corrigir depois na ficha</button>':''}`;
  }
  async handleClick(event){
    if(!this.element)return;
    const button=event.target.closest('button[data-op]');
    if(!button||button.disabled||this.busy)return;
    this.busy=true;button.disabled=true;this.message='';const navigation=['area','step','previous','next'].includes(button.dataset.op);if(navigation||['createCharacter','finalizeEquipment'].includes(button.dataset.op))await this.showBusy(button.dataset.op==='createCharacter'?'Criando a ficha…':'Preparando a próxima etapa…');if(button.dataset.op==='createCharacter')button.textContent='Criando a ficha…';
    try{const {op,uuid,type,kind}=button.dataset;
      if(op==='home'){this.saveDraft();if(this._editingRow!==null&&this._manualSnapshot){await this.loadProposal(this._manualSnapshot);}this._editingRow=null;this.screen='home';this.summaryOpen=false;}
      if(op==='manual'){this.screen='manual';if(this._editingRow!==null&&this._manualSnapshot){await this.loadProposal(this._manualSnapshot);}this._editingRow=null;}
      if(op==='summary'){if((this.element?.clientWidth??innerWidth)>1000)this.summaryHidden=!this.summaryHidden;else this.summaryOpen=!this.summaryOpen;}
      if(op==='settings'){if(!game.user.isGM)throw Error('Somente a Mestra configura o acesso.');this.saveDraft();this.playerSettings=null;this.screen='settings';}
      if(op==='saveSettings'){if(!game.user.isGM)throw Error('Somente a Mestra configura o acesso.');await configurePlayerCreation(this.playerSettings);this.message='Configuração salva. Cada jogador recebe Owner nas fichas que criar.';}
      if(op==='random'||op==='group'){if(op==='group'&&!game.user.isGM)throw Error('Somente a Mestra prepara grupos.');this.saveDraft();this._manualSnapshot=this.snapshot();this.screen=op;this.generated=[];this.interpreted=null;}
      if(op==='generate')await this.generateProposals();
      if(op==='rerollGenerated'){const index=Number(button.dataset.index);if(this.generated[index]?.createdActorId)throw Error('Esta ficha já foi criada.');await this.generateProposals(index);}
      if(op==='editGenerated'){const index=Number(button.dataset.index),row=this.generated[index];if(!row?.draft||row.createdActorId)throw Error('Prévia indisponível para edição.');this._returnScreen=this.screen;this._manualSnapshot??=this.snapshot();await this.loadProposal(row,index);}
      if(op==='returnGenerated'){
        if(this._editingRow===null)throw Error('Nenhuma prévia em edição.');
        await this.prepareBenefitPlan();await this.prepareTrainingPlan();await this.prepareEquipmentPlan();
        const row=this.generated[this._editingRow];Object.assign(row,this.snapshot(),{issues:this.errors(),reviewed:false,money:this.money()});this._editingRow=null;if(this._manualSnapshot){await this.loadProposal(this._manualSnapshot);}this.screen=this._returnScreen??'random';
      }
      if(op==='fillRandom'){
        if(this.actor)throw Error('A ficha já foi criada. Volte ao início para preparar outra.');
        const ok=await foundry.applications.api.DialogV2.confirm({window:{title:'Sortear restante'},content:'<p>Manter nome, nível, conceito, legado, herança, classe, antecedente e maldição já escolhidos. Sortear novamente atributos, benefícios, treinamento, dinheiro e equipamento?</p>'});
        if(ok){const previous={...this.draft},request=interpretRequest(this.catalog,{text:'',level:previous.level,fixed:previous.selections,noCurse:previous.noCurse,animal:previous.animal});await this.showBusy('Sorteando escolhas…');const row=await generateCharacter(this.catalog,request);row.draft={...row.draft,name:previous.name||row.draft.name,biography:previous.biography,portrait:previous.portrait,token:previous.token};const editing=this._editingRow;await this.loadProposal(row,editing);this.message=row.issues.length?row.issues.join(' '):'Proposta pronta. Revise as escolhas antes de criar a ficha.';}
      }
      if(op==='createGenerated')await this.createProposals();
      if(op==='openGenerated'){const actor=game.actors.get(this.generated[Number(button.dataset.index)]?.createdActorId);if(actor)actor.sheet.render(true);}

      if(op==='step'||op==='previous'||op==='next'){const previous=this.step;if(op==='next'&&this.step===7&&!this.attrErrors().length)this.attributesFinalized=true;this.step=op==='step'?Number(button.dataset.index):this.step+(op==='next'?1:-1);this.visited.add(previous);this.visited.add(this.step);this.attentionStep=op==='step'&&!this.stepDone(this.step)?this.step:op==='next'&&!this.stepDone(previous)?previous:null;this.query='';this.detail=null;}
      if(op==='select'){this.draft.selections[type]=uuid;if(type==='curse')this.draft.noCurse=false;this.benefitPlan=null;this.benefitChoices={};this.trainingPlan=null;this.trainingResolved=null;this.trainingChoices={};this.equipmentPlan=null;this.equipmentResolved=null;this.equipmentFinalized=false;this.equipmentChoices={};this.purchasesCash.clear();this.purchasesBudget.clear();if(type==='class'||type==='background')this.sums[type]=null;if(type==='legacy'){delete this.draft.selections.heritage;this.heritageOptions=await this.catalog.linkedItems(uuid,{type:'heritage',level:0});}this.attentionStep=null;}
      if(op==='noCurse'){delete this.draft.selections.curse;this.draft.noCurse=true;this.attentionStep=null;this.detail=null;}
      if(op==='extra'){if(this.extra.has(uuid))this.extra.delete(uuid);else this.extra.add(uuid);}
      if(op==='detail')await this.showDetail(uuid);
      if(op==='closeDetail')this.detail=null;
      if(op==='openSheet')(await this.catalog.document(uuid)).sheet.render(true);
      if(op==='chooseBenefit'){const group=button.dataset.group,groupDef=this.benefitPlan?.groups.find(item=>item.id===group),current=[...(this.benefitChoices[group]??[])],index=current.indexOf(uuid),limit=groupDef?.count??1;if(index>=0)current.splice(index,1);else if(groupDef?.granting==='spell'&&Object.entries(this.benefitChoices).some(([gid,list])=>gid!==group&&(list??[]).includes(uuid)&&this.benefitPlan?.groups.find(g=>g.id===gid)?.granting==='spell'))this.message='Essa magia já foi escolhida em outro nível. Remova lá antes de repetir.';else if(current.length<limit)current.push(uuid);else this.message=`Esta escolha aceita ${limit} opção(ões). Remova uma antes de trocar.`;this.benefitChoices[group]=current;this.benefitPlan=null;}
      if(op==='chooseEquipment'){const group=button.dataset.group,id=button.dataset.option,current=[...(this.equipmentChoices[group]??[])],index=current.indexOf(id),limit=this.equipmentPlan?.groups.find(item=>item.id===group)?.count??1;if(index>=0)current.splice(index,1);else if(current.length<limit)current.push(id);else this.message=`Esta escolha aceita ${limit} opção(ões).`;this.equipmentChoices[group]=current;this.equipmentResolved=null;this.equipmentFinalized=false;}
      if(op==='finalizeEquipment'){await this.prepareEquipmentPlan();const initialErrors=this.equipmentResolved.errors.filter(error=>!error.includes('compra')&&!error.includes('Compras'));if(initialErrors.length)throw Error(initialErrors.join(' '));this.equipmentFinalized=true;}
      if(op==='toggleItemInfo'){this.showItemInfo=!this.showItemInfo;try{localStorage.setItem('quedaco-item-info',this.showItemInfo?'1':'0');}catch{}}
      if(op==='toggleShopInfo'){this.showShopInfo=!this.showShopInfo;try{localStorage.setItem('quedaco-shop-info',this.showShopInfo?'1':'0');}catch{}}
      if(op==='editEquipment'){this.equipmentFinalized=false;this.purchasesCash.clear();this.purchasesBudget.clear();}
      if(['buyCash','removeCash','buyBudget','removeBudget'].includes(op)){const cart=op.includes('Budget')?this.purchasesBudget:this.purchasesCash,delta=op.startsWith('buy')?1:-1,next=(cart.get(uuid)??0)+delta;if(next>0)cart.set(uuid,next);else cart.delete(uuid);}
      if(op==='audit'){const report={...this.catalog.report(),benefitGraph:await this.catalog.auditBenefits()};baixarArquivo(JSON.stringify(report,null,2),'application/json','skyfall-auditoria-catalogo.json');this.message=`Auditoria exportada: ${report.missing.length} nomes do livro não localizados; ${report.benefitGraph.missing.length} vínculos quebrados; ${report.benefitGraph.unlinkedHeritages.length} heranças sem legado vinculado.`;}
      if(op==='rollAttributes'||op==='rerollLowest'){const rollOne=async()=>{const roll=await new Roll('4d6').evaluate();return conventionalRoll(roll.dice[0].results.map(d=>d.result));};if(op==='rollAttributes'){this.rolls=[];for(let i=0;i<6;i++)this.rolls.push(await rollOne());this.rollSlots=[0,1,2,3,4,5];}else{const i=this.rolls.findIndex(r=>r.total===Math.min(...this.rolls.map(r=>r.total)));this.rolls[i]=await rollOne();}this.applyRolled();}
      if(op==='rollHitPoints'){const rule=classRules(this.selected('class')?.name);if(!rule?.die)throw Error('Dado de vida da classe não localizado.');const roll=await new Roll(`${this.draft.level-1}d${rule.die}`).evaluate();this.draft.hpRolls=roll.dice.flatMap(die=>die.results.map(result=>result.result));}
      if(op==='swap'){const order=[0,1,2,3,4,5];[order[this.swap[0]],order[this.swap[1]]]=[order[this.swap[1]],order[this.swap[0]]];this.rollSlots=order;this.applyRolled();}
      if(op==='rollMoney'){const rule=kind==='class'?classRules(this.selected('class')?.name).money:backgroundRules(this.selected('background')?.name);const roll=await new Roll(`${rule.dice}d${rule.sides??6}`).evaluate();this.sums[kind]=roll.total;}
      if(op==='clearMoney')this.sums[kind]=null;
      if(op==='portrait'||op==='token'){const FP=foundry.applications.apps.FilePicker.implementation;new FP({type:'image',current:this.draft[op],callback:path=>{this.draft[op]=path;this.render(true);}}).render(true);}
      if(op==='clearMedia')this.draft[kind]='';
      if(op==='createCharacter')await this.createCharacter(false);
      if(op==='createAnyway'){const ok=await foundry.applications.api.DialogV2.confirm({window:{title:'Criar mesmo assim'},content:'<p>A ficha será criada com o que já foi escolhido. Tudo o que estiver pendente ou der problema fica para você corrigir depois, direto na ficha.</p>'});if(ok)await this.createCharacter(true);}
      if(op==='openActor')this.actor.sheet.render(true);
      if(op==='refill'){await refillResources(this.actor);this.message='Recursos preenchidos com os totais calculados pelo Skyfall.';}
    }catch(err){this.message=err.message;console.error(MODULE_ID,err);}finally{this.busy=false;this.rerender(!navigation);}
  }
  async showBusy(text){
    const shell=this.element?.querySelector?.('.sy-shell');if(!shell)return;
    shell.querySelector('.sy-busy')?.remove();
    shell.insertAdjacentHTML('beforeend',`<div class="sy-busy" role="status"><span></span><strong>${e(text)}</strong></div>`);
    await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));
  }
  busyText(text){const target=this.element?.querySelector?.('.sy-busy strong');if(target)target.textContent=text;}
  async createCharacter(force){
    if(force)await this.showBusy('Criando a ficha…');
    const pause=ms=>new Promise(resolve=>setTimeout(resolve,ms));
    if(this.actor)throw Error('A ficha já foi criada.');
    const warnings=[];
    const soft=async(label,work)=>{this.busyText(`Criando a ficha… ${label}`);await pause(250);try{return await work();}catch(err){console.error(MODULE_ID,label,err);warnings.push(`${label}: ${err.message}`);return null;}};
    const prepare=async(label,work)=>{try{return await work();}catch(err){if(!force)throw err;console.error(MODULE_ID,label,err);warnings.push(`${label}: ${err.message}`);return null;}};
    await prepare('Progressão',()=>this.prepareBenefitPlan());
    await prepare('Treinamento',()=>this.prepareTrainingPlan());
    await prepare('Equipamento',()=>this.prepareEquipmentPlan());
    let errors=[];try{errors=this.errors();}catch(err){errors=[`Não foi possível conferir as escolhas (${err.message}).`];}
    if(errors.length&&!force)throw Error(errors.join(' '));
    warnings.unshift(...errors);
    const base=this.money()??{cash:0,equipmentBudget:0};
    const money={cash:this.purchaseResolved?.cashRemaining??base.cash,equipmentBudget:this.purchaseResolved?.budgetRemaining??base.equipmentBudget,debt:base.debt};
    const attributes=Object.fromEntries(Object.entries(this.draft.attributes).map(([key,value])=>[key,Number.isInteger(value)?value:0]));
    this.actor=await createDraft({...this.draft,name:this.draft.name.trim()||'Novo aventureiro',attributes,...money});
    const actor=this.actor;
    const planItems=this.benefitPlan?await soft('Benefícios',()=>resolvedPlanItems(this.benefitPlan,this.benefitChoices))??[]:[];
    for(const spell of this.trainingResolved?.spells??[]){const entry=this.catalog.entry?.(spell)??this.catalog.items.find(item=>item.uuid===spell);if(entry)planItems.push({entry,originId:'quedaco-intelligence'});}
    await soft('Concessões da progressão',()=>addResolvedPlan(actor,planItems,this.catalog));
    await soft('Níveis da classe',()=>finalizeClassProgression(actor,this.draft.level));
    await soft('Trilhas',()=>finalizePathProgression(actor,planItems));
    if(this.equipmentResolved)await soft('Inventário',()=>addInventory(actor,this.equipmentResolved.items,this.catalog));
    if(this.trainingResolved)await soft('Treinamento',()=>actor.update({...actorTrainingUpdate(this.trainingResolved,{force}),[`flags.${MODULE_ID}.trainingNotes`]:this.trainingResolved.notes,[`flags.${MODULE_ID}.backgroundEquipmentNotes`]:this.equipmentPlan?.notes??[],[`flags.${MODULE_ID}.volumeAtCreation`]:totalVolume(this.equipmentResolved?.items??[])}));
    await soft('Pontos de vida',()=>applyHitPointProgression(actor,this.draft));
    await soft('Recursos',()=>refillResources(actor));
    if(warnings.length)await soft('Avisos',()=>actor.update({[`flags.${MODULE_ID}.creationWarnings`]:warnings}));
    if(this._editingRow!==null&&this.generated[this._editingRow])this.generated[this._editingRow].createdActorId=actor.id;
    this.message=warnings.length?`Ficha criada, mas com pendências para corrigir na ficha: ${warnings.join(' · ')}`:`Ficha de nível ${this.draft.level} criada com progressão, treinamento, equipamentos e recursos.`;
    if(this._editingRow===null)this.clearSavedDraft();
  }
  applyRolled(){if(this.rolls.length!==6)return;Object.keys(ABILITIES).forEach((k,i)=>{this.draft.attributes[k]=this.rolls[this.rollSlots[i]].value;});}
  applyFixed(){const base=[3,2,1,1,0,-1];Object.keys(ABILITIES).forEach((k,i)=>{this.draft.attributes[k]=base[this.draft.slots[i]]+(i===this.draft.boost?1:0);});}
  async handleChange(event){
    const {name,value}=event.target;if(!name)return;
    if(name==='playerEnabled'){this.playerSettings.enabled=event.target.checked;return;}
    if(name==='playerFolder'){this.playerSettings.folderId=value;return;}
    if(name.startsWith('reviewGenerated-')){const row=this.generated[Number(name.slice(16))];if(row&&!row.createdActorId)row.reviewed=event.target.checked;return;}
    if(name.startsWith('gen-')){
      const key=name.slice(4);
      if(['legacy','heritage','class','background','curse'].includes(key)){if(value)this.generator.fixed[key]=value;else delete this.generator.fixed[key];if(key==='legacy'){delete this.generator.fixed.heritage;this.heritageOptions=value?await this.catalog.linkedItems(value,{type:'heritage',level:0}):[];}}
      else this.generator[key]=['noCurse','variedRoles'].includes(key)?event.target.checked:key==='count'?Number(value):value;
      if(key==='legacy')this.rerender(true);return;
    }
    if(name==='jumpStep'){this.step=Math.max(0,Math.min(12,Number(value)||0));this.visited.add(this.step);this.rerender(false);return;}

    if(['name','biography','animal'].includes(name)){this.draft[name]=value;this.saveDraft();return;}
    if(name==='spellcasting')this.draft[name]=value;
    if(name==='hpMethod'){this.draft.hpMethod=value;this.draft.hpRolls=[];}
    if(name==='level'){this.draft.level=Math.max(1,Math.min(12,Number(value)||1));this.draft.hpRolls=[];this.benefitPlan=null;this.benefitChoices={};this.attributesFinalized=false;}
    if(name==='method'){this.draft.method=value;this.attributesFinalized=false;if(value==='fixed')this.applyFixed();if(['ordered','conventional'].includes(value)){this.rollSlots=[0,1,2,3,4,5];this.applyRolled();}}
    if(name.startsWith('slot-')){this.draft.slots[Number(name.slice(5))]=Number(value);this.attributesFinalized=false;this.applyFixed();}
    if(name==='boost'){this.draft.boost=Number(value);this.attributesFinalized=false;this.applyFixed();}
    if(name.startsWith('attr-')){this.draft.attributes[name.slice(5)]=value===''?null:Number(value);this.attributesFinalized=false;}
    if(name.startsWith('rollslot-')){const i=Number(name.slice(9)),j=this.rollSlots.indexOf(Number(value));[this.rollSlots[i],this.rollSlots[j]]=[this.rollSlots[j],this.rollSlots[i]];this.applyRolled();}
    if(name.startsWith('swap-'))this.swap[Number(name.slice(5))]=Number(value);
    if(name.startsWith('money-'))this.sums[name.slice(6)]=value===''?null:Number(value);
    if(name==='moneyOverride')this.draft.moneyOverride=value===''?null:Math.max(0,Math.floor(Number(value)||0));
    if(name==='query')this.query=value;
    if(name==='catalogType'){this.type=value;this.query='';this.detail=null;}
    if(name==='benefit'){const group=event.target.dataset.group,index=Number(event.target.dataset.choiceIndex);const selected=[...(this.benefitChoices[group]??[])];selected[index]=value;this.benefitChoices[group]=selected;}
    if(name==='trainingApt'){this.trainingChoices[aptitudeKey(event.target.dataset.group)]=[value];this.trainingResolved=null;}
    if(name==='training'){if(event.target.dataset.option==='skill:apti'&&!event.target.checked)delete this.trainingChoices[aptitudeKey(event.target.dataset.group)];const group=event.target.dataset.group,option=event.target.dataset.option,definition=this.trainingPlan?.groups.find(item=>item.id===group);let selected=[...(this.trainingChoices[group]??[])].filter(item=>item!==option);if(event.target.checked){if(selected.length>=(definition?.count??1))this.message=`${definition?.title}: o limite é ${definition?.count}.`;else selected.push(option);}this.trainingChoices[group]=selected;this.trainingResolved=null;}
    if(name==='equipment'){const group=event.target.dataset.group,index=Number(event.target.dataset.choiceIndex);const selected=[...(this.equipmentChoices[group]??[])];selected[index]=value;this.equipmentChoices[group]=selected;}
    if(name==='shopQuery')this.shopQuery=value;
    this.rerender(true);
  }
}
