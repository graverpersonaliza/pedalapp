# Cobrança e ativação

## Modos sugeridos
- manual: você ativa o cliente na mão
- mercadopago: ideal para Brasil
- stripe: opção internacional

## Fluxo recomendado
1. cliente entra em teste
2. você envia proposta
3. pagamento aprovado
4. webhook ou ativação manual altera o plano
5. validade é recalculada
6. se vencer, o status vira bloqueado

## Onde conectar
Use `functions/index.js` como base para a automação.
