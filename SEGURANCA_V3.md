# Segurança V3

## Estratégia
A versão atual mantém compatibilidade para não quebrar a operação.
A versão final de produção deve usar:
- Firebase Authentication
- custom claims por perfil
- regras de Firestore por coleção
- regras de Storage por cliente e por papel
- Functions para criação de admins e expiração automática

## Perfis sugeridos
- developer
- clientAdmin
- staff
- publicUser

## Recomendação
Nunca deixe a versão final dependendo apenas de senha no front-end.
