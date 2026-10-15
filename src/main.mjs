import {CreatorApp} from './app.mjs';
import {MODULE_ID,assertCompatible} from './adapter.mjs';
import {registerBranding,loadBranding} from './branding.mjs';
import {prepareNpcTemplate,createNpcFromTemplate,refreshNpcTemplateRelations} from './npc-templates.mjs';

let app;

/** Public entry point for macros or an optional future campaign-module bridge. */
export function openCreator(){
  try{
    assertCompatible(game);
    if(app?.rendered){app.render(false);app.bringToFront();return app;}
    app=new CreatorApp();
    return app.start();
  }catch(error){ui.notifications.error(error.message);return null;}
}

function applicationRoot(html){return html instanceof HTMLElement?html:html?.[0]??null;}

/** Add the character-module entry to the Actor directory. */
function addActorCreatorButton(application,html){
  const root=applicationRoot(html)??applicationRoot(application?.element)??document.querySelector('#actors');
  if(!root||root.querySelector('[data-quedaco-character-creator]'))return;
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

Hooks.once('init',()=>{registerBranding();});
Hooks.once('ready',()=>{
  const module=game.modules.get(MODULE_ID);
  if(module){
    // Protocolo de Integração QUEDAÇO v1.
    const descriptor=Object.freeze({family:'quedaco',contractVersion:1,id:MODULE_ID,title:module.title,version:module.version,
      capabilities:Object.freeze({characterCreator:true,createActor:true,npcTemplates:true}),
      prepareNpcTemplate,createNpcFromTemplate,refreshNpcTemplateRelations,
      open:openCreator,getStatus:()=>({ready:game.system?.id==='skyfall'})});
    module.api=descriptor;Hooks.callAll('quedaco:register',descriptor);
  }
  void loadBranding();
});
Hooks.on('renderActorDirectory',addActorCreatorButton);
