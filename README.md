# PedalApp V3

Pacote V3 com foco em publicação séria, operação mais confiável e base pronta para evolução comercial.

## O que foi adicionado na V3
- PWA instalável com `manifest.webmanifest` e `sw.js`
- utilitários do desenvolvedor dentro do sistema
- exportação e importação de backup em JSON
- exportação rápida de clientes em CSV
- logs de auditoria no Firestore
- base para Cloud Functions e custom claims
- workflow de deploy para GitHub Actions
- documentação mais completa de publicação, segurança e fechamento comercial

## Arquivos principais
- `index.html` -> sistema principal
- `landing.html` -> apresentação comercial
- `v3-enhancements.js` -> camada de melhorias da versão 3
- `manifest.webmanifest` + `sw.js` -> instalação e cache básico
- `functions/` -> base para backend Firebase
- `CHECKLIST_100_V3.md` -> tudo o que precisa ser revisado antes de vender em escala
- `PUBLICAR_GITHUB_FIREBASE.md` -> publicação prática
- `DEPLOY_V3_COMPLETO.md` -> ordem final recomendada

## Realidade prática
Este pacote deixa o projeto bem mais próximo do nível profissional.  
Para ficar totalmente blindado em produção, você ainda precisa preencher suas credenciais, ativar os serviços do Firebase e, se quiser cobrança automática, conectar o provedor financeiro real.

## Recomendação direta
1. troque senhas e config
2. publique no GitHub Pages ou Firebase Hosting
3. teste backup, auditoria e PWA
4. ative Auth, Storage e Functions
5. só depois ligue cobrança automatizada


## V4
Esta edição adiciona automação de usuário admin por cliente via Cloud Functions e Firebase Auth.
