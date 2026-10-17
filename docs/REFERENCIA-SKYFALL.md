# Referência do sistema Skyfall — para não reabrir o `skyfall.mjs` toda vez

> Isto é sobre o **sistema Skyfall** (o motor de fichas do Foundry), não sobre o QUEDAÇO.
> Muda raramente — só quando o Foundry ou o Skyfall sobem de versão. Enquanto
> `system.json` continuar dizendo `"skyfall" 1.0.1` e `"minimum": "13"`, este documento
> vale. Se a versão mudar, confira de novo com o roteiro no fim.
>
> Serve pra responder rápido "onde eu guardo isso na ficha?" sem grepar o arquivo do
> sistema (`C:/Users/YURI/AppData/Local/FoundryVTT/Data/systems/skyfall/skyfall.mjs`,
> ~20 mil linhas minificadas) toda vez que uma feature nova precisa disso.

**Confirmado contra ficha real em:** 17/09/2026, com 4 Actors nativos do compêndio
`skyfall-core.enemies` (Golem Mecânico, Lobo, Espírito da Floresta, Líder dos Bandidos),
exportados por `.local/exportar-comparacao-monstro.js`. Onde não diz "confirmado", é lido
direto do código do sistema, não de uma ficha rodando.

## `system` de um Actor `npc` (o mais usado — NPCs, monstros, mercadores)

```
system.abilities.<str|dex|con|int|wis|cha>.value        modificador (não o atributo bruto)
system.abilities.<...>.proficient                        true = testa resistência treinado
system.skills.<chave>.value                               0–2 (rank; 1 = treinado) — confirmado
system.level.value                                        Nível de Desafio (ND), 1–12
system.proficiency                                        bônus de proficiência (calculado sozinho)
system.resources.hp.{value,max,temp}
system.resources.shadow.value                             0–5
system.movement.{walk,swim,burrow,flight}                 em METROS, não pés
system.size                                                'tiny'|'sm'|'med'|'lg'|'huge'|'grg'
system.creatureType                                        celestial|construct|dragon|elemental|
                                                            fey|beast|giant|ooze|humanoid|fiend|
                                                            monstrosity|undead|plant
system.hierarchy                                           'simple'|'complex'|'boss'
system.archetype                                           Set: ranged|brute|group|mount|
                                                            defender|flanker|leader|sentinel
                                                            (pode ter mais de um)
system.dr                                                  redução de dano, número
system.languages                                           array de ids (ver lista abaixo)
system.proficiencies                                       array (armas/armaduras; NPC geralmente [])
system.modifiers.damage.taken.<tipo>                       'normal'|'resistance'|'imunity'|
                                                            'vulnerability' — confirmado
system.modifiers.condition.imune                           array de ids de condição — confirmado
system.biography                                            HTML
```

**Tamanho e token:** setar só `system.size` é suficiente. O sistema ajusta
`prototypeToken.width/height` sozinho ao criar ou atualizar o Actor (`NPC._preCreate` /
`_preUpdate`, gridScale de `actorSizes`) — **não precisa mexer no token na mão**.
Confirmado lendo `skyfall.mjs`, não numa ficha (é lógica que roda só dentro do Foundry).

**Sentidos:** **não existe campo próprio.** Nenhum dos 4 nativos guarda sentido nenhum —
fica só descrito na biografia/traços. Não invente um campo pra isso.

**Tendência/temperamento:** idem, não existe campo. Vira texto de biografia.

## Chaves de perícia (`system.skills`)

`pres` Apresentação · `apti` Aptidão · `arca` Arcanismo · `cult` Cultura · `dipl` Diplomacia ·
`doct` Doutrinas · `stea` Furtividade · `inti` Intimidação · `insi` Intuição · `magi` Magitec ·
`rogu` Malandragem · `mani` Manipulação · `medi` Medicina · `natu` Natureza · `perc` Percepção ·
`fitn` Preparo Físico · `forg` Forja · `pois` Veneno · `fish` Pescaria · `alch` Alquimia ·
`dist` Destilação · `cart` Cartografia · `tail` Alfaiataria · `cook` Culinária · `pain` Pintura ·
`craf` Artesanato · `navi` Navegação · `inst` Instrumentos

Não existem perícias de D&D como Acrobacia, Atletismo, Investigação, Religião — a
correspondência com D&D é uma **aproximação nossa** (ver `docs/T24-MONSTROS-COMPLETOS.md`
seção 2), não algo do livro do Skyfall.

## Idiomas (`system.languages`)

`common`, `abyssal`, `anuri`, `bo`, `celestial`, `draconic`, `toranio`, `elvish`, `kia`,
`kishi`, `vampy`. É a lista inteira — não tem "outros" pra digitar à mão.

## Tipos de dano (`system.modifiers.damage.taken/dealt`)

`acid`, `bludgeoning`, `cold`, `fire`, `lightning`, `necrotic`, `piercing`, `poison`,
`psychic`, `radiant`, `slashing`, `thunder`, `energy` (equivalente ao "force" de D&D),
`mundane`, `special`, `all`.

## Condições (`system.modifiers.condition.imune`)

O Skyfall não define uma lista própria — usa os status padrão do Foundry, em inglês, os
mesmos nomes de D&D: `blinded`, `charmed`, `deafened`, `exhaustion`, `frightened`,
`grappled`, `incapacitated`, `invisible`, `paralyzed`, `petrified`, `poisoned`, `prone`,
`restrained`, `stunned`, `unconscious`.

## Tipos de Item (`type` de um Item embutido num Actor)

`legacy`, `heritage`, `curse`, `background`, `class`, `path`, `feature`, `feat`,
**`ability`** (ação, traço, ataque — o mais comum), `spell`, `sigil`, `weapon`, `armor`,
`clothing`, `equipment`, `consumable`, `loot`, **`hierarchy`**, **`archetype`**, `seal`,
`facility`, `guild-ability`.

**Hierarquia e arquétipo são Itens**, não só texto em `system.hierarchy`/`system.archetype`.
A ficha mostra "Complexo (Bruto)" lendo esses Itens (`NPC.directoryData`, `NPC.isBoss`), e
cada um deles carrega os próprios Itens `ability` de passiva (ex.: o Item `archetype`
"Bruto" carrega uma `ability` "Bruto" com o efeito de dado extra + crítico em 19–20). Pra
copiar um pronto: os compêndios de Actor (`pacotesDeAtor` abaixo) têm um `npc-creation`
com esses Itens já prontos, identificáveis por `system.identifier` (`'boss'`, `'brute'`...).

## Um item `ability` de ataque (o molde que o conversor de monstros usa)

```
system.range.{value,units}          alcance de VERDADE (corpo a corpo também — não é sempre 1,5m)
system.attack.{ability,protection,damage}   ability = atributo do ataque; damage = número FIXO (sem dado)
system.rolls.<id>.{label,type:'attack'|'damage',terms:[{expression:'@str'},{expression:'@proficiency'}]}
```
Dano fixo, sem dado — a mesa rola atributo + proficiência, não um d20+dado de dano.

## Compêndios de Actor instalados (conferir a cada versão nova do sistema/mundo)

`skyfall-core.creation`, `skyfall-core.enemies`, `skyfall-fastplay.characters`.

## Como reconferir isto (se o Foundry/Skyfall subir de versão)

```
.local/exportar-comparacao-monstro.js
```
Roda como Mestre, baixa um JSON com Actors nativos completos (sistema, Itens, efeitos).
Se algo aqui não bater com o JSON novo, corrija este arquivo — ele é o que evita reabrir
o `skyfall.mjs` na próxima vez.
