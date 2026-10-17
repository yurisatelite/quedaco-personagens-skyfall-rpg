# Atualizações · Personagens Skyfall RPG

Manifesto permanente para instalar e atualizar pelo Foundry:

https://github.com/yurisatelite/quedaco-personagens-skyfall-rpg/releases/latest/download/module.json

Em Configuração do Foundry → Módulos adicionais → Instalar módulo, informe o endereço acima. Nas próximas versões, use a atualização na lista de módulos. Se a mesa estiver aberta, espere os jogadores terminarem e recarregue os clientes depois da atualização.

## Publicar uma nova versão

1. Aumente a versão em `module.json` e `package.json` e ajuste `download` para a tag correspondente (`vX.Y.Z`). Preserve `manifest`, que aponta sempre para `releases/latest/download/module.json`.
2. Escreva as notas em `docs/RELEASE-X.Y.Z.md`.
3. Execute `npm test` e revise `git diff --check`.
4. Faça um único commit da versão e a tag `vX.Y.Z`. Confirme que a tag aponta para o commit e que a árvore está limpa.
5. Execute `npm run release -- -Public`. Isso regera `dist/quedaco-personagens-skyfall-rpg.zip` e `dist/module.json`; sem este passo você publica a versão velha embaixo da tag nova. O pacote público não inclui a fonte Noka.
6. Em `yurisatelite/quedaco-personagens-skyfall-rpg`, crie a release da tag e anexe os dois arquivos. **A tag precisa bater exatamente com o `download` do manifesto** (`v0.1.9`, `v` minúsculo colado no número). Tag diferente faz o Foundry receber 404 e mostrar `ENOENT ... stat '.../quedaco-personagens-skyfall-rpg.zip'`, um erro que parece do zip mas é da URL.
7. Publique como a release mais recente e verifique os dois endereços sem autenticação antes de pedir que usuários atualizem.
8. Não substitua o ZIP de uma versão publicada. Para corrigir, publique uma versão nova.

## Identidade visual da mesa

Os arquivos licenciados Noka-Medium.woff2 e Noka-Semibold.woff2 podem ficar numa pasta da própria mesa, fora de `modules/`, para sobreviverem às atualizações. Informe essa pasta nas configurações do módulo. Sem ela, o pacote público usa Outfit, que acompanha o módulo com a licença SIL Open Font License 1.1 em `assets/fonts/OFL-Outfit.txt`.
