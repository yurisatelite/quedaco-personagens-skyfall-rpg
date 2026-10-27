import { ABILITIES, wallet, walletTotal } from './rules.mjs';
import {assertCreatorAccess,creationFolder} from './player-access.mjs';
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
  assertCreatorAccess(game);
  const folder=creationFolder(game);
  const actor=await Actor.create({...actorSource(draft,game.user.id),folder});
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
