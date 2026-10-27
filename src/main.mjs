import {CreatorApp} from './app.mjs';
import {MODULE_ID,assertCompatible,escapeHTML as e} from './adapter.mjs';
import {registerBranding,loadBranding} from './branding.mjs';
import {prepareNpcTemplate,createNpcFromTemplate,refreshNpcTemplateRelations,prepareNpcBatch,createNpcBatch} from './npc-templates.mjs';
import {prepareNpcDescription,getNpcCreationCatalog} from './npc-description.mjs';
import {assertCreatorAccess,playerCreationEnabled,registerPlayerAccess,setPlayerCreationEnabled,actorFolders,configurePlayerCreation,PLAYER_FOLDER_KEY} from './player-access.mjs';

let app;

/** Public entry point for macros or an optional future campaign-module bridge. */
export function openCreator(){
  try{
    assertCompatible(game);
    assertCreatorAccess(game);
    if(app?.rendered){app.render(false);app.bringToFront();return app;}
    app=new CreatorApp();
    return app.start();
  }catch(error){ui.notifications.error(error.message);return null;}
}

function applicationRoot(html){return html instanceof HTMLElement?html:html?.[0]??null;}

async function showPlayerCreationSettings(){
  if(!game.user.isGM)return;
  const folderId=game.settings.get(MODULE_ID,PLAYER_FOLDER_KEY),enabled=playerCreationEnabled(game);
  const result=await foundry.applications.api.DialogV2.wait({
    window:{title:'Criação de personagens dos jogadores'},
    content:`<p>Libere o criador completo, com escolhas livres. Cada ficha será salva na pasta selecionada, com Owner para quem criou e sem acesso para os outros jogadores. A Mestra continua vendo todas.</p>
      <label><input type="checkbox" name="enabled" ${enabled?'checked':''}> Liberar criação para os jogadores</label>
      <label>Pasta dos personagens<select name="folderId"><option value="">Selecione uma pasta</option>${actorFolders(game).map(folder=>`<option value="${e(folder.id)}" ${folder.id===folderId?'selected':''}>${e(folder.label)}</option>`).join('')}</select></label>
      <p>Ao liberar, o Foundry também permitirá que Jogadores e Jogadores Confiáveis criem Atores pelo diretório nativo. Ao desligar, somente as permissões concedidas pelo módulo serão retiradas. Fichas existentes permanecem disponíveis.</p>`,
    buttons:[{action:'save',label:'Salvar',default:true,callback:(_event,button)=>({enabled:button.form.elements.enabled.checked,folderId:button.form.elements.folderId.value})},
      {action:'cancel',label:'Cancelar',callback:()=>false}]
  });
  if(!result)return;
  await configurePlayerCreation(result);
  ui.notifications.info(result.enabled?'Criador liberado. Cada jogador receberá a propriedade das próprias fichas.':'Criador fechado para novas criações dos jogadores.');
}

/** Add the character-module entry to the Actor directory. */
function addActorCreatorButton(application,html){
  const root=applicationRoot(html)??applicationRoot(application?.element)??document.querySelector('#actors');
  if(!root)return;
  root.querySelector('[data-quedaco-player-access]')?.remove();
  if(game.user?.isGM){
    const toggle=document.createElement('button');toggle.type='button';toggle.dataset.quedacoPlayerAccess='';
    const enabled=playerCreationEnabled(game);
    toggle.textContent=enabled?'Configurar criação dos jogadores':'Liberar criação para jogadores';
    toggle.setAttribute('aria-pressed',String(enabled));
    toggle.title='Escolhe a pasta de destino e libera o Criador completo para jogadores.';
    toggle.addEventListener('click',async event=>{event.preventDefault();event.stopPropagation();toggle.disabled=true;try{await showPlayerCreationSettings();ui.actors?.render(false);}catch(error){ui.notifications.error(error.message);}finally{toggle.disabled=false;}});
    (root.querySelector('.directory-header')??root).prepend(toggle);
  }
  root.querySelector('[data-quedaco-character-creator]')?.remove();
  if(!game.user?.isGM&&(!playerCreationEnabled(game)||!game.user.can('ACTOR_CREATE')))return;
  const button=document.createElement('button');
  button.type='button';
  button.dataset.quedacoCharacterCreator='';
  button.className='sy-launch sy-actor-launch';
  button.innerHTML='<i class="fa-solid fa-user-pen" aria-hidden="true"></i><span>Criar personagem</span>';
  button.addEventListener('click',event=>{
    event.preventDefault();
    event.stopPropagation();
    openCreator();
  });
  const target=root.querySelector('.directory-header')??root;
  target.prepend(button);
}

Hooks.once('init',()=>{registerBranding();registerPlayerAccess(game,{onChange:()=>{ui.actors?.render(false);if(!game.user?.isGM&&!playerCreationEnabled(game))void app?.close();}});});
Hooks.once('ready',()=>{
  const module=game.modules.get(MODULE_ID);
  if(module){
    // Protocolo de Integração QUEDAÇO v1.
    const descriptor=Object.freeze({family:'quedaco',contractVersion:1,id:MODULE_ID,title:module.title,version:module.version,
      capabilities:Object.freeze({characterCreator:true,createActor:true,npcTemplates:true,npcBatch:true,npcDescription:true,npcProfileSelection:true,npcTemplateResolution:true,playerCreationControl:true}),
      prepareNpcTemplate,createNpcFromTemplate,refreshNpcTemplateRelations,prepareNpcBatch,createNpcBatch,prepareNpcDescription,getNpcCreationCatalog,
      setPlayerCreationEnabled,isPlayerCreationEnabled:()=>playerCreationEnabled(game),
      open:openCreator,getStatus:()=>({ready:game.system?.id==='skyfall',playerCreationEnabled:playerCreationEnabled(game)})});
    module.api=descriptor;Hooks.callAll('quedaco:register',descriptor);
  }
  void loadBranding();
});
Hooks.on('renderActorDirectory',addActorCreatorButton);
// Defesa adicional para o caminho normal de Document.create. Não muda fichas já existentes.
Hooks.on('preCreateActor',(actor)=>{if(actor.flags?.[MODULE_ID]?.creator===game.user?.id&&!game.user?.isGM){try{assertCreatorAccess(game);}catch(error){ui.notifications.error(error.message);return false;}}});
