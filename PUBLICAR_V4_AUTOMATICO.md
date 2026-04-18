# Publicar a V4 no Firebase

## 1. Substitua os arquivos na pasta do projeto
Arquivos principais da V4:
- `index.html`
- `storage.rules`
- `functions/index.js`
- `functions/README.md`
- `VERSAO_4_AUTH_AUTOMATICO.md`

## 2. Publicar Hosting
```bash
firebase use prod
firebase deploy --only hosting
```

## 3. Publicar Storage
```bash
firebase use prod
firebase deploy --only storage
```

## 4. Publicar Functions
```bash
firebase use prod
firebase deploy --only functions
```

## 5. Teste
- crie ou edite um cliente com `adminEmail`;
- aguarde alguns segundos;
- verifique no Firebase Authentication se o usuário apareceu;
- faça login no painel Admin com o e-mail do cliente e a senha provisória definida na função.
