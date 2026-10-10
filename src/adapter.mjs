import { ABILITIES, wallet, walletTotal } from './rules.mjs';
export const MODULE_ID='quedaco-personagens-skyfall-rpg';
/** Adapter for the inspected Skyfall 1.0.1 schema. Never reimplements its effects. */
export function assertCompatible(game) {
  if (game.system.id !== 'skyfall') throw Error('Este criador requer o sistema Skyfall.');
  if (Number(String(game.version).split('.')[0]) !== 13) throw Error('Esta versão do criador foi preparada para Foundry 13.');
}
export function actorSource(draft, userId) {
  if (!draft.name?.trim()) throw Error('Dê um nome ao personagem.');
  if (!draft.attributes || Object.values(draft.attributes).some(v=>!Number.isInteger(v)||v< -4||v>4)) throw Error('Atributos inválidos.');
  if (Object.keys(ABILITIES).some(k=>!(k in draft.attributes))) throw Error('Faltam atributos.');
  return {
    name:draft.name.trim(), type:'character', img:draft.portrait||'icons/svg/mystery-man.svg',
    ownership:{default:0,[userId]:3},
    prototypeToken:{name:draft.name.trim(),actorLink:true,texture:{src:draft.token||draft.portrait||'icons/svg/mystery-man.svg'}},
    system:{abilities:Object.fromEntries(Object.entries(draft.attributes).map(([k,value])=>[k,{value}])),
      currency:wallet(draft.cash),...(draft.spellcasting?{spellcasting:draft.spellcasting}:{}),
      biography:escapeHTML(draft.biography??'').replace(/\n/g,'<br>'),
      resources:{hp:{value:0},ep:{value:0},shadow:{value:5},catharsis:{value:0}}},
    flags:{[MODULE_ID]:{state:'draft',draftVersion:2,creator:userId,targetLevel:draft.level??1,plan:draft.selections,notes:{debt:draft.debt??0,equipmentBudget:draft.equipmentBudget??0,hpRolls:draft.hpRolls??[]}}}
  };
}
export function escapeHTML(value) {return String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
/** O global saveDataToFile saiu no Foundry 13; os botões de exportar morriam calados.
 *  Usa a API nova, cai no global antigo e, em último caso, baixa por Blob na mão. */
export function baixarArquivo(data,type,filename) {
  const nativo=globalThis.foundry?.utils?.saveDataToFile??globalThis.saveDataToFile;
  if(typeof nativo==='function')return nativo(data,type,filename);
  const blob=new Blob([data],{type}),url=URL.createObjectURL(blob);
  const link=document.createElement('a');link.href=url;link.download=filename;
  document.body.appendChild(link);link.click();link.remove();
  setTimeout(()=>URL.revokeObjectURL(url),1000);
}
export function safeImage(path) {
  const value=String(path??'');
  if (!value || /^(?:javascript|data|file):/i.test(value) || value.startsWith('//')) return 'icons/svg/mystery-man.svg';
  return value;
}
export const classOrigins=level=>Array.from({length:Math.max(1,Math.min(12,Number(level)||1))},(_,index)=>`class-${String(index+1).padStart(2,'0')}`);
export async function createDraft(draft) {
  assertCompatible(game);
  if (!game.user.can('ACTOR_CREATE')) throw Error('Seu usuário não tem permissão para criar personagens. Peça ao mestre para habilitar a criação de Atores.');
  const actor=await Actor.create(actorSource(draft,game.user.id));
  if (!actor) throw Error('O sistema não criou a ficha.');
  return actor;
}
export async function addDocument(actor, document) {
  if (!actor.isOwner) throw Error('Você não tem acesso de edição a essa ficha.');
  if (actor.items.some(i=>i._stats?.compendiumSource===document.uuid)) throw Error('Este conteúdo já está na ficha.');
  const data=document.toObject();delete data._id;
  data._stats={...data._stats,compendiumSource:document.uuid};
  if(document.type==='class') {data.system.level=1;data.system.initial=true;data.system.origin=classOrigins(1);data.system.hitDie.value=1;}
  // Native lifecycle opens Skyfall's choices and applies its own origins/effects.
  const created=await actor.createEmbeddedDocuments('Item',[data]);
  if (!created?.length) throw Error('O sistema não adicionou o conteúdo; revise as escolhas na ficha.');
  return created[0];
}
export function embeddedSource(document,originId=null,level=null) {
  const data=document.toObject();delete data._id;
  data._stats={...data._stats,compendiumSource:document.uuid};
  // Trilhas recebem o slot (path-01/path-02) do próprio ciclo de criação do Skyfall.
  if (originId&&document.type!=='path') data.system.origin=[originId];
  if(document.type==='class') {const target=Math.max(1,Math.min(12,Number(level)||1));data.system.level=target;data.system.initial=true;data.system.origin=classOrigins(target);data.system.hitDie.value=target;}
  return data;
}
export async function purchaseItem(buyer,merchantActor,entry,qty=1,resolveDocument=globalThis.fromUuid,{haggleWon=false}={}){
  if(!buyer?.isOwner)throw Error('Você não tem acesso de edição ao comprador.');
  if(!Number.isInteger(qty)||qty<1)throw Error('A quantidade deve ser um inteiro positivo.');
  if(!String(entry?.uuid??'').startsWith('Compendium.'))throw Error('A loja só entrega itens vindos de compêndio.');
  const document=await resolveDocument(entry.uuid);
  if(!document)throw Error('O item do compêndio não foi encontrado.');
  const shop=merchantActor?.flags?.[MODULE_ID]?.npc?.shop??{};
  const stock=Array.from(shop.stock??[]),stockIndex=stock.findIndex(item=>item.uuid===entry.uuid);
  const stockEntry=stockIndex>=0?stock[stockIndex]:entry;
  if(Number.isFinite(stockEntry.qty)&&stockEntry.qty<qty)throw Error('A loja não possui essa quantidade.');
  const basePrice=Number(document.system?.price??0),markup=Number(shop.markup??1);
  const tabelado=entry.price==null?Math.round(basePrice*(Number.isFinite(markup)&&markup>0?markup:1)):Number(entry.price);
  if(!Number.isSafeInteger(tabelado)||tabelado<0)throw Error('O preço deste item é inválido.');
  // atitude do mercador + condições do livro na ficha de quem compra
  const conta=quote({unitBase:tabelado,attitude:shop.attitude??DEFAULT_ATTITUDE,attitudeOverride:shop.attitudeOverride,
    conditions:buyerConditions(buyer),kind:itemKind(document),haggleWon:Boolean(haggleWon),qty});
  const unit=conta.unit,total=conta.total,current=walletTotal(buyer.system?.currency??{});
  if(current<total)throw Error('Moeda insuficiente.');
  const source=embeddedSource(document);source.system={...source.system,quantity:qty};
  // Crime que Compensa troca preço por desgaste: o descritor QUEBRADIÇO é do próprio
  // sistema Skyfall (chave 'brittle'), então o item comprado assim já nasce marcado.
  if(conta.brittle){
    const atuais=Array.from(source.system.descriptors??[]);
    if(!atuais.includes('brittle'))source.system={...source.system,descriptors:[...atuais,'brittle']};
  }
  await buyer.update({'system.currency':wallet(current-total)});
  let created=[];
  try{created=await buyer.createEmbeddedDocuments('Item',[source])??[];}
  catch(error){await buyer.update({'system.currency':wallet(current)});throw error;}
  if(stockIndex>=0&&Number.isFinite(stockEntry.qty)){
    stock[stockIndex]={...stockEntry,qty:stockEntry.qty-qty};
    await merchantActor.update({[`flags.${MODULE_ID}.npc.shop.stock`]:stock});
  }
  return {unit,total,remaining:current-total,source,created,quote:conta};
}
/**
 * Fecha o carrinho inteiro de uma vez. Cada linha passa pelo mesmo `purchaseItem`,
 * então a conta de atitude/condições continua sendo uma só. Se qualquer linha falhar
 * no meio (dinheiro acabou, estoque sumiu), desfaz tudo: devolve a moeda ao saldo de
 * antes, apaga os itens já entregues e repõe o estoque do mercador como estava.
 */
export async function purchaseCart(buyer,merchantActor,lines=[],resolveDocument=globalThis.fromUuid,{haggleWon=false}={}){
  if(!Array.isArray(lines)||!lines.length)throw Error('O carrinho está vazio.');
  const saldoInicial=walletTotal(buyer?.system?.currency??{});
  const estoqueInicial=Array.from(merchantActor?.flags?.[MODULE_ID]?.npc?.shop?.stock??[]);
  const compras=[],entregues=[];
  try{
    for(const line of lines){
      const compra=await purchaseItem(buyer,merchantActor,line.entry,Math.max(1,Number(line.qty)||1),resolveDocument,{haggleWon});
      compras.push(compra);
      for(const document of compra.created??[])if(document?.id)entregues.push(document.id);
    }
  }catch(error){
    try{if(entregues.length)await buyer.deleteEmbeddedDocuments('Item',entregues);}catch(falha){console.error(MODULE_ID,'carrinho: itens não devolvidos',falha);}
    try{await buyer.update({'system.currency':wallet(saldoInicial)});}catch(falha){console.error(MODULE_ID,'carrinho: moeda não devolvida',falha);}
    try{await merchantActor?.update?.({[`flags.${MODULE_ID}.npc.shop.stock`]:estoqueInicial});}catch(falha){console.error(MODULE_ID,'carrinho: estoque não reposto',falha);}
    throw error;
  }
  return {lines:compras,total:compras.reduce((soma,compra)=>soma+compra.total,0),remaining:saldoInicial-compras.reduce((soma,compra)=>soma+compra.total,0)};
}
/**
 * O grupo vende um item da própria ficha para um NPC. Vale para qualquer NPC, tenha
 * ele estoque de venda ou não — quem compra do grupo não precisa ter loja montada.
 * O preço sai de `sellQuote`: metade do preço do livro, salvo Crime que Compensa.
 */
export async function sellItem(seller,merchantActor,item,qty=1,{haggleWon=false}={}){
  if(!seller?.isOwner)throw Error('Você não tem acesso de edição a essa ficha.');
  if(!item?.id)throw Error('Escolha um item da ficha para vender.');
  if(!Number.isInteger(qty)||qty<1)throw Error('A quantidade deve ser um inteiro positivo.');
  const disponivel=Math.max(1,Math.floor(Number(item.system?.quantity)||1));
  if(qty>disponivel)throw Error('Você não tem essa quantidade para vender.');
  const unitBase=Number(item.system?.price);
  if(!Number.isFinite(unitBase)||unitBase<=0)throw Error('Este item não tem preço de tabela para revender.');
  const conta=sellQuote({unitBase,conditions:buyerConditions(seller),haggleWon:Boolean(haggleWon),qty});
  const atual=walletTotal(seller.system?.currency??{});
  await seller.update({'system.currency':wallet(atual+conta.total)});
  try{
    if(qty>=disponivel)await seller.deleteEmbeddedDocuments('Item',[item.id]);
    else await seller.updateEmbeddedDocuments('Item',[{_id:item.id,'system.quantity':disponivel-qty}]);
  }catch(error){await seller.update({'system.currency':wallet(atual)});throw error;}
  return {unit:conta.unit,total:conta.total,remaining:atual+conta.total,quote:conta};
}
/** O _preCreate da classe reescreve origin para ['class-01']; refixa a lista completa por update. */
export async function finalizeClassProgression(actor,targetLevel) {
  const level=Math.max(1,Math.min(12,Number(targetLevel)||1));
  const cls=actor.items.find(item=>item.type==='class'&&item.system?.initial)??actor.items.find(item=>item.type==='class');
  if(!cls) return;
  const want=classOrigins(level),have=Array.from(cls.system?.origin??[]).filter(id=>/^class-\d\d$/.test(id));
  if(have.length===want.length&&want.every(id=>have.includes(id))) return;
  await cls.update({'system.origin':want,'system.level':level});
}
/** O ciclo de criação do Skyfall só encaixa a trilha no slot path-01/path-02 quando o item é
 *  criado sozinho (fora do lote). Aqui garantimos o slot por update depois. */
export async function finalizePathProgression(actor,planItems=[]) {
  const requested=planItems.filter(item=>item.entry?.type==='path').map(item=>item.entry.uuid);
  if(!requested.length)return;
  const desired=new Map();
  requested.slice(0,2).forEach((uuid,index)=>{
    const slots=desired.get(uuid)??[];
    slots.push(`path-${String(index+1).padStart(2,'0')}`);
    desired.set(uuid,slots);
  });
  const updates=[];
  for(const path of actor.items.filter(item=>item.type==='path')){
    const source=path._stats?.compendiumSource;
    const slots=desired.get(source);
    if(!slots)continue;
    const origin=Array.from(path.system?.origin??[]).filter(id=>!/^path-\d\d$/.test(id));
    origin.push(...slots);
    if(Array.from(path.system?.origin??[]).join('|')!==origin.join('|'))updates.push({_id:path.id,'system.origin':origin});
  }
  if(updates.length) await actor.updateEmbeddedDocuments('Item',updates);
}
export async function addResolvedPlan(actor,planItems,catalog) {
  if (!actor.isOwner) throw Error('Você não tem acesso de edição a essa ficha.');
  const seen=new Set(actor.items.map(item=>item._stats?.compendiumSource).filter(Boolean));
  const batch=[],paths=[];
  for (const item of planItems) {
    if (item.entry.type!=='path'&&seen.has(item.entry.uuid)) continue;
    const document=item.document??await catalog.document(item.entry.uuid);
    (document.type==='path'?paths:batch).push(embeddedSource(document,item.originId,item.level));
    if(item.entry.type!=='path')seen.add(item.entry.uuid);
  }
  const BenefitsDialog=globalThis.skyfall?.applications?.BenefitsDialog;
  const originalPrompt=BenefitsDialog?.prompt;
  const created=[];
  try {
    if (BenefitsDialog&&typeof originalPrompt==='function') BenefitsDialog.prompt=()=>null;
    if (batch.length) created.push(...(await actor.createEmbeddedDocuments('Item',batch)??[]));
    // trilhas uma a uma: o _preCreate do Skyfall precisa ver as anteriores para dar path-01/path-02
    for (const source of paths) {
      try { created.push(...(await actor.createEmbeddedDocuments('Item',[source])??[])); }
      catch (error) { console.error(MODULE_ID,'trilha',error); }
    }
  } finally {
    if (BenefitsDialog&&typeof originalPrompt==='function') BenefitsDialog.prompt=originalPrompt;
  }
  return created;
}
export async function addInventory(actor,items,catalog) {
  if (!actor.isOwner) throw Error('Você não tem acesso de edição a essa ficha.');
  const sources=[];
  for(const item of items){const document=await catalog.document(item.entry.uuid);const data=embeddedSource(document);data.system.quantity=Math.max(1,Number(data.system.quantity)||1)*item.quantity;sources.push(data);}
  return sources.length?actor.createEmbeddedDocuments('Item',sources):[];
}
export async function refillResources(actor) {
  const hp=actor.system.resources.hp.max,ep=actor.system.resources.ep.max;
  if (!Number.isFinite(hp)||hp<1||!Number.isFinite(ep)||ep<0) throw Error('O sistema ainda não calculou os recursos. Termine as escolhas de classe e benefícios.');
  await actor.update({'system.resources.hp.value':hp,'system.resources.ep.value':ep});
}
export async function applyHitPointProgression(actor,draft) {
  const level=Math.max(1,Math.min(12,Number(draft.level)||1));
  if(level===1)return;
  const classItem=actor.items.find(item=>item.type==='class'&&item.system?.initial)??actor.items.find(item=>item.type==='class');
  const die=Number(String(classItem?.system?.hitDie?.die??'').match(/d(\d+)/i)?.[1]);
  if(!die)throw Error('O dado de vida da classe criada não pôde ser identificado.');
  const fixed=Math.floor(die/2)+1,values=draft.hpMethod==='rolled'?draft.hpRolls:Array(level-1).fill(fixed);
  if(values.length!==level-1)throw Error('Faltam resultados dos dados de vida.');
  const stored=[0,...values,...Array(Math.max(0,12-level)).fill(0)];
  const worldMethod=game.settings.get('skyfall','hpPerLevelMethod');
  const effectiveMethod=worldMethod==='user'?draft.hpMethod:worldMethod;
  const updates={'system.modifiers.hp.levelRoll':stored};
  if(worldMethod==='user')updates['flags.skyfall.hpPerLevelMethod']=draft.hpMethod==='rolled'?'roll':'mean';
  if(effectiveMethod==='mean'){
    const systemMean=Math.floor((die+1)/2),adjustment=values.reduce((sum,value)=>sum+value,0)-systemMean*(level-1);
    const extras=Array.from(actor.system.modifiers?.hp?.totalExtra??[]).map(String).filter(Boolean);
    if(adjustment)extras.push(String(adjustment));
    updates['system.modifiers.hp.totalExtra']=extras;
  }
  await actor.update(updates);
}

const TELEPORT_RECONCILE_ATTEMPTS=6;

function assertTeleportWritable(game,provider){
  const availability=providerAvailability(game)?.[provider];
  if(!availability?.available){
    if(provider===TELEPORT_PROVIDERS.STAIRWAYS)throw Error('O Stairways 0.11.1 precisa estar ativo no Foundry 13 para construir esta ligação.');
    throw Error('As Regions nativas desta integração exigem o Foundry 13.');
  }
  if(!availability.writable)throw Error('Somente a Mestra pode construir ou alterar teletransportes.');
  return availability;
}

function requireScene(game,sceneId){
  const scene=sceneById(game,sceneId);
  if(!scene)throw Error(`A Scene ${sceneId} não foi encontrada.`);
  return scene;
}

function randomDocumentId(){
  const alphabet='ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  const bytes=new Uint8Array(16);
  if(globalThis.crypto?.getRandomValues)globalThis.crypto.getRandomValues(bytes);
  else for(let index=0;index<bytes.length;index++)bytes[index]=Math.floor(Math.random()*256);
  return Array.from(bytes,value=>alphabet[value%alphabet.length]).join('');
}

function sceneId(scene){return scene?.id??scene?._id??null;}

function groupByScene(records){
  const groups=new Map();
  for(const record of records){
    const key=sceneId(record.scene);
    if(!groups.has(key))groups.set(key,{scene:record.scene,records:[]});
    groups.get(key).records.push(record);
  }
  return [...groups.values()];
}

async function deleteManagedDocuments(records,embeddedName){
  for(const group of groupByScene(records)){
    const ids=group.records.map(record=>documentId(record.document)).filter(Boolean);
    if(ids.length)await group.scene.deleteEmbeddedDocuments(embeddedName,ids);
  }
}

async function reconcileProvider(game,edge,provider){
  let audited=auditTeleportEdge(game,edge);
  for(let attempt=1;attempt<TELEPORT_RECONCILE_ATTEMPTS&&audited.implementations[provider].connectionStatus!=='connected';attempt++){
    await new Promise(resolve=>setTimeout(resolve,20));
    audited=auditTeleportEdge(game,audited);
  }
  if(audited.implementations[provider].connectionStatus!=='connected'){
    const problem=audited.implementations[provider].problem??'A gravação não apareceu nas Scenes.';
    throw Error(`Não foi possível confirmar a ligação ${provider}: ${problem}`);
  }
  return audited;
}

function choosePairName(game,edge,records=[]){
  const requested=(records[0]?documentValue(records[0].document,'name'):null)||edge.implementations?.stairways?.pairName||stairwayPairName(edge);
  const names=new Set();
  for(const scene of sceneList(game))for(const stairway of stairwaysInScene(scene)){
    if(documentFlag(stairway)?.edgeId===edge.id)continue;
    names.add(documentValue(stairway,'name'));
  }
  if(!names.has(requested))return requested;
  const base=stairwayPairName(edge);
  let suffix=2,name=base;
  while(names.has(name))name=`${base}-${suffix++}`;
  return name;
}

function stairwaySource(edge,role,pairName,{create=false}={}){
  const own=edge[role],other=edge[role==='from'?'to':'from'];
  const runtime=normalizeTeleportProvider(edge.runtimeProvider,{allowNone:true});
  const disabled=runtime!==TELEPORT_PROVIDERS.STAIRWAYS||(edge.bidirectional===false&&role==='to');
  const point=normalizedPoint(own);
  return {
    ...(create?{_id:randomDocumentId()}:{}),name:pairName,label:String(edge.label??''),x:point.x,y:point.y,
    scene:own.sceneId===other.sceneId?null:other.sceneId,disabled,
    ...(create?{hidden:false,animate:false}:{}),flags:teleportFlag(edge.id,TELEPORT_PROVIDERS.STAIRWAYS,role)
  };
}

function managedStairwayLayout(game,edge){
  const records=managedStairwayRecords(game,edge.id),byRole=Object.fromEntries(['from','to'].map(role=>[role,records.filter(record=>record.flag.role===role)]));
  const exact=records.length===2&&byRole.from.length===1&&byRole.to.length===1&&sceneId(byRole.from[0].scene)===edge.from.sceneId&&sceneId(byRole.to[0].scene)===edge.to.sceneId;
  return {records,byRole,exact};
}

async function updateStairwayPair(edge,layout,pairName){
  const records=['from','to'].map(role=>({scene:layout.byRole[role][0].scene,document:layout.byRole[role][0].document,role}));
  for(const group of groupByScene(records)){
    const updates=group.records.map(record=>({_id:documentId(record.document),...stairwaySource(edge,record.role,pairName)}));
    await group.scene.updateEmbeddedDocuments('Stairway',updates);
  }
}

async function createStairwayPair(game,edge,pairName){
  const fromScene=requireScene(game,edge.from.sceneId),toScene=requireScene(game,edge.to.sceneId);
  try{
    if(fromScene===toScene)await fromScene.createEmbeddedDocuments('Stairway',[
      stairwaySource(edge,'from',pairName,{create:true}),stairwaySource(edge,'to',pairName,{create:true})
    ]);
    else{
      await fromScene.createEmbeddedDocuments('Stairway',[stairwaySource(edge,'from',pairName,{create:true})]);
      await toScene.createEmbeddedDocuments('Stairway',[stairwaySource(edge,'to',pairName,{create:true})]);
    }
  }catch(error){
    try{await deleteManagedDocuments(managedStairwayRecords(game,edge.id),'Stairway');}catch(rollbackError){console.error(MODULE_ID,'rollback Stairways',rollbackError);}
    throw error;
  }
}

async function setStairwaysRuntime(game,edge,active){
  const records=managedStairwayRecords(game,edge.id);
  if(!records.length)return;
  assertTeleportWritable(game,TELEPORT_PROVIDERS.STAIRWAYS);
  for(const group of groupByScene(records)){
    const updates=group.records.map(record=>({
      _id:documentId(record.document),
      disabled:!active||(edge.bidirectional===false&&record.flag.role==='to')
    }));
    await group.scene.updateEmbeddedDocuments('Stairway',updates);
  }
}

function nativeRegionName(edge,role){
  const label=String(edge.label??edge.id).trim()||edge.id;
  const names={'from-trigger':'origem · gatilho','from-landing':'origem · chegada','to-trigger':'destino · gatilho','to-landing':'destino · chegada'};
  return `QUEDAÇO · ${label} · ${names[role]??role}`;
}

function nativeRegionSource(game,edge,role){
  const endpoint=role.startsWith('from-')?edge.from:edge.to,scene=requireScene(game,endpoint.sceneId);
  const point=role.endsWith('-landing')?landingPoint(scene,endpoint):normalizedPoint(endpoint);
  return {name:nativeRegionName(edge,role),shapes:[rectangleShape(scene,point)],flags:teleportFlag(edge.id,TELEPORT_PROVIDERS.NATIVE,role)};
}

function managedBehavior(region,edgeId){
  return behaviorsInRegion(region).filter(behavior=>{
    const flag=documentFlag(behavior);
    return flag?.managed===true&&flag?.provider===TELEPORT_PROVIDERS.NATIVE&&flag?.edgeId===edgeId;
  });
}

function nativeDestinationRole(triggerRole){return triggerRole==='from-trigger'?'to-landing':'from-landing';}

function nativeBehaviorSource(edge,triggerRole,destination,{create=false}={}){
  const runtime=normalizeTeleportProvider(edge.runtimeProvider,{allowNone:true});
  return {
    ...(create?{_id:randomDocumentId()}:{}),name:nativeRegionName(edge,triggerRole),type:'teleportToken',
    disabled:runtime!==TELEPORT_PROVIDERS.NATIVE,
    system:{destination,choice:false},
    flags:teleportFlag(edge.id,TELEPORT_PROVIDERS.NATIVE,`${triggerRole}-behavior`)
  };
}

function managedNativeLayout(game,edge){
  const expected=nativeRegionRoles(edge),records=managedNativeRegionRecords(game,edge.id);
  const byRole=Object.fromEntries(expected.map(role=>[role,records.filter(record=>record.flag.role===role)]));
  let exact=records.length===expected.length&&expected.every(role=>byRole[role].length===1&&sceneId(byRole[role][0].scene)===(role.startsWith('from-')?edge.from.sceneId:edge.to.sceneId));
  if(exact)for(const role of expected.filter(entry=>entry.endsWith('-trigger')))if(managedBehavior(byRole[role][0].document,edge.id).length!==1)exact=false;
  return {expected,records,byRole,exact};
}

async function createRegionsGrouped(game,edge,roles){
  const pending=roles.map(role=>({role,scene:requireScene(game,role.startsWith('from-')?edge.from.sceneId:edge.to.sceneId)}));
  const created=[];
  for(const group of groupByScene(pending)){
    const sources=group.records.map(record=>nativeRegionSource(game,edge,record.role));
    const documents=await group.scene.createEmbeddedDocuments('Region',sources);
    for(let index=0;index<documents.length;index++)created.push({scene:group.scene,document:documents[index],role:group.records[index].role});
  }
  return created;
}

async function createNativeRegions(game,edge){
  const roles=nativeRegionRoles(edge),landingRoles=roles.filter(role=>role.endsWith('-landing')),triggerRoles=roles.filter(role=>role.endsWith('-trigger'));
  try{
    const created=[...await createRegionsGrouped(game,edge,landingRoles),...await createRegionsGrouped(game,edge,triggerRoles)];
    const byRole=Object.fromEntries(created.map(record=>[record.role,record]));
    for(const role of triggerRoles){
      const trigger=byRole[role],landing=byRole[nativeDestinationRole(role)];
      const destination=regionUuid(sceneId(landing.scene),landing.document);
      if(typeof trigger.document?.createEmbeddedDocuments!=='function')throw Error('A Region criada não permite adicionar o comportamento teleportToken.');
      await trigger.document.createEmbeddedDocuments('RegionBehavior',[nativeBehaviorSource(edge,role,destination,{create:true})]);
    }
  }catch(error){
    try{await deleteManagedDocuments(managedNativeRegionRecords(game,edge.id),'Region');}catch(rollbackError){console.error(MODULE_ID,'rollback Regions',rollbackError);}
    throw error;
  }
}

async function updateNativeRegions(game,edge,layout){
  const records=layout.expected.map(role=>({scene:layout.byRole[role][0].scene,document:layout.byRole[role][0].document,role}));
  for(const group of groupByScene(records)){
    const updates=group.records.map(record=>({_id:documentId(record.document),...nativeRegionSource(game,edge,record.role)}));
    await group.scene.updateEmbeddedDocuments('Region',updates);
  }
  for(const role of layout.expected.filter(entry=>entry.endsWith('-trigger'))){
    const trigger=layout.byRole[role][0].document,landing=layout.byRole[nativeDestinationRole(role)][0];
    const behavior=managedBehavior(trigger,edge.id)[0],destination=regionUuid(sceneId(landing.scene),landing.document);
    await trigger.updateEmbeddedDocuments('RegionBehavior',[{_id:documentId(behavior),...nativeBehaviorSource(edge,role,destination)}]);
  }
}

async function setNativeRuntime(game,edge,active){
  const records=managedNativeRegionRecords(game,edge.id);
  if(!records.length)return;
  assertTeleportWritable(game,TELEPORT_PROVIDERS.NATIVE);
  for(const record of records){
    const behaviors=managedBehavior(record.document,edge.id);
    if(!behaviors.length)continue;
    await record.document.updateEmbeddedDocuments('RegionBehavior',behaviors.map(behavior=>({_id:documentId(behavior),disabled:!active})));
  }
}

async function syncRuntimeProvider(game,edge,provider){
  const result=cloneTeleportEdge(edge);
  if(provider===TELEPORT_PROVIDERS.STAIRWAYS){
    await setNativeRuntime(game,result,false);
    await setStairwaysRuntime(game,result,true);
  }else if(provider===TELEPORT_PROVIDERS.NATIVE){
    await setStairwaysRuntime(game,result,false);
    await setNativeRuntime(game,result,true);
  }else{
    await setStairwaysRuntime(game,result,false);
    await setNativeRuntime(game,result,false);
  }
  result.runtimeProvider=provider;
  const audited=auditTeleportEdge(game,result);
  if(audited.audit.activeCount>1)throw Error('Mais de um mecanismo de teletransporte ficou ativo nesta ligação.');
  if(provider&&audited.implementations[provider].connectionStatus==='connected'&&!audited.implementations[provider].runtimeActive)throw Error('O mecanismo escolhido não pôde ser ativado.');
  return audited;
}

/** Cria ou reconcilia o par Stairways. Não persiste a aresta no setting do Atlas. */
export async function ensureStairways(game,edge){
  validateTeleportEdge(edge);assertTeleportWritable(game,TELEPORT_PROVIDERS.STAIRWAYS);
  const result=cloneTeleportEdge(edge);
  const requestedRuntime=normalizeTeleportProvider(result.runtimeProvider,{allowNone:true});
  result.runtimeProvider=Object.hasOwn(result,'runtimeProvider')?(requestedRuntime??null):TELEPORT_PROVIDERS.STAIRWAYS;
  result.implementations={...(result.implementations??{})};
  let layout=managedStairwayLayout(game,result);
  const pairName=choosePairName(game,result,layout.records);
  if(!layout.exact){
    if(layout.records.length)await deleteManagedDocuments(layout.records,'Stairway');
    await createStairwayPair(game,result,pairName);
  }else await updateStairwayPair(result,layout,pairName);
  result.implementations.stairways={...(result.implementations.stairways??{}),provider:TELEPORT_PROVIDERS.STAIRWAYS,managed:true,pairName};
  const reconciled=await reconcileProvider(game,result,TELEPORT_PROVIDERS.STAIRWAYS);
  return syncRuntimeProvider(game,reconciled,reconciled.runtimeProvider);
}

/** Cria ou reconcilia Regions de gatilho/chegada. Não persiste a aresta no setting do Atlas. */
export async function ensureNativeRegions(game,edge){
  validateTeleportEdge(edge);assertTeleportWritable(game,TELEPORT_PROVIDERS.NATIVE);
  const result=cloneTeleportEdge(edge);
  const requestedRuntime=normalizeTeleportProvider(result.runtimeProvider,{allowNone:true});
  result.runtimeProvider=Object.hasOwn(result,'runtimeProvider')?(requestedRuntime??null):TELEPORT_PROVIDERS.NATIVE;
  result.implementations={...(result.implementations??{})};
  const layout=managedNativeLayout(game,result);
  if(!layout.exact){
    if(layout.records.length)await deleteManagedDocuments(layout.records,'Region');
    await createNativeRegions(game,result);
  }else await updateNativeRegions(game,result,layout);
  result.implementations.native={...(result.implementations.native??{}),provider:TELEPORT_PROVIDERS.NATIVE,managed:true};
  const reconciled=await reconcileProvider(game,result,TELEPORT_PROVIDERS.NATIVE);
  return syncRuntimeProvider(game,reconciled,reconciled.runtimeProvider);
}

// T24, passo 5 — a ficha nativa mostra "Complexo (Bruto)" lendo Itens `hierarchy`/
// `archetype` embutidos no Actor (não um texto). Cada um carrega os próprios Itens
// `ability` de passiva na lista `system.benefits` (ex.: o arquétipo "Bruto" carrega a
// passiva "Bruto", dado extra + crítico em 19–20). Confirmado em 17/09/2026 com 4 Actors
// nativos do compêndio skyfall-core.enemies — ver docs/T24-MONSTROS-COMPLETOS.md.
export const NPC_CREATION_PACK='skyfall-core.npc-creation';
/** Acha o Item `hierarchy`/`archetype` do compêndio pelo `system.identifier` (mesma
 * string do tier/arquétipo do conversor — não precisa de tabela de conversão). */
async function findRoleItem(pack,type,identifier){
  const index=await pack.getIndex({fields:['type','system.identifier']});
  const entry=index.find?.(e=>e.type===type&&e.system?.identifier===identifier)
    ??[...(index.values?.()??[])].find(e=>e.type===type&&e.system?.identifier===identifier);
  return entry?pack.getDocument(entry._id):null;
}
/** Copia o Item de hierarquia/arquétipo do compêndio pro `_source` do Actor, com os
 * Itens de passiva que ele concede (`system.benefits`, resolvidos por `resolveDocument`).
 * Falta no compêndio (não instalado, ou identificador sem correspondência) não trava a
 * conversão — só deixa a hierarquia/arquétipo como estavam, só em `system.hierarchy`/
 * `system.archetype` (texto), do jeito que já funcionava antes desta tarefa. */
export async function attachCreatureRoleItems(game,actorSource,resolveDocument=globalThis.fromUuid,packId=NPC_CREATION_PACK){
  const pack=game.packs?.get?.(packId);
  if(!pack)return actorSource;
  const wanted=[{type:'hierarchy',identifier:actorSource.system?.hierarchy},...(actorSource.system?.archetype??[]).map(identifier=>({type:'archetype',identifier}))];
  const extraItems=[];
  for(const {type,identifier} of wanted){
    if(!identifier)continue;
    let doc;try{doc=await findRoleItem(pack,type,identifier);}catch{doc=null;}
    if(!doc)continue;
    const clone=doc.toObject();delete clone._id;
    extraItems.push(clone);
    for(const benefit of clone.system?.benefits??[]){
      if(benefit?.type!=='ability'||!benefit.uuid)continue;
      let benefitDoc;try{benefitDoc=await resolveDocument(benefit.uuid);}catch{benefitDoc=null;}
      if(!benefitDoc)continue;
      const benefitClone=benefitDoc.toObject();delete benefitClone._id;
      extraItems.push(benefitClone);
    }
  }
  if(!extraItems.length)return actorSource;
  return {...actorSource,items:[...extraItems,...(actorSource.items??[])]};
}

/** Ativa um runtime e desativa o outro. `null`/`none` deixa ambos desativados. */
export async function setRuntimeProvider(game,edge,provider){
  validateTeleportEdge(edge);
  const target=normalizeTeleportProvider(provider,{allowNone:true});
  if(target===undefined)throw Error('Escolha Stairways, Regions nativas ou nenhum mecanismo.');
  let result=cloneTeleportEdge(edge),audited=auditTeleportEdge(game,result);
  const previous=normalizeTeleportProvider(result.runtimeProvider,{allowNone:true})??null;
  if(target===TELEPORT_PROVIDERS.STAIRWAYS&&audited.implementations.stairways.connectionStatus!=='connected')result=await ensureStairways(game,{...result,runtimeProvider:previous});
  if(target===TELEPORT_PROVIDERS.NATIVE&&audited.implementations.native.connectionStatus!=='connected')result=await ensureNativeRegions(game,{...result,runtimeProvider:previous});
  try{return await syncRuntimeProvider(game,result,target);}
  catch(error){
    if(previous!==target)try{await syncRuntimeProvider(game,result,previous);}catch(rollbackError){console.error(MODULE_ID,'rollback runtime de teletransporte',rollbackError);}
    throw error;
  }
}
