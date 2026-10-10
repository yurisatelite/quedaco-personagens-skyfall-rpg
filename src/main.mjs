import {CreatorApp} from './app.mjs';
import {MODULE_ID,assertCompatible} from './adapter.mjs';
import {registerBranding,loadBranding} from './branding.mjs';

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

function chatRoot(html){return html instanceof HTMLElement?html:html?.[0]??null;}

/** The creator belongs to Chat, never to the Actor directory. */
function addChatCreatorButton(_application,html){
  const root=chatRoot(html);
  if(!root||root.querySelector('[data-quedaco-character-creator]'))return;
  const button=document.createElement('button');
  button.type='button';
  button.dataset.quedacoCharacterCreator='';
  button.className='sy-launch sy-chat-launch';
  button.innerHTML='<i class="fa-solid fa-dragon" aria-hidden="true"></i><span>Criar personagem</span>';
  button.addEventListener('click',()=>openCreator());
  const target=root.querySelector('.chat-header, #chat-controls, header')??root;
  target.prepend(button);
}

Hooks.once('init',()=>{registerBranding();});
Hooks.once('ready',()=>{
  const module=game.modules.get(MODULE_ID);
  if(module)module.api={open:openCreator};
  void loadBranding();
});
Hooks.on('renderChatLog',addChatCreatorButton);
