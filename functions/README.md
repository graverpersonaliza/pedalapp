# Functions V4

Esta versão adiciona provisionamento automático do admin do cliente no Firebase Auth.

## O que a V4 faz
- ao salvar um cliente com `adminEmail`, a trigger `syncClientAdminAuth` cria ou atualiza o usuário no Firebase Auth;
- aplica custom claims de `clientAdmin` e `clientSlug`;
- desativa o usuário antigo se o e-mail do admin do cliente for trocado;
- desativa o usuário se o cliente for excluído;
- mantém auditoria em `audit_logs`.

## Senha temporária padrão
A senha temporária é definida em `functions/index.js` na constante:

`DEFAULT_CLIENT_TEMP_PASSWORD`

Antes de publicar em produção, troque esse valor por uma senha provisória forte que só você conheça.

## Deploy
Na raiz do projeto:

```bash
firebase use prod
firebase deploy --only functions
```

## Fluxo esperado
1. você cria ou edita o cliente no painel Dev;
2. informa o `E-mail do admin do cliente`;
3. salva o cliente;
4. a Cloud Function cria ou atualiza automaticamente o usuário do Firebase Auth;
5. o cliente entra com o e-mail dele e a senha provisória definida na função.
