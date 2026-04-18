# Plano final de conclusão do PedalApp

## 1. Firebase Auth
**Objetivo:** login real para Admin e Desenvolvedor, sessão persistente, logout e recuperação de acesso.
**Por que vem primeiro:** hoje a autenticação está no front-end e isso limita a segurança.
**Critério de pronto:** Admin e Dev entram com login real, sessão fica salva e existe botão sair.

## 2. Firestore Rules
**Objetivo:** blindar o banco para o público só enviar dados, o Admin gerenciar só o próprio ambiente e o Desenvolvedor ter controle global.
**Por que vem em segundo:** sem regras, o sistema funciona mas não fica seguro para comercializar.
**Critério de pronto:** leitura e escrita separadas por perfil, com acesso público mínimo.

## 3. Admin por cliente
**Objetivo:** estrutura multi-cliente real, com isolamento total entre contratantes.
**Por que vem em terceiro:** essa é a base para vender para vários grupos sem misturar dados.
**Critério de pronto:** cada cliente enxerga só seus eventos, pedidos, anexos e relatórios.

## 4. Firebase Storage para anexos
**Objetivo:** mover imagens e arquivos para Storage, deixando o banco leve e estável.
**Por que vem em quarto:** o app atual suporta anexos, mas a evolução correta pede arquivos fora do documento principal.
**Critério de pronto:** upload, exclusão, visualização e compartilhamento por URL segura.

## 5. Dashboard operacional
**Objetivo:** visão gerencial por produto, tamanho, quantidade, filtros e relatórios.
**Por que vem em quinto:** fecha a utilidade operacional para produção e organização.
**Critério de pronto:** resumo na tela sem depender só de CSV.

## 6. Landing page, planos e cobrança
**Objetivo:** transformar o sistema em produto vendável.
**Por que vem por último:** primeiro fecha segurança e operação; depois profissionaliza a venda.
**Critério de pronto:** página comercial, planos, ativação por pagamento e renovação.
