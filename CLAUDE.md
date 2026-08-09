# Ferramentas do Mauro

App pessoal de finanças (nome do repo/pnpm workspace ainda é `credit-installments`, legado do escopo original). Monorepo pnpm: `apps/api` (NestJS + Prisma + Postgres) e `apps/web` (React + Vite + Tailwind).

## Módulos

- **Parcelamento** (`cards`, `purchases`, `installments`, `calendar`, `timeline`, `statistics`) — o módulo original: cartões, compras parceladas/à vista/recorrentes, controle de parcelas.
- **Casa** (`household`) — orçamento doméstico: contas fixas, cartões próprios (separados do Parcelamento), entradas, dashboard agregado.
- **Investimentos** (`investments`) — renda fixa, ações/FIIs, cripto, proventos, análise fundamentalista (BRAPI + Fundamentus + Yahoo Finance como fontes, com fallback entre elas).
- **Horas** (`tracking`) — controle de ponto/trabalhos freelance e fixos.
- **Financiamentos** (`financings`) — financiamento de veículo/imóvel, parcelas, cotação de quitação.
- **Cotações** (`quotes`) — ticker de câmbio na Home.

Backend em Clean Architecture por módulo: `domain/` (regras puras, sem I/O — sempre com `.spec.ts` ao lado), `application/` (services, DTOs), `infrastructure/` (Prisma repos, providers externos), `interface/` ou raiz do módulo (controllers).

## Deploy (VPS de produção)

- Caminho do projeto: `/opt/parcelas`
- API roda via **systemd**, serviço `parcelas-api` (não é pm2, apesar de ter sido cogitado em algum momento):
  ```bash
  sudo systemctl restart parcelas-api
  sudo systemctl status parcelas-api --no-pager
  sudo journalctl -u parcelas-api -f
  ```
- Frontend é servido estático via **Caddy** (`/etc/caddy/Caddyfile`), buildado direto em `apps/web/dist`. Não precisa reiniciar nada pra mudanças só de frontend — só rebuildar.
- **VPS tem só 1GB de RAM.** O `vite build` do frontend estoura o heap padrão do Node e crasha com OOM. Sempre buildar com:
  ```bash
  NODE_OPTIONS=--max-old-space-size=4096 pnpm build
  ```
- Fluxo de deploy padrão:
  ```bash
  cd /opt/parcelas
  git pull origin <branch>
  cd apps/api && pnpm install && pnpm exec prisma generate && pnpm exec prisma migrate deploy && pnpm build
  cd ../web && pnpm install && NODE_OPTIONS=--max-old-space-size=4096 pnpm build
  sudo systemctl restart parcelas-api   # só necessário se apps/api mudou
  ```
  **`prisma migrate deploy` não roda `prisma generate` sozinho** (diferente do `migrate dev` usado em desenvolvimento) — sempre rodar `prisma generate` manualmente antes do `pnpm build` da API depois de qualquer migration nova, senão o TypeScript compila contra o Prisma Client desatualizado e quebra o build.
- Migrations sempre devem ser aditivas/não-destrutivas — já tem dados reais em produção. Coluna nova = nullable, nunca reaproveitar/renomear coluna existente sem plano de dado.

## Parcelamento: competência vs. data de vencimento (armadilha recorrente)

Isso já causou bastante confusão em sessões anteriores — documentando pra não repetir.

- `Installment.referenceMonth`/`referenceYear` = **competência**: o mês em que a fatura *fecha*, seguindo a convenção dos bancos ("Fatura de Junho"). Calculado em `installment-generator.ts`: compra até o dia de fechamento cai na competência do mês corrente; depois, rola pro mês seguinte.
- `Installment.dueDate` = quando a fatura **realmente vence**. Pra cartões onde o dia de vencimento é *antes* do dia de fechamento (ex: fecha dia 28, vence dia 5 — padrão comum de banco real), o vencimento cai no mês **seguinte** ao da competência. `generateInstallments` já trata esse cruzamento corretamente (fix de 2026-07-26); ver `installment-generator.spec.ts` pros casos de teste.
- Calendário/Timeline/filtro de "mês" no Parcelamento agrupam por **competência** (`referenceMonth`), não por vencimento. Isso é intencional e consistente em todo o módulo.
- **Casa (fatura presumida) agrupa por vencimento real** (`dueDate`), não por competência — porque pra orçamento doméstico o que importa é "quanto preciso ter em mãos esse mês", não o nome da fatura. Ver `InstallmentsService.getMonthlyTotalsForCards()`.
- Consequência: comparar "mês X no Parcelamento" com "mês X na Casa" pra um cartão que fecha depois de vencer **não bate direto** — é preciso comparar com o mês anterior de competência. Já foi verificado exaustivamente à mão contra dados reais de produção (múltiplos cartões, meses diferentes) e o cálculo está correto; a aparência de erro é só a diferença de convenção entre os dois módulos.

## Renda Fixa: principal vs. aportado no resgate parcial (armadilha recorrente)

Isso já foi mexido duas vezes por entender errado o que o usuário estava comparando — documentando.

- `InvestmentFixedIncome.principalAmount` = **base de rendimento**: o valor que compõe juro desde `applicationDate`. Num resgate parcial ele encolhe **proporcionalmente** (`principalForTargetNetValue`), porque é a única forma do bruto/líquido continuar fechando cent a cent.
- `InvestmentFixedIncome.contributedAmount` (nullable) = **dinheiro que a pessoa pôs e ainda está lá**. No resgate parcial ele sai em **regime de caixa** (`splitContribution`): sacou R$ 2.000 de um CDB de R$ 10.000, sobram R$ 8.000 redondos — que é o número do extrato do banco. `null` = nunca houve resgate parcial, então é igual ao principal (toda linha anterior à migration de 2026-08-09).
- Os dois divergem de propósito e por critérios diferentes. Sacar R$ 2.000 líquidos de uma posição de R$ 10.048,27 consome ~R$ 1.990 de base mas R$ 2.000 de aporte; o principal restante fica ~R$ 8.010 e o aportado fica R$ 8.000. **Essa diferença de ~R$ 10 era o que não batia com o banco** — a tela mostrava a base de rendimento no campo "Investido".
- Regra prática: qualquer número que o usuário vá comparar com o extrato usa `calculation.contributedAmount` e `calculation.netGain`/`netGainPercent`. `netYield`/`netProfitabilityPercent` medem contra a base de rendimento e só servem pro cálculo de imposto — depois de um resgate parcial eles **subestimam** o ganho.
- O bruto e o líquido já estavam certos antes disso e continuam: `restante + sacado` sempre fecha com a posição inteira de antes do saque. Se a divergência com o banco for no *líquido* (e não no "Investido"), a causa é outra — provavelmente o CDI, que é lido "ao vivo" e reprecifica todo o período retroativamente (é a origem da diferença crônica de R$ 0,50–1,00).

## Renda Fixa: como o CDI é calculado (armadilha recorrente)

- **"130% do CDI" não é 130% da taxa anual.** O percentual incide sobre a taxa **diária** e capitaliza em **252 dias úteis**. Com CDI a 14,9%, um CDB de 130% rende 19,79% a.a., não os 19,37% da conta linear. Em 100% do CDI os dois caminhos dão o mesmo número — é o ponto onde a curva toca a reta —, então o erro só aparece em papéis fora de 100%. Ver `effectiveAnnualRateForCdi`.
- **A fonte de verdade é a série diária** (SGS 12, `% ao dia`, só dias úteis), acumulada dia a dia por `accrueCdiFactor`. Isso resolve três coisas de uma vez: o percentual entra no lugar certo, os dias úteis vêm de graça (feriado não está na série, então não precisa de calendário), e mudança de Selic vale só dali pra frente em vez de reprecificar o passado inteiro.
- A série vai pra tabela `economic_daily_rates` porque é **história imutável** — a taxa de um dia que passou nunca muda. Só a ponta vai à rede, com TTL de 1h. Sem isso, cada abertura de tela bateria no Bacen.
- `cdiAnnualRate` (SGS 4392) continua existindo só como **fallback**: extrapola a taxa de hoje pro período inteiro. Quando é ele que entra, `cdiSource.official` vem `false` e a tela mostra um aviso âmbar de "valor estimado" — um CDI errado vira dezenas de reais numa posição grande e **não pode passar despercebido**.
- Os valores em `FALLBACK_CDI_RATE`/`FALLBACK_IPCA_RATE` (bacen.provider.ts) são a última linha de defesa se o Bacen cair. Mantê-los perto do patamar corrente; o valor antigo de 10,75% ficou anos desatualizado e erraria centenas de reais em silêncio.

## Casa ↔ Parcelamento: fatura presumida

`HouseholdCard.linkedCardId` (nullable, `onDelete: SetNull`) vincula opcionalmente um cartão da Casa a um cartão do Parcelamento. Quando a fatura do mês na Casa ainda está em R$0 (não editada) e há vínculo, `HouseholdCardsService.present()` mostra em azul (`presumedInvoice`) a soma das parcelas do Parcelamento que **vencem** naquele mês — nunca grava nada sozinho. Assim que o usuário confirma/edita, vira valor real e o presumido para de se aplicar pra aquela competência.

`InlineAmountCell` (frontend): campo presumido não salva sozinho só de focar+desfocar sem editar (bug real corrigido em 2026-07-26 — só confirma via botão de check explícito, Enter, ou edição de fato) — importante não reintroduzir esse comportamento.

Duas telas mostram cartão da Casa e precisam do prop `presumedValue` no `InlineAmountCell`: a página **Cartões** (`Cartoes.tsx`) e o acordeão "Faturas de cartão" dentro de **Contas** (`Contas.tsx`). Fácil esquecer uma das duas.

## Verificação antes de dar por concluído

Sempre, antes de reportar uma feature/fix como pronta:
1. `pnpm exec tsc --noEmit` em `apps/api` e `apps/web`
2. `pnpm exec jest` em `apps/api` (specs de domain são obrigatórios pra lógica pura nova)
3. `pnpm build` em `apps/web` (roda `tsc -b && vite build`)
4. Verificação end-to-end real (curl direto na API e/ou agente Playwright) — não basta compilar, testar o fluxo de verdade com dados criados na hora.

Ambiente de dev local costuma cair sozinho (Postgres e/ou os processos `start:dev`/`vite dev`) entre sessões — checar com `pg_isready` e `curl` antes de assumir que subiu.
