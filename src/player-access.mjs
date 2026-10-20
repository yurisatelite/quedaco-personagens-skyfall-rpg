/** Liberação explícita do criador. Permissão nativa continua validada pelo servidor. */
const ID='quedaco-personagens-skyfall-rpg';
export const PLAYER_ACCESS_KEY='allowPlayerCreation';
const GRANTS_KEY='playerCreationGrantedRoles';
let queue=Promise.resolve();
export function playerCreationEnabled(game=globalThis.game){return game.settings?.get(ID,PLAYER_ACCESS_KEY)===true;}
export function assertCreatorAccess(game=globalThis.game){
  if(!game.user?.isGM&&!playerCreationEnabled(game))throw Error('A Mestra desativou a criação de personagens para jogadores.');
  if(!game.user?.can('ACTOR_CREATE'))throw Error('Seu usuário não tem permissão para criar personagens. Peça à Mestra para conferir a permissão de criar Atores.');
}
export function registerPlayerAccess(game=globalThis.game,{onChange=()=>{}}={}){
  game.settings.register(ID,PLAYER_ACCESS_KEY,{name:'Permitir criação de personagens aos jogadores',scope:'world',config:false,type:Boolean,default:false,onChange});
  game.settings.register(ID,GRANTS_KEY,{scope:'world',config:false,type:Array,default:[]});
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
