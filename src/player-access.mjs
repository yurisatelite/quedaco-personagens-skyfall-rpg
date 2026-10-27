/** Liberação explícita do criador. Permissão nativa continua validada pelo servidor. */
const ID='quedaco-personagens-skyfall-rpg';
export const PLAYER_ACCESS_KEY='allowPlayerCreation';
const GRANTS_KEY='playerCreationGrantedRoles';
export const PLAYER_FOLDER_KEY='playerCreationFolder';
let queue=Promise.resolve();
export function playerCreationEnabled(game=globalThis.game){return game.settings?.get(ID,PLAYER_ACCESS_KEY)===true;}
export function assertCreatorAccess(game=globalThis.game){
  if(!game.user?.isGM&&!playerCreationEnabled(game))throw Error('A Mestra desativou a criação de personagens para jogadores.');
  if(!game.user?.can('ACTOR_CREATE'))throw Error('Seu usuário não tem permissão para criar personagens. Peça à Mestra para conferir a permissão de criar Atores.');
}
export function registerPlayerAccess(game=globalThis.game,{onChange=()=>{}}={}){
  game.settings.register(ID,PLAYER_ACCESS_KEY,{name:'Permitir criação de personagens aos jogadores',scope:'world',config:false,type:Boolean,default:false,onChange});
  game.settings.register(ID,GRANTS_KEY,{scope:'world',config:false,type:Array,default:[]});
  game.settings.register(ID,PLAYER_FOLDER_KEY,{scope:'world',config:false,type:String,default:'',onChange});
}

export function actorFolders(game=globalThis.game){
  return Array.from(game.folders??[]).filter(folder=>folder.type==='Actor').map(folder=>{
    const names=[folder.name],seen=new Set([folder.id]);let parent=folder.folder;
    while(parent){
      const ancestor=typeof parent==='string'?game.folders.get(parent):parent;
      if(!ancestor||seen.has(ancestor.id))break;
      seen.add(ancestor.id);names.unshift(ancestor.name);parent=ancestor.folder;
    }
    return {id:folder.id,label:names.join(' / ')};
  }).sort((a,b)=>a.label.localeCompare(b.label,'pt-BR'));
}

export function creationFolder(game=globalThis.game){
  const id=game.settings.get(ID,PLAYER_FOLDER_KEY);
  if(!id){
    if(!game.user.isGM)throw Error('Peça à Mestra para escolher a pasta dos personagens em Configurar criação dos jogadores.');
    return null;
  }
  const folder=game.folders?.get(id);
  if(!folder||folder.type!=='Actor')throw Error('A pasta de personagens não está disponível. Peça à Mestra para selecionar a pasta novamente.');
  return folder.id;
}

export async function configurePlayerCreation({enabled,folderId},{game=globalThis.game}={}){
  if(!game.user?.isGM)throw Error('Somente a Mestra configura a criação de personagens.');
  if(game.users?.activeGM&&game.users.activeGM.id!==game.user.id)throw Error('Use a sessão da Mestra ativa.');
  if(typeof enabled!=='boolean')throw Error('Informe ligado ou desligado.');
  const folder=game.folders?.get(folderId);
  if(enabled&&(!folder||folder.type!=='Actor'))throw Error('Escolha uma pasta de Atores existente para os personagens.');
  if(folderId&&(!folder||folder.type!=='Actor'))throw Error('A pasta escolhida não está disponível.');
  await game.settings.set(ID,PLAYER_FOLDER_KEY,folder?.id??'');
  return setPlayerCreationEnabled(enabled,{game});
}
export function setPlayerCreationEnabled(enabled,{game=globalThis.game}={}){
  const task=async()=>{
    if(!game.user?.isGM)throw Error('Somente a Mestra libera a criação de personagens.');
    if(game.users?.activeGM&&game.users.activeGM.id!==game.user.id)throw Error('Use a sessão da Mestra ativa.');
    if(typeof enabled!=='boolean')throw Error('Informe ligado ou desligado.');
    const permissions=structuredClone(game.settings.get('core','permissions')??{});
    const roles=Array.from(permissions.ACTOR_CREATE??[3,4]);
    const previousGrants=Array.from(game.settings.get(ID,GRANTS_KEY)??[]);
    if(enabled){
      const added=[1,2].filter(role=>!roles.includes(role));
      // Salva antes de conceder, para permitir recuperação após uma falha parcial.
      await game.settings.set(ID,GRANTS_KEY,[...new Set([...previousGrants,...added])]);
      permissions.ACTOR_CREATE=[...new Set([...roles,1,2])];
      await game.settings.set('core','permissions',permissions);
      await game.settings.set(ID,PLAYER_ACCESS_KEY,true);
    }else{
      // Bloqueia imediatamente o módulo; não retira permissões preexistentes.
      await game.settings.set(ID,PLAYER_ACCESS_KEY,false);
      permissions.ACTOR_CREATE=roles.filter(role=>!previousGrants.includes(role));
      await game.settings.set('core','permissions',permissions);
      await game.settings.set(ID,GRANTS_KEY,[]);
    }
    return {enabled:playerCreationEnabled(game),nativeRoles:permissions.ACTOR_CREATE};
  };
  const result=queue.then(task);queue=result.catch(()=>{});return result;
}
