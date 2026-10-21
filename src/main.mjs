import {CreatorApp} from './app.mjs';
import {MODULE_ID,assertCompatible} from './adapter.mjs';
import {registerBranding,loadBranding} from './branding.mjs';
import {prepareNpcTemplate,createNpcFromTemplate,refreshNpcTemplateRelations,prepareNpcBatch,createNpcBatch} from './npc-templates.mjs';
import {prepareNpcDescription,getNpcCreationCatalog} from './npc-description.mjs';
import {assertCreatorAccess,playerCreationEnabled,registerPlayerAccess,setPlayerCreationEnabled} from './player-access.mjs';

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

/** Add the character-module entry to the Actor directory. */
function addActorCreatorButton(application,html){
  const root=applicationRoot(html)??applicationRoot(application?.element)??document.querySelector('#actors');
  if(!root)return;
  root.querySelector('[data-quedaco-player-access]')?.remove();
  if(game.user?.isGM){
    const toggle=document.createElement('button');toggle.type='button';toggle.dataset.quedacoPlayerAccess='';
    const enabled=playerCreationEnabled(game);
    toggle.textContent=`Jogadores: criação ${enabled?'ligada':'desligada'}`;
    toggle.setAttribute('aria-pressed',String(enabled));
    toggle.title='Liga ou desliga o Criador para jogadores e gerencia as permissões nativas de criar Atores concedidas pelo módulo.';
    toggle.addEventListener('click',async event=>{event.preventDefault();event.stopPropagation();toggle.disabled=true;try{await setPlayerCreationEnabled(!playerCreationEnabled(game));ui.actors?.render(false);}catch(error){ui.notifications.error(error.message);}finally{toggle.disabled=false;}});
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
