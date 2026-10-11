import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const source=async path=>readFile(new URL(`../${path}`,import.meta.url),'utf8');

test('bootstrap registra a entrada no Chat e neutraliza os atalhos antigos',async()=>{
  const main=await source('src/main.mjs');
  assert.match(main,/Hooks\.on\('renderChatLog',addChatCreatorButton\)/);
  assert.match(main,/data-quedaco-character-creator/);
  assert.match(main,/querySelector\('\[data-yuri-creator\]'\)\?\.remove\(\)/);
  assert.match(main,/tool\?\.name!==['"]quedaco['"]/);
  assert.doesNotMatch(main,/CampaignLibrary/);
});

test('criador não importa a biblioteca nem o visor da campanha',async()=>{
  const app=await source('src/app.mjs');
  assert.doesNotMatch(app,/CampaignLibrary|this\.library|map-view|_bindMap|_bindPuzzle/);
});
