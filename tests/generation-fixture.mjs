const uuid=id=>`Compendium.fixture.Item.${id}`;
export function generationFixture(){
  const rows=[
    {id:'tora',name:'Tôra',type:'legacy',system:{benefits:[{type:'heritage',uuid:uuid('stone')}]}},
    {id:'stone',name:'Pedra',type:'heritage'},
    {id:'gnome',name:'Gnomo',type:'legacy',system:{benefits:[{type:'heritage',uuid:uuid('animal')}]}},
    {id:'animal',name:'1 Herança Maior e 2 Menores',type:'heritage',system:{benefits:[{type:'feature',uuid:uuid('major')},{type:'feature',uuid:uuid('minor')}]}},
    {id:'major',name:'Herança maior',type:'feature',system:{identifier:'major',feats:[uuid('teeth'),uuid('predator')],benefits:[{_id:'big',type:'grant',granting:'feat',query:'major',quantity:1}]}},
    {id:'minor',name:'Heranças menores',type:'feature',system:{identifier:'minor',feats:[uuid('climb'),uuid('camo'),uuid('run'),uuid('opportunity')],benefits:[{_id:'small',type:'grant',granting:'feat',query:'minor',quantity:2}]}},
    ...[['teeth','Dentes Afiados'],['predator','Predador'],['climb','Escalador'],['camo','Camuflagem'],['run','Corredor'],['opportunity','Oportunista']].map(([id,name])=>({id,name,type:'feat'})),
    ...['Combatente','Especialista','Ocultista'].map((name,i)=>({id:`class${i}`,name,type:'class'})),
    {id:'military',name:'Militar',type:'background'},
    {id:'curse',name:'Marcado',type:'curse'},
    {id:'path1',name:'Primeira trilha',type:'path'},{id:'path2',name:'Segunda trilha',type:'path'},
    ...Array.from({length:8},(_,i)=>({id:`spell${i}`,name:`Truque ${i+1}`,type:'spell',system:{descriptors:['cantrip']}})),
    ...['Cota de Malha','Armadura de Couro Batido','Escudo Leve','Armadura de Couro'].map((name,i)=>({id:`armor${i}`,name,type:'armor',system:{type:name==='Escudo Leve'?'shield':'light',capacity:1}})),
    ...['Arco Longo','Machadinha','Espada Longa','Besta Leve','Adaga','Funda','Tacape'].map((name,i)=>({id:`weapon${i}`,name,type:'weapon',system:{category:i<3?'martial':'simple',purpose:['Arco Longo','Besta Leve','Funda'].includes(name)?'ranged':'melee',capacity:1}})),
    ...['Flechas','Virotes de besta','Balas de funda','Bolsa para Componentes','Kit de Curandeiro'].map((name,i)=>({id:`gear${i}`,name,type:'equipment'}))
  ];
  const docs=rows.map(row=>({uuid:uuid(row.id),name:row.name,type:row.type,img:'icons/svg/mystery-man.svg',system:{benefits:[],feats:[],descriptors:[],price:1,capacity:0,quantity:1,hitDie:{die:'1d10'},...row.system}}));
  return {items:docs,list:(type)=>docs.filter(row=>row.type===type),entry:id=>docs.find(row=>row.uuid===id),document:async id=>docs.find(row=>row.uuid===id),linkedItems:async id=>docs.find(row=>row.uuid===id).system.benefits.filter(row=>row.type==='heritage').map(row=>docs.find(doc=>doc.uuid===row.uuid))};
}
export function seeded(seed=12){return ()=>{seed=(1664525*seed+1013904223)>>>0;return seed/4294967296;};}
