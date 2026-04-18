# Versão 4 — Auth automático por cliente

A V4 foi preparada para automatizar o acesso do admin de cada cliente.

## O que mudou
- salvar cliente com `adminEmail` agora dispara criação ou atualização automática do usuário no Firebase Auth;
- o cliente não precisa usar o e-mail do desenvolvedor;
- o upload de anexos continua exigindo Firebase Auth real;
- o `storage.rules` foi ajustado para liberar upload apenas em `clientes/{clienteSlug}/produtos/**`.

## Como usar
1. No painel Dev, preencha o e-mail do admin do cliente.
2. Salve o cliente.
3. Depois do deploy das Functions, o usuário será provisionado automaticamente.
4. Entregue ao cliente:
   - link dele;
   - e-mail dele;
   - senha provisória definida na função.

## Publicação
```bash
firebase use prod
firebase deploy --only hosting,storage,functions
```

Se você também tiver alterado regras do Firestore:

```bash
firebase deploy --only hosting,firestore,storage,functions
```
