# Publicação da versão 3

## 1) Preparação mínima
- edite `app-config.js`
- confirme `firebase-config.js`
- revise `firebase.json`
- publique também a pasta `icons/`

## 2) GitHub Pages
1. envie todos os arquivos para a raiz do repositório
2. em `Settings > Pages`, escolha `Deploy from a branch`
3. branch `main` e pasta `/root`
4. aguarde a URL ficar disponível

## 3) Firebase Hosting
1. instale o CLI: `npm install -g firebase-tools`
2. faça login: `firebase login`
3. crie o `.firebaserc` com o seu projeto
4. rode `firebase deploy --only hosting`

## 4) Firestore + Storage
1. publique as regras compatíveis atuais para não quebrar o uso
2. quando migrar totalmente para Auth, adote os arquivos de produção mais rígidos
3. rode:
- `firebase deploy --only firestore:rules`
- `firebase deploy --only storage`

## 5) Functions
1. entre na pasta `functions`
2. rode `npm install`
3. ajuste os segredos e variáveis
4. publique com `firebase deploy --only functions`

## 6) Testes antes de abrir para clientes
- criação e edição de pedal
- inscrição pública
- criação e edição de produto
- pedido público
- backup JSON
- importação JSON
- logs de auditoria
- instalação como app
