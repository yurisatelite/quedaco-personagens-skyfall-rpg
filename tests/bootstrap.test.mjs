import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const source=async path=>readFile(new URL(`../${path}`,import.meta.url),'utf8');

test('bootstrap registra uma entrada clicável somente no Diretório de Atores',async()=>{
  const [main,css]=await Promise.all([source('src/main.mjs'),source('styles/creator.css')]);
  assert.match(main,/Hooks\.on\('renderActorDirectory',addActorCreatorButton\)/);
  assert.match(main,/data-quedaco-character-creator/);
  assert.match(main,/button\.addEventListener\('click'/);
  assert.match(main,/event\.preventDefault\(\)/);
  assert.doesNotMatch(main,/renderChatInput|renderApplicationV2|addChatCreatorButton/);
  assert.doesNotMatch(main,/getSceneControlButtons/);
  assert.doesNotMatch(main,/CampaignLibrary/);
  assert.match(css,/\.sy-launch\{background:transparent!important;color:#1fb8de!important;border:1px solid #1fb8de!important/);
  assert.match(css,/\.sy-launch i,\.sy-launch span\{color:inherit!important\}/);
});

test('criador não importa a biblioteca nem o visor da campanha',async()=>{
  const app=await source('src/app.mjs');
  assert.doesNotMatch(app,/CampaignLibrary|this\.library|map-view|_bindMap|_bindPuzzle/);
});
