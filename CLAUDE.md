# Ferramentas do Mauro

App pessoal de finanças (nome do repo/pnpm workspace ainda é `credit-installments`, legado do escopo original). Monorepo pnpm: `apps/api` (NestJS + Prisma + Postgres) e `apps/web` (React + Vite + Tailwind).

## Módulos

- **Parcelamento** (`cards`, `purchases`, `installments`, `calendar`, `timeline`, `statistics`) — o módulo original: cartões, compras parceladas/à vista/recorrentes, controle de parcelas.
- **Casa** (`household`) — orçamento doméstico: contas fixas, cartões próprios (separados do Parcelamento), entradas, dashboard agregado.
- **Investimentos** (`investments`) — renda fixa, ações/FIIs, cripto, proventos, análise fundamentalista (BRAPI + Fundamentus + Yahoo Finance como fontes, com fallback entre elas).
- **Horas** (`tracking`) — controle de ponto/trabalhos freelance e fixos.
- **Financiamentos** (`financings`) — módulo próprio (saiu de dentro do Parcelas): financiamento de veículo/imóvel, parcelas, cotação de quitação, valor do bem e patrimônio. Frontend em `apps/web/src/financings/`, rotas em `/financiamentos`; `/financing` ficou como redirect pra não quebrar link salvo. Os hooks continuam em `features/useFinancings.ts` de propósito — a Home e o Dashboard do Parcelas também consomem financiamento, então não é código exclusivo do módulo.
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
- `InvestmentFixedIncome.contributedAmount` (nullable) = **dinheiro que a pessoa pôs e ainda está lá**, em **regime de caixa** (`splitContribution`): sacou R$ 2.000 de um CDB de R$ 10.000, sobram R$ 8.000 redondos. `null` = nunca houve resgate parcial, então é igual ao principal.
- **O banco mostra o principal, não o aportado.** Conferido contra o extrato real em 2026-08-09: num CDB de R$ 10.000 com saque de R$ 2.000, o banco exibia "Valor total investido R$ 8.009,93" — a base proporcional, exatamente o que o app calcula (R$ 8.009,57). O "Rendimento líquido" do banco também é medido contra ela. Então **tela e dashboard usam `principalAmount` + `netYield`/`netProfitabilityPercent`**; `contributedAmount`/`netGain` ficam guardados e expostos na API, mas respondem outra pergunta ("quanto do meu bolso ainda está aplicado") e não devem ser comparados com o extrato.
- Essa foi uma volta atrás: o campo chegou a mostrar o aportado porque *parecia* ser o que o usuário esperava. Não peça o número do banco depois de decidir — peça antes.
- A divisão proporcional do resgate parcial está **confirmada contra o banco**: pra pagar R$ 2.000 líquidos o banco tirou R$ 1.990,07 de principal, o app tirou R$ 1.990,43. Em 2026-08-10 o principal das duas linhas do CDB BV foi **alinhado à mão com o extrato** (8009,92 / 1990,08, somando os R$ 10.000 originais), porque o banco é a fonte de verdade sobre o que de fato aconteceu no resgate — o cálculo do app era uma previsão dele. **Não "corrigir" esses valores de volta pro proporcional**: a diferença de ~R$ 0,36 não é bug, é o resíduo de arredondamento entre as duas contas.
- `restante + sacado` sempre fecha com a posição inteira de antes do saque. Se sobrar divergência no líquido, os suspeitos em ordem são: (1) **data de aplicação errada por um dia** — dá pra flagrar pela alíquota de IOF, que é aritmética pura de datas e não depende do CDI; (2) o dia útil de defasagem da série do Bacen; (3) o CDI.

## Renda Fixa: como o CDI é calculado (armadilha recorrente)

- **"130% do CDI" não é 130% da taxa anual.** O percentual incide sobre a taxa **diária** e capitaliza em **252 dias úteis**. Com CDI a 14,9%, um CDB de 130% rende 19,79% a.a., não os 19,37% da conta linear. Em 100% do CDI os dois caminhos dão o mesmo número — é o ponto onde a curva toca a reta —, então o erro só aparece em papéis fora de 100%. Ver `effectiveAnnualRateForCdi`.
- **A fonte de verdade é a série diária** (SGS 12, `% ao dia`, só dias úteis), acumulada dia a dia por `accrueCdiFactor`. Isso resolve três coisas de uma vez: o percentual entra no lugar certo, os dias úteis vêm de graça (feriado não está na série, então não precisa de calendário), e mudança de Selic vale só dali pra frente em vez de reprecificar o passado inteiro.
- A série vai pra tabela `economic_daily_rates` porque é **história imutável** — a taxa de um dia que passou nunca muda. Só a ponta vai à rede, com TTL de 1h. Sem isso, cada abertura de tela bateria no Bacen.
- **Imposto e rendimento usam datas diferentes, de propósito** — foi o que finalmente fez bater com o extrato:
  - **IR e IOF contam até a data de liquidação** (`settlementDate`), porque é nesse dia que o dinheiro cairia. CDB de liquidez diária liquida **no mesmo dia útil** — só rola pra frente quando hoje não é dia útil. Contar até "agora" sem essa regra deixa o app um dia atrás no fim de semana (13% em vez de 10% no caso conferido); usar `nextBusinessDay` direto deixa um dia à frente em dia útil, porque o `do...while` nunca considera a própria data (6% em vez de 10%, conferido em 10/08/2026, uma segunda).
  - **Cuidado com o dia da conferência**: no domingo `settlementDate` e `nextBusinessDay` dão a mesma resposta, então o erro acima sobreviveu à primeira validação contra o extrato. Sempre que a regra envolver "próximo dia útil", conferir **num dia útil também** — é o único caso que separa as duas.
  - **O rendimento vai até a VÉSPERA da liquidação**, completando com a última taxa publicada os dias úteis que o Bacen ainda não divulgou (`completarDiasNaoPublicados`) — o extrato conta esses dias, porque a taxa de um dia só sai depois dele fechar. Completar até a própria liquidação (e não até a véspera) conta um dia a mais que o banco; os specs travam os dois erros, um de cada lado.
  - **A contagem de dias corridos compara calendário, não instantes.** `applicationDate` gravada com hora (03:00 UTC = meia-noite de Brasília) fazia o `Math.floor` comer um dia e cair na faixa de IOF errada, enquanto a janela do CDI — que já normalizava pra meia-noite — contava o dia certo. As duas discordavam em silêncio, e foi o que travou o diagnóstico por várias rodadas: IOF dizendo uma data e o rendimento dizendo outra.
  - **Tudo isso depende de saber que dia é hoje no Brasil, não em UTC** (`todayInBrazil`). O servidor roda em UTC e das 21h à meia-noite de Brasília o UTC já virou — nesse intervalo a liquidação pulava um dia útil inteiro. Foi a causa de metade das idas e vindas nessa investigação.
  - Conferido contra o extrato em 2026-08-09 (domingo 23h de Brasília, série até 06/08): liquidação em 10/08, 19 dias úteis de rendimento (18 publicados + a sexta 07/08 completada) e IOF de 27 dias reproduzem os R$ 8.082,74 do banco a menos de R$ 0,20.
- **Erro de um dia afeta todas as aplicações igualmente**, mas só aparece nas grandes: um dia útil vale ~R$ 5 num CDB de R$ 8.000 a 130% do CDI e ~R$ 0,40 num de R$ 755 a 100%. Foi por isso que pareceu problema exclusivo do resgate parcial — era só a posição maior. **Se uma posição diverge e as outras "batem", conferir a proporção antes de concluir que é específico.**
- `cdiAnnualRate` (SGS 4392) continua existindo só como **fallback**: extrapola a taxa de hoje pro período inteiro. Quando é ele que entra, `cdiSource.official` vem `false` e a tela mostra um aviso âmbar de "valor estimado" — um CDI errado vira dezenas de reais numa posição grande e **não pode passar despercebido**.
- Os valores em `FALLBACK_CDI_RATE`/`FALLBACK_IPCA_RATE` (bacen.provider.ts) são a última linha de defesa se o Bacen cair. Mantê-los perto do patamar corrente; o valor antigo de 10,75% ficou anos desatualizado e erraria centenas de reais em silêncio.

## Cotação de ativos: nunca esperar a rede por um número que já temos

- `MarketPriceService` sempre teve cache com TTL, mas o fallback pro valor guardado só acontecia **depois** do timeout. Com a BRAPI fora do ar, uma carteira de ~18 tickers (lotes de 4, timeout de 8s) levava ~36s pra exibir exatamente o mesmo número que já estava no banco no instante zero.
- A regra agora mora em `decideQuoteAction` (domain, com spec): **cache velho é servido na hora e a atualização vai pra segundo plano**; esperar a rede só quando não há nada pra mostrar.
- **Quarentena de 2min por símbolo** depois de uma falha (`PROVIDER_BACKOFF_MS`, em memória). Sem ela, cada requisição recomeçava a fila inteira contra um provedor morto — e era o que enchia o log de `Quote refresh failed` em loop.
- `forceRefresh` (botão "atualizar") fura o TTL, mas **não** a quarentena: insistir num provedor que acabou de estourar o timeout só entrega o mesmo timeout, agora com o usuário parado olhando pra tela.
- Requisições simultâneas do mesmo símbolo compartilham a mesma promise (`inFlight`). O log mostrava o mesmo lote falhando duas vezes com 1s de diferença — Portfolio e Dashboard carregam juntos.
- **Diagnóstico**: `Quote refresh failed ... aborted due to timeout` em rajadas de 4 a cada ~8s = provedor fora, não app lento. Confirmar com `free -h` e o `CPU` do `systemctl status` antes de culpar o código: em 2026-08-10 a VPS estava com 559Mi livres e a API com 12,5s de CPU em 55min, ou seja, presa em I/O de rede.

## Evolução da carteira: o passado é remontado, não gravado

O gráfico acima das abas da Carteira (`/investimentos/carteira`) mostra a classe inteira — não ativo
por ativo — com valor, custo e rentabilidade, mais CDI, Ibovespa e IFIX na mesma escala.

- **O app nunca guardou retrato diário de patrimônio.** A curva é remontada de duas coisas que já
  estavam no banco: **posição no dia D** (varrendo o extrato de transações com preço médio) **×
  fechamento no dia D**. Renda Fixa é o caso fácil: não depende de fechamento nenhum, o valor em
  qualquer data é calculável da série do CDI que já está em `economic_daily_rates`.
- **Comparar patrimônio cru com o CDI é o erro clássico** — um aporte de R$ 5.000 faz a linha saltar
  e parecer que "bateu o CDI" num dia em que nada rendeu. Por isso cada série carrega um **índice de
  retorno time-weighted** base 100 (`buildReturnIndex`): cada intervalo mede `valor_final /
  (valor_inicial + aporte)`, encadeado. É esse índice, e só ele, que vai pro modo "Comparar".
- **Ativo sem histórico de preço sai dos DOIS lados da conta.** Ficar fora do valor mas com o
  dinheiro ainda no fluxo fazia o índice ver R$ 3.255 entrarem e nada aparecer: a aba inteira
  cravava −100% só porque a BRAPI estava fora do ar. Fora da soma = fora do valor e do fluxo, com o
  ticker devolvido em `withoutHistory` pra tela avisar.
- **A série de preços precisa do fechamento anterior à janela.** Janela começando num sábado não tem
  fechamento próprio, e sem o de sexta os primeiros dias caíam no preço médio — a carteira
  "começava" valendo o custo e inventava uma alta na segunda. Confirmado: 3M e um CUSTOM começando
  numa segunda davam 13,5% e 18,45% pro mesmo trecho; hoje dão 18,45% os dois.
- **O último ponto da Renda Fixa vem do `FixedIncomesService`, não de recálculo.** As duas contas
  diferem por um dia útil de rendimento (uns R$ 5 numa posição de R$ 8.000 a 130% do CDI) por causa
  da regra de liquidação/dias não publicados — e um gráfico que termina num número diferente do card
  logo abaixo parece bug mesmo estando quase certo. Conferido: os dois mostram R$ 11.307,70.
- **`historical_prices` agora tem três produtores**: o backfill do COTAHIST (tickers da B3), os
  fechamentos dos ativos da carteira e os índices de referência (`^BVSP`, `^IFIX`). Cripto vai com
  prefixo (`CRYPTO:BTC`) porque o namespace é compartilhado com ticker de bolsa. O
  `getArchivedHistory` do MarketPriceService só devolve datas **anteriores** ao que o provedor ao
  vivo cobre, então as fontes não se sobrepõem — e quando a BRAPI cai, ele passa a ter de onde tirar
  preço.
- **Uma requisição serve as quatro abas.** O que pesa é ir à rede buscar histórico, não somar; e
  comparar as abas entre si era metade do pedido. Resposta inteira em cache de 10min por janela, e a
  série de cada ativo com TTL de 1h só na ponta — sem isso, abrir a Carteira eram ~18 requisições
  HTTP com timeout de 8s cada, a mesma armadilha que já derrubou a cotação.
- **Índice vem da BRAPI, não do Yahoo.** A ordem já foi a inversa e não funcionou em produção: o
  Yahoo devolve **429 pro IP da VPS** em tudo (conferido em 2026-08-23 — `^BVSP`, `^IFIX` e
  `IFIX.SA`), enquanto a BRAPI responde os dois com o token que a API já tem. Faixa de datacenter
  tomando rate limit do Yahoo é comum e não tem conserto do nosso lado — ele fica só como reserva.
  Símbolo: `^BVSP` nas duas; IFIX é `IFIX` na BRAPI (que normaliza pra `IFIX.SA` sozinha) e `^IFIX`
  no Yahoo.
- Índice fora do ar nunca vira erro: a linha some, o chip fica desabilitado e o resto do gráfico
  continua. Cada índice tem lista de candidatos (fonte + símbolo) porque a cobertura varia.
- **O IFIX não tem histórico em fonte nenhuma que o app alcance** (conferido em produção
  2026-08-23/24): a BRAPI devolve a cotação dele mas **1 ponto só** de série (o IBOV vem com 64 no
  mesmo pedido) e o Yahoo responde 429. Por isso `BenchmarkRecorderService` guarda o fechamento dos
  índices um pregão por dia (22h UTC = 19h de Brasília, seg–sex, mais uma passada 1min após subir):
  a série do IFIX é construída daqui pra frente. **O passado não volta**, e o gráfico não finge que
  voltou — sem cobertura o chip continua desabilitado.
- **Resposta com menos de 5 pontos é descartada.** Um ponto solto passava no `length > 0`, o
  candidato ficava memorizado como "esse funciona", os símbolos seguintes nunca eram tentados, e no
  gráfico aquilo virava uma reta em 0% no trecho final — que se lê como "o índice não andou" em vez
  de "não temos o dado".
- **Quando a fonte informa o instante do negócio, é ele que decide o dia do ponto**
  (`resolveQuoteDate`). Em feriado a cotação repete o pregão anterior; gravar como se fosse hoje
  inventaria um pregão que não existiu. Sem esse campo sobra a regra grosseira (só dia útil), e o
  calendário é o **do Brasil** — o servidor roda em UTC e das 21h à meia-noite de Brasília o UTC já
  virou o dia seguinte.
- **O recuo de 1h vale também quando não há nada guardado.** Com a fonte fora do ar o banco nunca
  enche, `faltaComeco` nunca deixa de ser verdade, e sem essa guarda cada abertura da Carteira
  recomeçava a fila inteira de candidatos contra um provedor morto — quatro símbolos a 8s de
  timeout. Mesma lição da quarentena da cotação.

## Financiamentos: valor do bem e patrimônio

- `Financing.assetValue`/`assetValueAt` (nullable) = quanto o bem vale **hoje** (FIPE do veículo, valor de mercado do imóvel). `FinancingAssetValue` guarda a **série** de avaliações — a FIPE muda todo mês, então a avaliação nova não substitui a anterior, ela se soma ao histórico (mesmo padrão de `FinancingPayoffQuote`). O campo desnormalizado é sempre a **última escrita**, não necessariamente a avaliação de data mais recente; o gráfico ordena por data (`summarizeAssetValueHistory`), então backdatar uma avaliação faz os dois divergirem de propósito.
- **Patrimônio = valor do bem − dívida** (`computeFinancingEquity`). A dívida prefere a **quitação à vista** à soma das parcelas restantes — essa soma embute juro futuro que ainda não venceu e superestima. `debtSource` diz qual foi usada, e a tela avisa quando caiu no fallback.
- **`equity` é `null` (não 0) quando o bem não tem valor informado.** Devolver 0 faria "desconhecido" entrar nas somas como fato, e um carro sem FIPE apareceria como dívida pura. Por isso `sumFinancingEquity` também devolve `withoutAssetValue`: a tela mostra o agregado **e** avisa que está incompleto, em vez de exibir um número que parece definitivo.
- `Financing.photo` guarda a **foto do bem como data URL** no próprio registro, não em arquivo: o cliente já corta num quadrado de 320px (`resizeImageToSquareDataUrl`), então são ~25 KB por financiamento — não vale storage, rota estática e backup separado só pra isso. O redimensionamento no cliente é conforto, **não garantia**: `parseAssetPhoto` (domain) revalida tipo e tamanho no servidor, porque chamada direta na API não passa pelo canvas. SVG fica de fora mesmo sendo "imagem" — é documento que executa script, e a foto volta pra tela dentro de um `<img src>`.
- **A Home passou a contar o bem financiado do lado dos ativos** (`calculateNetWorth({ financedAssets })`). Antes só a dívida entrava, e um carro de R$ 60.000 com R$ 20.000 de quitação aparecia como −R$ 20.000 de patrimônio em vez de +R$ 40.000. `netWorth.assetsPendingValuation` conta os bens ativos sem avaliação — sem esse aviso o líquido fica pessimista sem explicação, porque a dívida deles entra inteira e o valor não entra.

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

## CRM: as quatro regras que sustentam o módulo

Módulo independente (`crm`), sem `imports` de outros módulos — em particular não toca no Contas da
Casa. Frontend em `apps/web/src/crm/`, rotas `/crm/*`, cor indigo (violeta pro que é de revendedor).

- **Portfólio é entidade, não enum.** `CrmPortfolio` é configurável e referenciado por id, então
  renomear "Serviço A" não reescreve dado. O seletor global vive num zustand persistido
  (`crm/store.ts`); `portfolioId = null` significa "Todos" e simplesmente não manda o parâmetro.
- **Revendedor ≠ cliente, e o vínculo é que carrega o serviço.** `CrmReseller` é a pessoa;
  `CrmResellerPortfolio` é a relação revendedor×serviço, e é nela que moram crédito, preço e
  estimativa de clientes. Sem isso, quem atende os dois serviços viraria dois cadastros.
- **Saldo de crédito NÃO é coluna.** É sempre `SUM(quantity)` de `CrmCreditMovement`. Guardar o
  saldo criaria duas fontes de verdade que divergem no primeiro erro de transação. Movimentação
  nunca é apagada — erro se corrige com `ADJUSTMENT` contrário. O sinal é imposto pelo tipo em
  `signedQuantity`, então `USAGE` com quantidade negativa ainda debita.
- **Preço e taxa congelam na linha.** `CrmRecharge.unitPrice` e `CrmPayment.feePercent/feeFixed` são
  copiados no momento da operação. Mudar o preço do crédito ou a taxa do PIX hoje não pode
  reprecificar o passado; a alteração vira histórico (`CrmCreditPriceChange`).

**Status do cliente é derivado, não gravado.** `computeCustomerStatus` lê `currentDueDate` a cada
leitura, porque status gravado envelhece sozinho — "ativo" seguiria ativo no dia seguinte ao
vencimento sem ninguém tocar em nada. Só `CANCELLED`/`INACTIVE`/`RECOVERY` são gravados
(`manualStatus`): atos deliberados que o cálculo não adivinha. `currentDueDate` é desnormalizado da
assinatura ativa e **indexado** — é o que faz as janelas do painel (hoje/3/7/30) virarem varredura
de índice em vez de carregar a base e filtrar em JS.

**Cancelar derruba a assinatura; reativar precisa restaurá-la.** Foi bug real: o cliente voltava
"ativo" sem assinatura ativa, e aí valor, plano e forma de pagamento sumiam da tela — o template de
cobrança renderizava literalmente "o valor da renovação é `{{valor}}`".

**A estimativa de clientes do revendedor é chute informado à mão**, com histórico de alteração
(`CrmApproxClientsChange`). A UI é obrigada a rotular como estimativa e usar "~"; ela nunca entra na
mesma soma dos clientes reais do CRM.

**Receita direta e de revendedor são tabelas distintas** (`CrmPayment` vs `CrmRecharge`), não uma
flag — somar as duas por engano deixa de ser possível. Dashboard e Financeiro sempre mostram as duas
origens junto com o total, nunca só o total.

**O módulo não envia mensagem.** `renderMessage` devolve texto + link do `wa.me`; quem clica em
enviar é a pessoa. Não existe função de envio no backend, de propósito.

**Churn de "Todos" não é a soma dos churns** — é recalculado sobre a união, senão vira média de
porcentagens. Mesma lógica pras coortes de retenção, que só contam quem teve tempo de alcançar cada
marco (senão todo cliente novo derruba a coluna de 12 meses).

**Nenhum indicador conta em JS.** Todos os números do dashboard são `count`/`aggregate`/`groupBy` no
Postgres, e as posições de crédito de todos os vínculos saem numa consulta só. A VPS tem 1GB e essa
tela abre a cada visita — foi exatamente assim que a Home quebrou antes.

## CRM: dois estoques de crédito, e eles se movem em direções opostas

Essa é a distinção que sustenta o financeiro do módulo, e confundir as duas inverte o sinal do lucro:

- **`CrmPanelRecharge` / `CrmPanelCreditMovement`** = o **seu** estoque. Você compra do painel de
  cima; é **custo**. Saldo por serviço, sempre `SUM(quantity)` do extrato.
- **`CrmRecharge` / `CrmCreditMovement`** = o estoque do **revendedor**. Ele compra de você; é
  **receita**.

**Renovar consome crédito e é BLOQUEADO quando o saldo não cobre.** O custo vem do plano
(`CrmPlan.creditCost`), com override opcional na assinatura (`resolveCreditCost`). A checagem roda
antes de gravar qualquer coisa; a baixa acontece dentro da mesma transação do pagamento, porque
pagamento gravado sem baixa faria o saldo divergir do painel real em silêncio, uma renovação por vez.

**Repasse a revendedor debita do seu estoque** por padrão (`deductResellerRechargesFromPanel`), já
que o sub-painel dele costuma ser abastecido pelo seu. Desligável em Configurações pra quem compra o
painel do revendedor à parte.

**O custo do crédito é a média ponderada das compras**, não a média dos preços: 1000 a R$ 0,90 mais
10 a R$ 2,00 dá R$ 0,91, não R$ 1,45 — 59% de diferença no custo. Quando não há compra registrada,
`averagePanelCreditPrice` devolve `null` e o lucro sai com `costUnknown: true`, porque margem cheia
sem dizer que o custo ficou de fora é o número que faz decidir errado.

**Moeda é do serviço** (`CrmPortfolio.currency`): o que é vendido em dólar é recebido em dólar e tem
o crédito comprado em dólar. No consolidado de "Todos", receita e lucro saem **agrupados por moeda**
(`groupRevenueByCurrency`), nunca somados num total único — mesma regra do churn.
