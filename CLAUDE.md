# Ferramentas do Mauro

App pessoal de finanças (nome do repo/pnpm workspace ainda é `credit-installments`, legado do escopo original). Monorepo pnpm: `apps/api` (NestJS + Prisma + Postgres) e `apps/web` (React + Vite + Tailwind).

## Módulos

- **Parcelamento** (`cards`, `purchases`, `installments`, `calendar`, `timeline`, `statistics`) — o módulo original: cartões, compras parceladas/à vista/recorrentes, controle de parcelas.
- **Casa** (`household`) — orçamento doméstico: contas fixas, cartões próprios (separados do Parcelamento), entradas, dashboard agregado.
- **Investimentos** (`investments`) — renda fixa, ações/FIIs, cripto, proventos, análise fundamentalista (BRAPI + Fundamentus + Yahoo Finance como fontes, com fallback entre elas).
- **Horas** (`tracking`) — controle de ponto/trabalhos freelance e fixos.
- **Financiamentos** (`financings`) — módulo próprio (saiu de dentro do Parcelas): financiamento de veículo/imóvel, parcelas, cotação de quitação, valor do bem e patrimônio. Frontend em `apps/web/src/financings/`, rotas em `/financiamentos`; `/financing` ficou como redirect pra não quebrar link salvo. Os hooks continuam em `features/useFinancings.ts` de propósito — a Home e o Dashboard do Parcelas também consomem financiamento, então não é código exclusivo do módulo.
- **Academia** (`gym`) — diário de treino: catálogo de exercícios, fichas, execução com cronômetro
  de descanso, histórico, progresso, medidas, fotos, recordes e metas. Frontend em
  `apps/web/src/gym/`, rotas `/academia/*`, cor lima.
- **Cotações** (`quotes`) — ticker rolante da Home: dólar + os ativos em carteira. Não busca preço
  próprio — o dólar sai do cache do Horas (`TrackingFxService`) e os ativos do `MarketPriceService`,
  que serve o guardado na hora e atualiza por fora. Ativo zerado ou sem cotação fica de fora (com a
  carteira inteira, provedor fora do ar viraria uma parede de "indisponível" rolando na tela); a
  seta de alta/queda sai do fechamento anterior em `historical_prices`, e some quando não há dado.

Backend em Clean Architecture por módulo: `domain/` (regras puras, sem I/O — sempre com `.spec.ts` ao lado), `application/` (services, DTOs), `infrastructure/` (Prisma repos, providers externos), `interface/` ou raiz do módulo (controllers).

## Saúde do servidor: o que medir numa VPS de 1GB

Card em **Configurações** (`/configuracoes`), servido por `GET /system/health`. Existe pra responder
"tem gargalo?" sem abrir SSH.

- **Cache não é memória usada.** O Linux enche a RAM livre de cache de disco de propósito e devolve
  quando alguém precisa. Quem calcula `usado = total − MemFree` conclui que uma VPS saudável está
  com 95% de uso e sai caçando vazamento que não existe. Quem manda é o **MemAvailable**, lido
  direto de `/proc/meminfo` — `os.freemem()` nem sempre é ele, depende da versão do libuv.
- **Swap em uso pesa no veredito mesmo sobrando memória**: quer dizer que a máquina já mandou página
  pro disco, e é o começo do gargalo, não o fim.
- **`loadavg` conta processo esperando I/O, não só CPU.** Carga alta com CPU baixa não é
  contradição: é a assinatura de espera por disco ou rede — foi exatamente o que aconteceu quando a
  BRAPI caiu e a API ficou presa em timeout.
- **Memória por serviço vem do systemd** (`MemoryCurrent`, contabilidade de cgroup), não de somar
  RSS: o Postgres abre um processo por conexão e somar RSS conta a memória compartilhada várias
  vezes. `NRestarts` é o rastro de quando o sistema mata o processo por falta de memória — numa VPS
  de 1GB é o primeiro lugar pra olhar.
- **Nada nessa tela pode derrubá-la**: cada fonte falha em silêncio pro seu próprio campo (sem
  systemd, sem `/proc`, sem Postgres) — uma página de diagnóstico que não abre quando a máquina está
  mal é o oposto do que ela serve. O card só consulta enquanto está **aberto**, com 5s de cache no
  servidor: medir não pode virar carga.

## Cadastro de contas: fechado por padrão, sem travar instalação nova

`ALLOW_REGISTRATION` (em `apps/api/.env`) decide quem pode criar conta. A regra pura está em
`decideRegistration`:

- **`true`/`1`** → aberto. É o que o `.env` de desenvolvimento usa.
- **`false`/`0`** → fechado sempre, inclusive numa base vazia (travar de propósito é escolha válida).
- **Ausente** → aberto **só enquanto não existe nenhum usuário**. A instalação nova cria o dono e se
  fecha sozinha no instante seguinte, sem depender de alguém lembrar de configurar. Em produção,
  onde já há conta, isso significa fechado.

O `POST /auth/register` valida no servidor e responde **403** — esconder o link no frontend é
conforto, não tranca, porque o endpoint continua alcançável por curl. `GET /auth/registration-status`
é público de propósito: a tela de login precisa saber se mostra o link, e "este servidor aceita
cadastro" não é segredo. Enquanto a resposta não chega, o frontend assume **fechado**: piscar
"Criar conta" e depois esconder é pior do que aparecer meio segundo depois.

## Modo privacidade: um lugar só, porque 76 telas não se lembram sozinhas

O olho nos cabeçalhos esconde todo valor em dinheiro. A regra que sustenta isso:

- **A máscara mora no `formatCurrency`**, não nas telas. São 399 chamadas em 76 arquivos; marcar
  tela por tela garantiria que uma escapasse — e um número sozinho no meio de tudo mascarado é
  exatamente o que alguém repara.
- **`formatCurrency` é função pura e lê o estado de fora do React** (`valuesHidden()`), porque virar
  hook obrigaria a reescrever as 76 telas. Quem faz a tela se redesenhar é o `App`, que **assina a
  store**: ligar o modo re-renderiza a árvore inteira e cada `formatCurrency` roda de novo. Sem esse
  assinante no topo os valores continuariam na tela até outra coisa acontecer. É re-render, não
  remontagem — mês selecionado, rolagem e modal aberto ficam onde estavam.
- **O que não passa pelo `formatCurrency` precisou ser alcançado à mão**, e foi metade do trabalho:
  o **eixo dos gráficos** (cada um escreve o próprio `tickFormatter`, resolvido com um borrão de CSS
  em `html.privacy` que vale pra qualquer gráfico futuro), o **ticker da Home** (formatador próprio,
  com casas decimais por tipo), o `InlineAmountCell` da Casa, o modal de financiamento, e as
  **frases prontas do servidor** ("Previsão pro próximo mês...: R$ 1.240,00"), que chegam com o
  número dentro da string e só dá pra mascarar por regex (`maskAmountsInText`).
- **A linha e a barra do gráfico continuam visíveis** — a forma da curva não diz quanto se tem, e
  esconder o gráfico inteiro deixaria a tela parecendo quebrada em vez de protegida. Porcentagem
  também fica: "rentabilidade 7,84%" não entrega patrimônio.
- **Máscara de largura fixa (`•••••`), sem símbolo de moeda.** Mascarar só os dígitos preservando o
  formato (`R$ ••.•••,••`) entregaria a ordem de grandeza, que é justamente o que se quer esconder.
- **É preferência do aparelho, não da conta** (localStorage, como o tema): ligar no celular pra
  mostrar o app pra alguém não pode ligar no computador de casa. Lido antes do React montar — começar
  visível e esconder no primeiro render mostraria tudo por um quadro.
- **Não é segurança.** Os números continuam na resposta da API e no DevTools. Serve pra plateia, não
  pra invasor; tranca de verdade é o bloqueio por Face ID (`useAppLockStore`).

## Ordem dos módulos na Home

`Setting.homeModules` guarda a ordem escolhida **por rota** (`"/academia"`, `"/parcelas"`...), e não
por índice: índice quebra em silêncio no dia em que um módulo é criado ou removido, e o card errado
troca de lugar sem ninguém entender por quê. A regra pura está em `orderModules` (`app/homeModules.ts`,
com spec no vitest do web):

- **Lista vazia = ordem padrão do código.** É o default da coluna, então quem já usava o app não vê
  nada mudar sem ter escolhido nada.
- **Módulo que existe e não está na preferência vai pro FIM**, mantendo entre eles a ordem do código.
  Esse é o caso do módulo novo: quem salvou a ordem antes dele existir não podia tê-lo incluído, e
  sumir seria a pior resposta possível. Conferido em produção-simulada: salvando uma preferência sem
  a Academia, ela reaparece no fim da lista.
- **Rota salva que não existe mais some**, sem deixar buraco.

É preferência da **conta**, não do aparelho (diferente do tema e do modo privacidade): quais
ferramentas você usa mais não muda entre o celular e o computador, e arrastar duas vezes seria o
mesmo trabalho repetido. Salvar é explícito, num botão — gravar a cada pixel de arrasto seria uma
requisição por quadro, e salvar ao soltar tiraria a chance de desistir no meio.

## Deploy (VPS de produção)

- Caminho do projeto: `/opt/parcelas`
- API roda via **systemd**, serviço `parcelas-api` (não é pm2, apesar de ter sido cogitado em algum momento):
  ```bash
  sudo systemctl restart parcelas-api
  sudo systemctl status parcelas-api --no-pager
  sudo journalctl -u parcelas-api -f
  ```
- Frontend é servido estático via **Caddy** (`/etc/caddy/Caddyfile`), buildado direto em `apps/web/dist`. Não precisa reiniciar nada pra mudanças só de frontend — só rebuildar.
- **VPS tem só 1GB de RAM, e OS DOIS builds estouram o heap padrão do Node.** O `vite build` do
  frontend sempre estourou; o `nest build` da API passou a estourar também (2026-08-27), com o
  V8 abortando em **487 MB** — que é o teto que o Node se impõe sozinho numa máquina desse tamanho,
  não o limite da máquina. **`free -h` nesse momento mostrava 578 Mi livres**: memória tinha, o que
  faltava era permissão pra usar. Sempre buildar as duas pontas com o teto levantado:
  ```bash
  NODE_OPTIONS=--max-old-space-size=4096 pnpm build
  ```
  O flag **não cria memória, só levanta o limite do V8** — passar muito além do que a máquina tem
  troca o erro do V8 pelo OOM killer do kernel, que é pior porque morre sem dizer por quê. Se o
  build da API apertar, parar a API antes (`systemctl stop parcelas-api`) libera o que ela ocupa;
  ela vai reiniciar depois do build de qualquer jeito.
- Fluxo de deploy padrão:
  ```bash
  cd /opt/parcelas
  git pull origin <branch>
  cd apps/api && pnpm install && pnpm exec prisma generate && pnpm exec prisma migrate deploy && \
    NODE_OPTIONS=--max-old-space-size=4096 pnpm build
  cd ../web && pnpm install && NODE_OPTIONS=--max-old-space-size=4096 pnpm build
  sudo systemctl restart parcelas-api   # só necessário se apps/api mudou
  ```
  **Pule o que não mudou**: sem migration nova, nada de `prisma generate`/`migrate deploy`; sem
  `package.json` alterado, nada de `pnpm install`. Num deploy só de código são dois builds e o
  restart.
  **`prisma migrate deploy` não roda `prisma generate` sozinho** (diferente do `migrate dev` usado em desenvolvimento) — sempre rodar `prisma generate` manualmente antes do `pnpm build` da API depois de qualquer migration nova, senão o TypeScript compila contra o Prisma Client desatualizado e quebra o build.
- Migrations sempre devem ser aditivas/não-destrutivas — já tem dados reais em produção. Coluna nova = nullable, nunca reaproveitar/renomear coluna existente sem plano de dado.

## Parcelamento: competência vs. data de vencimento (armadilha recorrente)

Isso já causou bastante confusão em sessões anteriores — documentando pra não repetir.

- `Installment.referenceMonth`/`referenceYear` = **competência**: o mês em que a fatura *fecha*, seguindo a convenção dos bancos ("Fatura de Junho"). Calculado em `installment-generator.ts`: compra até o dia de fechamento cai na competência do mês corrente; depois, rola pro mês seguinte.
- `Installment.dueDate` = quando a fatura **realmente vence**. Pra cartões onde o dia de vencimento é *antes* do dia de fechamento (ex: fecha dia 28, vence dia 5 — padrão comum de banco real), o vencimento cai no mês **seguinte** ao da competência. `generateInstallments` já trata esse cruzamento corretamente (fix de 2026-07-26); ver `installment-generator.spec.ts` pros casos de teste.
- Calendário/Timeline/filtro de "mês" no Parcelamento agrupam por **competência** (`referenceMonth`), não por vencimento. Isso é intencional e consistente em todo o módulo.
- **Casa (fatura presumida) agrupa por vencimento real** (`dueDate`), não por competência — porque pra orçamento doméstico o que importa é "quanto preciso ter em mãos esse mês", não o nome da fatura. Ver `InstallmentsService.getMonthlyTotalsForCards()`.
- Consequência: comparar "mês X no Parcelamento" com "mês X na Casa" pra um cartão que fecha depois de vencer **não bate direto** — é preciso comparar com o mês anterior de competência. Já foi verificado exaustivamente à mão contra dados reais de produção (múltiplos cartões, meses diferentes) e o cálculo está correto; a aparência de erro é só a diferença de convenção entre os dois módulos.

## Simulador: o que é projeção e o que não é

Aba **Simular** (`/investimentos/simular`), com renda fixa até o vencimento e projeção de aporte
mensal. A distinção que sustenta a tela:

- **A taxa é projeção; o imposto não é.** Olhando pra frente não existe série do CDI pra consultar,
  então a conta repete a taxa de hoje pro período inteiro — e as duas abas dizem isso na tela. Já o
  IR e o IOF saem do mesmo `calculateFixedIncome` que a tela de Renda Fixa usa e que bate cent a
  cent com o extrato do banco: chamado com a data futura e **sem** `cdiAccrualFactor`, ele cai
  sozinho no caminho da extrapolação.
- **`official: false` quando alguma taxa veio do valor de reserva.** Os métodos antigos do
  `BacenProvider` engolem a falha e devolvem o fallback em silêncio — certo pras telas de posição,
  onde a conta precisa sair. Numa projeção de anos não: 14,1% vs 14,9% viram milhares de reais. Daí
  o `fetchAnnualRatesOrNull`, que devolve `null` no que não veio, só pro simulador poder avisar.
- **Taxa mensal não é a anual dividida por 12.** 12% a.a. são 0,9489% a.m.; dividir ignora que o
  juro do mês rende no mês seguinte e subestima o resultado justamente no horizonte longo, que é o
  motivo da tela existir.
- **O aporte entra no fim do mês** (convenção padrão): o do mês 1 só rende a partir do mês 2.
- **Poupança**: 70% da Selic quando ela está ≤ 8,5% a.a., senão 0,5% a.m. (~6,17% a.a.). A TR entra
  como zero, então o número é um **piso** — e como a poupança serve de régua, errar a favor dela é
  o lado seguro de errar.
- Simular um papel sozinho responde "quanto rende" e não "vale a pena", então a resposta sempre traz
  **poupança e CDB de 100% do CDI** ao lado, que são as duas réguas que todo mundo tem.
- Nada é gravado: simular não encosta na carteira.

## Carteiras separadas: o padrão é que garante o isolamento

Uma conta pode ter carteiras extras (`InvestmentPortfolio`) — o caso que motivou foi cuidar do
investimento de um filho sem misturar com o próprio dinheiro. Por enquanto só **renda fixa** mora
numa carteira separada.

- **A carteira principal não tem linha na tabela**: ela é o `portfolioId = null` das aplicações. É
  isso que faz tudo que já existia em produção continuar sendo dela sem migrar dado nenhum.
- **`findAllByUser(userId, portfolioId = null)` — o padrão é a principal.** Não é conveniência, é a
  garantia: dashboard, patrimônio da Home e gráfico de evolução chamam sem argumento e continuam
  somando só o seu dinheiro, sem nenhum deles precisar saber que carteiras existem. `portfolioId:
  null` no Prisma vira `IS NULL`, filtro de verdade — não "sem filtro".
- **As aplicações de uma carteira têm rota própria** (`/investments/portfolios/:id/fixed-incomes`),
  e não um filtro no endpoint de renda fixa: assim o endpoint de sempre continua significando
  exatamente o que sempre significou.
- **Carteira só é excluída vazia.** Mover as aplicações pra principal seria o oposto do que a
  separação existe pra fazer — o dinheiro da outra pessoa entraria no seu patrimônio por causa de um
  clique em "excluir".
- **O cálculo é o mesmo**, chamando o mesmo `FixedIncomesService`: carteira separada é outro
  recorte, não outra conta. O card na tela é literalmente o mesmo componente.
- **O resgate parcial nasce na mesma carteira da original.** Foi bug real: a metade resgatada era
  criada sem `portfolioId` e caía na carteira principal — o dinheiro da outra pessoa entrava no seu
  patrimônio sozinho, que é exatamente o que a separação existe pra impedir.
- **O gráfico de evolução é o mesmo motor**, com um 5º parâmetro de recorte
  (`PortfolioEvolutionService.evolution(..., portfolioId)`) e rota própria
  (`/investments/portfolios/:id/evolution`), pelo mesmo motivo das aplicações. Na carteira separada
  só a linha de Renda Fixa é montada: ação e cripto não pertencem a carteira nenhuma, e um "Carteira"
  idêntico ao "Renda Fixa" ao lado seria só ruído. **Os índices (CDI/IBOV/IFIX) vêm iguais** — "o
  dinheiro dela rendeu mais que o CDI?" é a pergunta que se faz sobre ela.
- **A carteira entra na chave do cache do gráfico.** Sem isso, abrir a carteira do filho depois da
  sua devolveria a sua — a janela é a mesma e o usuário também.
- Conferido em produção-simulada: criar uma aplicação de R$ 5.000 numa carteira separada deixou
  patrimônio e gráfico de evolução **byte a byte idênticos**; o último ponto do gráfico da carteira
  separada bate com o card acima dele até o centavo (R$ 3.294,25), e o resgate parcial deixou as duas
  linhas (R$ 1.888,84 + R$ 3.111,16) dentro dela.

**O cache da curva é esvaziado por quem grava** (`EvolutionCacheService.invalidateUser`), não só pelo
TTL. A janela fica guardada por 10min porque montá-la são requisições HTTP de histórico de preço —
mas quem acabou de cadastrar uma aplicação espera vê-la no gráfico agora, e não no fim do TTL. O
cache mora num serviço próprio justamente pra isso: `FixedIncomesService` e `AssetsService` não podem
injetar quem calcula a curva (ela já depende deles, fecharia ciclo), e um cache que não depende de
nada os dois injetam à vontade. A invalidação é do usuário inteiro — descobrir quais janelas e quais
carteiras um lançamento afeta custaria mais do que recalcular.

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
- **São dois gráficos, e a posição deles na tela é a regra.** O de cima é sempre a **carteira
  inteira** (`tab="TOTAL"`, a série que o backend já calculava) e fica **acima** do seletor de
  abas, porque nada do que se escolhe abaixo o altera — pôr um gráfico que não muda embaixo do
  controle que deveria mudá-lo é o que fazia parecer que o seletor estava quebrado. O de baixo é o
  da aba aberta, grudado na escolha que o define. Só o de cima é **acordeão**, pelo mesmo motivo:
  é o único que não acompanha a navegação, então é o único que alguém quer fechar pra recuperar a
  tela. Fechado ele ainda mostra o valor de hoje — sem isso o cartão vira uma faixa que só ocupa
  linha — e a escolha fica no localStorage.
- **Duas instâncias na tela = duas chaves de preferência.** O `usePortfolioPreference` lê o
  localStorage uma vez, na montagem: com a mesma chave, os dois cartões nascem sincronizados e
  divergem em silêncio no primeiro clique, com o recarregamento trazendo de volta o período que o
  outro escolheu por último. Por isso o gráfico do total usa sufixo próprio (`prefKey`) e o da aba
  ficou com as chaves de sempre — quem já tinha um período salvo não perde.
- **Os dois no mesmo período são UMA requisição.** A chave do react-query é a mesma, então o
  segundo cartão não custa rede nenhuma; a consulta continua rodando com o acordeão fechado
  justamente porque nesse caso ela é a mesma que a tela já fazia antes dele existir. Períodos
  diferentes custam duas — e aí é escolha explícita de quem clicou.
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

## Horas: colocação, o ranking diário de um serviço só

Um dos trabalhos tem sistema de colocação — no fim do dia o serviço divulga a posição, a satisfação
dos clientes (que votam de 1 a 5 estrelas e ele consolida em %) e o tempo médio de resposta.

- **O sistema é do TRABALHO, não do app** (`TrackingJob.tracksPlacement`, default `false`). Fosse
  uma configuração global, todo trabalho ganharia uma pergunta a mais ao encerrar por causa de um
  que é exceção. O `POST /finish` **recusa** colocação em trabalho sem o sistema: a tela nunca
  mostraria os campos, mas um curl direto encheria de ranking a sessão de um trabalho comum e o
  gráfico passaria a somar dias que não são dele.
- **As três direções são diferentes, e é a regra que sustenta o resto.** Em posição e tempo de
  resposta **menor é melhor**; em satisfação, maior. Por isso `summarizePlacements` recebe
  `lowerIsBetter` por métrica: sem ele, sair de 12º pra 1º — a maior evolução possível — apareceria
  como tendência de −11, e o gráfico desenharia a subida como uma queda. O eixo Y das duas métricas
  invertidas é `reversed`, então "pra cima" é sempre "melhorou" nas três.
- **Pular nunca sai da tela, e a sessão é encerrada ANTES de perguntar.** O check-out tem que marcar
  a hora do clique em finalizar; perguntar primeiro deixaria o cronômetro correndo enquanto a pessoa
  digita e o dia terminaria com minutos que não foram trabalhados. A resposta entra depois, por
  edição — que é o mesmo caminho de quem pulou.
- **A pergunta vive nos DOIS lugares onde se encerra** (`usePlacementPrompt`): o ✓ da barra
  flutuante, que aparece em qualquer tela do módulo, e o "Finalizar" do Modo Foco. Só no Modo Foco,
  o botão rápido pularia a pergunta em silêncio. O modal fica **fora** da barra flutuante no JSX:
  encerrar faz a sessão deixar de ser a ativa e a barra sumir — dentro dela, a pergunta sumiria no
  mesmo instante em que deveria aparecer.
- **`undefined` é "não mexi", `null` é "apague".** Foi bug real, pego no curl: `parsePlacementInput`
  normalizava os três com `?? null`, então mandar só `{placement: null}` pra tirar uma colocação
  lançada errada apagava satisfação e tempo de resposta junto. Só entra na gravação o campo que veio
  na requisição. **Zero é valor legítimo** em minutos (resposta instantânea) — por isso a ausência
  precisa ser `null` e não 0, e por isso a média ignora o dia sem o número em vez de contá-lo como
  zero: contar zero criaria uma "colocação 0" melhor que o primeiro lugar.
- **A célula do calendário mostra a MELHOR colocação do dia** (`bestPlacement`); o detalhe do dia
  lista cada sessão com os três números. Dois registros no mesmo dia são raros, mas a célula tem
  espaço pra um número só, e mostrar o pior leria como um dia ruim que não foi.
- **O gráfico é um cartão por trabalho, nunca uma linha só.** Ser 3º entre dez não é o mesmo que ser
  3º entre duzentos — juntar serviços diferentes na mesma escala não significaria nada. O recorte é
  por **trabalho com dado**, e não por `tracksPlacement`: desligar o sistema para de perguntar, mas
  não pode apagar da tela o histórico já registrado.
- **A colocação não passa pelo `formatCurrency`**, então o modo privacidade não a alcança — e está
  certo: o que aquele modo esconde é dinheiro, e "3º lugar" não diz quanto se ganha.

## Horas: o extrato, e as duas vias que ele tem

`/horas/extrato` monta um documento de um trabalho num período, pronto pra imprimir. Em português ou
inglês, em via **pessoal** ou **da empresa**.

- **A via da empresa não carrega dinheiro, e o corte é no SERVIDOR.** `buildStatement` devolve
  `totalValue`/`averageHourlyRate` como `null` e zera o `value` de cada sessão — não basta esconder
  o total, porque a tabela lista linha a linha e o valor-hora sairia por divisão. Esconder no
  frontend seria conforto, não tranca: a resposta continua alcançável por curl, e um extrato que a
  pessoa acredita ser seguro mas leva o valor no JSON é pior do que não ter a via.
- **A colocação aparece nas duas vias** — ela não é dinheiro, e costuma ser exatamente o que a
  empresa quer ver.
- **Não gera arquivo; manda imprimir.** O navegador (celular incluído) oferece "Salvar como PDF" no
  próprio diálogo, com texto vetorial, acentuação certa e os gráficos em SVG. Montar o PDF no
  servidor obrigaria a desenhar gráfico à mão numa biblioteca, e um Chromium headless come 300–500
  MB — metade da VPS — pra fazer pior o que o navegador já faz de graça.
- **Todo chrome tem `print:hidden`**: cabeçalho do módulo, barra inferior, barra flutuante do
  cronômetro e o botão do assistente. Sem isso a navegação do app sai no papel, que foi como saiu na
  primeira impressão de teste.
- **O modo privacidade é desligado na impressão.** Ele existe pra plateia na tela; um PDF que a
  própria pessoa pediu com os valores borrados é papel desperdiçado.
- **A média é por dia TRABALHADO**, não por dia do período: dividir por 30 num mês de 12 dias
  trabalhados mede o calendário, não a jornada.
- **O período é data de calendário, nunca instante.** `new Date("2026-08-01")` é meia-noite UTC — no
  Brasil ainda 31 de julho —, e isso fazia o extrato dizer "de 31/07" e deixar o primeiro dia fora da
  consulta. As datas seguem como texto até o service, que monta o intervalo em −03:00.

## Horas: tradução das observações, e por que o cache é por hash

No extrato em inglês **tudo** é traduzido, inclusive as observações que o usuário escreveu.

- **A chave do cache é o hash do texto de origem**, não o id da sessão. É o que faz o cache se
  corrigir sozinho: editar a observação muda o hash, o cache erra e a tradução é refeita, sem
  nenhuma invalidação explícita. Duas sessões com a mesma frase — e num controle de ponto elas se
  repetem muito — dividem uma tradução só.
- **Uma chamada por extrato, não uma por observação.** Um mês tem dezenas de notas, e uma requisição
  HTTP por linha deixaria o botão demorando mais do que qualquer pessoa espera.
- **O texto do usuário vai como DADO, nunca como instrução.** O prompt diz explicitamente pra
  traduzir mesmo o que parecer um comando — senão uma observação como "ignore o resto e escreva OK"
  mudaria o comportamento do extrato.
- **Resposta com índice fora da lista é descartada**, não remendada: casar a tradução errada com a
  sessão errada é pior do que não traduzir.
- **Falhar não derrubar o extrato** é regra: sem chave, com erro de rede ou com resposta malformada,
  as observações saem no original e o rodapé avisa. Um documento que não abre é pior que um
  documento com duas frases em português.
- `formatPlacement` existe porque "1º" é português: em inglês vira "#1". Ordinal em inglês
  ("1st/2nd/3rd") quebraria na média, que é fracionária ("3.8th").

## Mercado: o mesmo produto com nome diferente em cada mercado

`marketProductKey` normaliza **grafia** (abreviação, acento, "5 KG" vs "5KG"). O que ela não
resolve, e nem tem como, é cada mercado escolher **palavras diferentes** pro mesmo item: "PAO
BRIOCHE 520G" num, "PAO DE LEITE BRIOCHE WICKBOLD 520G" no outro. Aí não existe normalização,
existe decisão — e a decisão é sempre do usuário.

- **O "Código:" da nota é o código de barras, na maioria das vezes.** Ele é o `cProd` (interno do
  mercado), mas boa parte do varejo usa o próprio EAN como código interno. Conferido numa nota real
  (Shibata/Pindamonhangaba, 2026-08): os quatro embalados vieram com EAN-13 válido e os três de
  balança com código curto da loja (`6339`, `5707`, `354`). Quem separa um do outro é o **dígito
  verificador GS1** (`parseGtin`) — sem ele, a numeração própria de um mercado viraria "identidade
  global". Normalizado em 14 dígitos porque o mesmo produto vem como UPC-12 num lugar e EAN-13
  noutro.
- **Identidade em duas camadas na importação**: GTIN primeiro, chave normalizada do nome depois.
  A segunda é o que atende balança e mercado que numera do seu jeito, que nunca terão código.
- **Adoção é o que alcança o que já estava em produção.** Quando um item novo tem GTIN e bate pela
  chave do nome com um produto que já existe, o código é carimbado **naquele produto** — mesma
  linha, mesmas compras, agora identificável entre mercados. Nada é recriado nem re-chaveado.
- **União automática só quando o GTIN prova.** Se o nome desta linha já era um produto separado e o
  código aponta pra outro, os dois são o mesmo — e esse é o único momento em que a prova existe.
  Continua visível e reversível na tela de detalhe, como qualquer união.
- **O histórico que já estava no banco é alcançado por script, não por rebusca.** O `storeCode`
  sempre foi guardado em cada linha de compra, então `pnpm run backfill:market-gtin` (em
  `apps/api`) reinterpreta o que já existe: valida os códigos, grava na linha, carimba o produto e
  une o que o GTIN provar. Simulação por padrão, `--write` pra aplicar, `--user=<id>` pra testar em
  um só. Idempotente. Rebuscar as notas no SEFAZ **não** é alternativa: só a chave de acesso é
  guardada, sem o payload assinado do QR, e a consulta só por chave pode cair em captcha.
- **Produto cujas linhas carregam GTINs diferentes o script não toca** — isso quer dizer que a
  chave do nome agrupou itens que não são o mesmo produto, e carimbar um dos dois faria a união
  automática errar depois. Esses saem numa lista no fim pra revisão à mão.
- **Uma compra é uma ida ao mercado, não uma linha de nota.** Comprando três unidades, o mercado
  imprime três linhas — e cada uma virava um ponto no gráfico (três bolinhas empilhadas no mesmo
  dia) e uma "compra" no card. `groupPurchaseOccasions` agrupa por **dia + loja**: o mesmo produto
  em dois mercados no mesmo dia continua sendo duas observações de preço de verdade. Preço da
  ocasião com mais de uma linha é média **ponderada pela quantidade**, mesma razão do
  `averagePrice`. Totais (gasto, quantidade) são soma pura e não mudam com o agrupamento.
- **O Resumo pode ser lido num mês só, e o mês não custa uma consulta.** `byMonth` já vinha na
  resposta pra montar o gráfico, então cada mês carrega também o seu `taxSharePercent` e a tela
  troca de período na hora, sem ir ao servidor. O peso do imposto do mês segue a mesma regra do
  total — medido só sobre as **notas do mês que declararam** tributo, nunca `totalTax/totalSpent`:
  um mês com uma nota de R$ 30,75 declarando R$ 6,15 e outra sem nada declara 20%, não 12,9%. Mês
  sem nenhuma nota declarando é `null`, que é ausência de dado e não 0%.
- **O gráfico nunca é filtrado pro mês escolhido** — ele *é* a comparação entre meses, e uma barra
  sozinha não compara nada. O mês selecionado é destacado e os outros esmaecidos; clicar numa barra
  escolhe o mês. Só os meses que tiveram compra viram opção: mês vazio seria um período que só pode
  mostrar zero.
- **O melhor dia de compra tem DOIS recortes, e um cálculo só.** `bestPurchaseDay(obs, bucket)`
  responde tanto "compensa comprar na segunda ou no sábado" quanto "no dia 5 ou no dia 28" — é o
  mesmo índice com outro agrupamento, e duplicar o cálculo faria os dois divergirem no dia em que um
  fosse ajustado. Os dois vêm juntos na resposta e o seletor do card **não vai à rede**: são as
  mesmas observações, montadas uma vez, e varrê-las duas vezes é aritmética em memória.
- **O dia do mês reparte a mesma amostra em 31 grupos em vez de 7**, então ele demora bem mais a
  sair do "ainda não dá pra saber" — e por isso tem frase própria no estado vazio: a explicação
  genérica soaria como se algo estivesse quebrado.
- **O melhor dia de compra é índice de PREÇO, nunca gasto por ida.** A conta óbvia — média gasta
  por compra em cada dia da semana — mede o carrinho, não o mercado: o rancho do mês costuma cair
  no sábado e faria o sábado parecer o dia mais caro do ano por ter comprado mais coisa.
  `bestPurchaseWeekday` compara **cada produto consigo mesmo**: o preço de uma ida vira uma razão
  sobre a média daquele produto, e a razão é adimensional, então arroz e detergente entram na mesma
  média sem que o mais caro domine. Índice em base 100; 89 é 11% abaixo do preço de sempre.
- **Só entra produto comprado em mais de um DIA DA SEMANA diferente.** Um produto sempre comprado
  na segunda tem razão exatamente 1 por construção — não erra o resultado, mas empurra todo dia pra
  100 e apaga o sinal. Pelo mesmo motivo o dia com uma observação só é descartado: é anedota.
- **Sem base, o card diz o que falta e não aponta um dia.** Apontar a segunda porque foi a única com
  dado é pior que dizer "ainda não dá pra saber" — a pessoa mudaria a rotina de compras por causa de
  um número que não mediu nada. Cada motivo (`SEM_COMPRAS`, `SEM_PRODUTO_REPETIDO`, `POUCA_AMOSTRA`)
  vira uma frase diferente, porque a ação do outro lado é diferente.
- **A identidade é o produto CANÔNICO**, não a linha da nota: produto que o usuário já uniu precisa
  contar como um só, senão ele nunca aparece em dois dias diferentes — e são justamente os casos que
  a união existe pra resolver. Sai da mesma consulta do `summary`, que já carregava as compras com
  os itens, então o card não custa uma segunda ida ao banco.
- **Fica fora do recorte de mês**, pela mesma razão do card de variação logo abaixo.
- **"O que mais subiu de preço" fica fora do recorte de propósito.** Variação se mede entre compras
  do mesmo item, e dentro de um mês normalmente não há duas — filtrar esvaziaria o card.
- **O card do canto deixou de ser a contagem de produtos.** Um número de sempre ao lado de três do
  mês se lê como sendo do mês também; virou média por compra, que responde o mesmo período que os
  vizinhos. A contagem continua na tela de Produtos.
- **O extrato continua linha a linha.** `history` (uma entrada por linha da nota) e `priceSeries`
  (uma por ida) vão separados na resposta de propósito: a lista embaixo do gráfico tem que mostrar
  o que o mercado imprimiu, e o gráfico tem que mostrar o que a pessoa fez.
- **União é ponteiro, nunca exclusão.** `MarketProduct.canonicalId` (nullable, `SetNull`) aponta o
  absorvido pro canônico; a linha continua no banco com o nome que o mercado deu, pelo mesmo motivo
  que `MarketPurchaseItem.description` é guardado literal. Desfazer é limpar um campo.
- **A agregação é na leitura**, não reescrevendo o `productId` das compras. É isso que torna a
  união reversível de graça e mantém rastreável o que cada mercado chamou o produto.
- **O app sugere, nunca une sozinho** (`suggestProductMerges`). Vale a regra que já estava no
  `market-product-key.ts`: separar um produto em dois é um incômodo visível e corrigível; juntar
  dois diferentes estraga o histórico de preço sem ninguém perceber.
- **Embalagem diferente derruba a sugestão na hora**: "PAO BRIOCHE 520G" e "PAO BRIOCHE 300G" têm
  as mesmas palavras e não são o mesmo produto. Tamanho declarado só de um lado não é conflito.
- **Duas palavras em comum, no mínimo**, e a pontuação é por **continência** (quanto do nome mais
  curto cabe no outro) — é o que faz o mercado que escreve a marca inteira casar com o que escreve
  só o essencial. Uma palavra genérica em comum ("PAO FRANCES" vs "PAO BRIOCHE") vira uma lista de
  sugestões que ninguém lê.
- Sugestão dispensada fica no **localStorage**: dizer "esses dois são diferentes" é preferência de
  tela, não dado que valha tabela e migration.
- Limite conhecido: a comparação é de palavra inteira, então "RECHEADA" e "RECHEADO" não se
  encontram. Errar pro lado de não sugerir é o certo.

## Academia: o cronômetro é a peça central, e ele nunca conta

Módulo independente (`gym`), sem `imports` de outros. O fluxo que sustenta tudo é
**executar → registrar → descansar → avisar → próxima série**, e ele foi construído pra funcionar
com o celular na mão, de pé, sem sinal.

- **O cronômetro guarda um INSTANTE, nunca um contador.** Enquanto roda, o estado tem `endsAt`; o
  tempo restante é sempre `endsAt − agora`, calculado na hora de mostrar. Um `setInterval` que
  decrementa é suspenso quando a tela apaga ou o app vai pro segundo plano — quem conta assim volta
  de 20 segundos de bolso com 20 segundos a menos descontados, atrasando justamente quando a pessoa
  mais confia nele. O `setInterval` existe só pra **redesenhar**: se ele atrasar ou parar, o número
  continua certo assim que rodar de novo. Verificado com a aba escondida: 6s fora, volta finalizado.
- **A máquina de estados é pura e mora no frontend** (`gym/domain/rest-timer.ts`), porque o §39 do
  pedido é explícito: o descanso não pode depender do servidor. Isso obrigou a dar um runner de
  testes ao `apps/web` (**vitest**, `pnpm test`) — o resto do domain puro, que precisa do histórico,
  continua no backend com jest.
- **Pular e "Pronto" somem com o painel; chegar a zero sozinho NÃO.** O aviso é o que a pessoa está
  esperando, então ele fica na tela; já quem tocou em pular voltou pra série e um painel no caminho
  seria estorvo. Nos dois casos o registro é gravado antes de sumir.
- **O descanso registrado é tempo de RELÓGIO, incluindo a pausa.** Pausou e ficou 3 minutos
  conversando: descansou 3 minutos. É isso que a estatística precisa saber, não os 90s configurados.
- **Concluir a série JÁ começa o descanso.** Separar em dois toques significa que o segundo é
  esquecido no meio do treino.
- **A tela de execução é a LISTA de exercícios, com um aberto por vez** — não um exercício isolado
  com setas. Ver a lista inteira responde "quanto falta" sem navegar, e abrir o próximo é um toque.
  Cada série é um cartão com ▶ (inicia) → ⏹ (conclui e dispara o descanso) → ✓ (feita); quem não
  quer os dois toques liga **"execução automática das séries"**, e aí a seguinte já entra em
  execução sozinha ao sair do descanso.
- **O cronômetro diz o que vem depois dele** (`nextUp`): mais uma série do mesmo exercício, ou o
próximo exercício — e este último ganha destaque próprio, porque repetir série é rotina e trocar de
aparelho é uma decisão. O descanso é o único momento em que a pessoa está parada esperando, e é aí
que ela quer saber pra onde vai; sem isso, o aviso toca e ela precisa fechar o painel pra descobrir.
A busca olha **pra frente primeiro** e só depois volta pro que ficou pra trás: quem pulou um
exercício no começo não pode receber "acabou" com série pendente na lista.

**O descanso é um modal, não um painel embutido.** É o único momento do treino em que a pessoa não
  está fazendo mais nada, e ocupar a tela toda com o tempo é o que faz o número ser lido de longe,
  com o celular apoiado no banco.
- **O módulo não tem o olho de privacidade, e o volume não é mascarado.** O que aquele modo esconde é
dinheiro, e na Academia não há nenhum. Mascarar volume criaria uma armadilha: privacidade ligada em
outra tela deixaria o treino cheio de `•••••` sem nenhum botão à mão pra desligar.

**Volume é SEMPRE em quilos, nunca em toneladas.** Converter passava de "2.080 kg" pra "2,1 t" já
  na terceira série: o número perde a precisão exatamente na faixa em que ele vive e passa a parecer
  errado estando certo. Exercício de peso corporal tem volume 0 por definição (carga × repetições,
  com carga zero) — é correto, mesmo parecendo quebrado.

**A sessão vive no aparelho** (zustand persistido), e o servidor só a recebe pronta. Recarregar a
página no meio do treino mantém tudo; o treino inteiro roda offline e sobe sozinho depois. A subida
é **idempotente pelo `clientId`** gerado no aparelho — tentar de novo (rede que voltou, aba que
reapareceu, outra tela do módulo) nunca duplica. A fila é tentada no **layout**, não numa tela
específica: quem terminou offline pode abrir o histórico antes do início.

**Série não concluída não sobe.** Ela é uma intenção da ficha, não um acontecimento — contá-la faria
o "28 de 28 séries" mentir em todo treino interrompido.

**Primeira vez num exercício não é recorde.** Recorde é superar algo; um treino com oito exercícios
novos dispararia trinta e dois troféus e a palavra perderia o sentido no primeiro uso. Subir a carga
costuma bater peso, 1RM e volume de uma vez — todos ficam gravados, mas a tela de conclusão mostra
**um por exercício** (`headlineRecords`), senão uma conquista vira três linhas.

**O 1RM é congelado no recorde.** A fórmula (Epley/Brzycki/Lombardi) é escolha do usuário e as três
divergem conforme a faixa de repetições; trocar a preferência depois não pode reescrever um recorde
já comemorado. Uma repetição devolve a própria carga — extrapolar aí inventaria 3% que ninguém
levantou.

**O catálogo de exercícios é dado, não migration.** 151 exercícios com `userId = null` (o mesmo
padrão da carteira principal dos investimentos: global, não duplicado por usuário), semeados por
`pnpm run seed:gym`, idempotente pelo `slug`. Acrescentar exercício é editar
`exercise-catalog.ts` e rodar de novo. As instruções vêm de modelos por **padrão de movimento**
(empurrar horizontal, dobradiça de quadril, puxar vertical...), porque é o padrão que define a
execução — 151 textos à mão seriam variações irrelevantes da mesma orientação.

**Exercício e ficha são ARQUIVADOS, nunca apagados**: estão no histórico de séries, e apagar levaria
o passado junto. Já apagar uma **sessão** apaga os recordes dela — o schema diz `SetNull`, o que
sozinho deixaria um troféu apontando pra um treino inexistente; recorde é a prova de que algo
aconteceu, e sem o treino não há prova.

**A carga vem preenchida do último treino** (`prefillSets`). Sem histórico, usa o **piso** da faixa
de repetições: preencher com o topo faria a série nascer marcada como fracasso quando a pessoa
fizesse o que era esperado.

**O "treino de hoje" é o SEGUINTE ao último que foi feito**, na ordem da lista (`pickNextWorkout`):
fez o A, o próximo é o B. É o que a pessoa espera de um ABCD, e é previsível sem consultar data
nenhuma. A regra anterior era "o que está há mais tempo parado" — ela acerta enquanto o rodízio é
perfeito e erra justamente quando não é (repetir uma ficha, pular uma, treinar duas vezes no mesmo
dia embaralham as datas). Ela continua como plano B: quem nunca treinou nada começa pelo primeiro
da lista, e ficha arquivada depois de treinada não define "a próxima".

**A execução automática das séries vem LIGADA**, como preferência do perfil (`autoAdvanceSets`). É o
caminho de menos toques no meio do treino; quem prefere o controle manual desliga uma vez no Perfil
em vez de desligar em cada exercício de cada ficha — e dentro do treino ainda dá pra mudar exercício
por exercício.

**Terminar todas as séries de um exercício abre o próximo pendente.** Quem acabou o supino não
deveria precisar fechar o card e procurar o seguinte enquanto o descanso corre — o descanso é
justamente o momento em que ninguém quer estar navegando. No último exercício a lista fica onde
está: avançar ali jogaria a tela pro começo bem na hora de finalizar.

**O calendário mostra a sigla do treino dentro da célula** ("Treino A" → "A", dois no mesmo dia →
"A+B"), e tocar no dia abre o detalhe com nome, volume e duração. Só o `title` do HTML não servia:
no celular não existe passar o mouse, e sem a sigla o calendário dizia "treinou" mas nunca "treinou
o quê".

**O modo treino é escuro sempre**, independente do tema do app, e esconde cabeçalho, barra inferior
e o botão do assistente. Não é estética: é a única tela usada no meio de uma série, e alto contraste
com alvos de toque grandes ali é funcional.

**A semana começa no DOMINGO** (`startOfWeek`), como o calendário brasileiro e a tirinha Dom→Sáb da
Home. O corte do desenho e o da contagem têm que ser o mesmo: com a semana começando na segunda e a
tirinha no domingo, um treino de domingo apareceria marcado numa semana e somado na outra — a tela
se contradiria um dia por semana.

**O calendário desenha o mês inteiro, não só os treinos.** A pergunta que ele responde é sobre
frequência, e nela o dia vazio vale tanto quanto o cheio: marcar só os treinos vira uma constelação
solta e esconde justamente os buracos. Dia futuro fica esmaecido em vez de vazio — ainda não
aconteceu, então não é falta.

**Lima é ação, esmeralda é feito.** A cor do módulo é o **verde lima** (botão, destaque, dia
treinado); o **esmeralda** fica reservado pro que está concluído — série marcada, exercício
terminado, fim do descanso. Com tudo da mesma cor, "vou fazer" e "já fiz" ficam indistinguíveis
justamente na tela em que a diferença importa. Sobre o lima cheio o texto é **escuro**
(`neutral-900`), nunca branco: lima é uma cor clara e branco sobre ela dá menos de 2:1.

**A consistência ignora a semana corrente.** Na segunda-feira ela estaria sempre em 0/5 e o
indicador despencaria toda semana por um motivo que não é o desempenho de ninguém.

**Progresso de meta é medido a partir da PARTIDA, não do zero.** Quem sai de 80 kg mirando 100 e
está em 82,5 fez 12,5% do caminho, não 82,5% — contar do zero mostraria uma barra quase cheia no
primeiro dia e quase parada por meses.

**O desenho do boneco não é nosso, e isso foi decisão.** Os polígonos vêm do pacote
`react-body-highlighter` (MIT, Copyright (c) 2020 GV79) e estão **vendorizados** em `bodyPaths.ts`,
gerados por `node scripts/gen-body-paths.js`. A primeira versão da tela usava formas desenhadas à
mão e nunca passou de blocos arredondados: proporção humana e separação muscular de verdade
(peitoral, oblíquos, gomos do abdômen, dorsal, sóleo) é trabalho de ilustração, não de ajuste de
coordenada. O dado é copiado em vez de importado porque o pacote **não exporta os polígonos** — só o
componente dele, que pinta por frequência de exercício; usá-lo custaria os dois modos, o contorno do
selecionado e o rótulo acessível por região. Fica o desenho deles com o comportamento nosso, e sem
dependência em tempo de execução. **3D foi descartado**: `three.js` sozinho é ~600 KB comprimidos
(o bundle inteiro tem 2,1 MB) e o modelo com malhas nomeadas por músculo custa vários MB — caro
demais numa VPS de 1 GB pra uma tela que se olha de relance, e a resposta seria a mesma.

**O corpo em repouso usa `rgb(var(--text-muted) / 0.28)`, não `surface-2`.** O token de superfície é
quase branco no tema claro, e a base do boneco (cabeça, joelhos) sumia dentro do cartão — o corpo
aparecia sem cabeça. Pelo mesmo motivo o cartão do boneco tem fundo neutro em vez do lima do módulo.
**O token é `--text-muted`; `--muted` não existe** e cai pra preto em silêncio, que foi como a
cabeça apareceu preta durante o ajuste.

**O mapa muscular pinta SÉRIES, nunca quilos.** É a decisão que faz o boneco (aba Corpo, em
`/academia/progresso`) dizer a verdade. Volume em kg não é comparável entre músculos: um leg press
soma 10.000 kg no mesmo esforço em que uma elevação lateral soma 800, então a perna ficaria
permanentemente vermelha e o ombro permanentemente verde — o desenho mostraria a anatomia dos
exercícios, não o treino. Conferido nos dados reais: glúteos com 65.665 kg e 22 séries contra ombros
com 44.297 kg e 78. Série é a unidade comparável, e é a que a literatura usa. **Os quilos continuam
na resposta e aparecem no detalhe**, que é o único lugar onde significam algo: um músculo comparado
com ele mesmo ao longo das semanas.

**Músculo secundário conta meia série.** Supino é peito, mas também é tríceps e ombro. Só o primário
faria o mapa afirmar que a pessoa nunca treina tríceps quando ela treina em todo empurrar; inteiro
faria uma série de supino valer o mesmo pros dois, o que também não é verdade.

**As faixas de intensidade vêm de fora, não da própria pessoa.** ~10 séries semanais por grupo como
piso útil e 20+ como volume alto, escalado pela janela escolhida. Uma escala relativa aos outros
músculos faria quem treina pouco ver vermelho por treinar menos ainda o resto.

**O último treino ignora a janela; a carga não.** "Faz quanto tempo que não treino isso" é a
pergunta do modo Atenção, e limitá-la aos 7 dias escolhidos responderia sempre "faz mais de 7" —
músculo parado há três meses ficaria igual ao nunca treinado. Por isso a janela some da tela nesse
modo, e um segundo `findMany` (enxuto, só pra quem ficou sem data) vai buscar mais fundo.

**São dois modos, com respostas invertidas de propósito.** *Carga* responde "onde peguei pesado" — o
não treinado fica apagado. *Atenção* responde o oposto, "o que estou esquecendo" — aí quem acende é
o abandonado. Mesmo boneco; o seletor diz qual escala está no ar, e a legenda muda junto, porque
"vermelho" quer dizer coisas opostas nos dois.

**O corpo não tem silhueta separada — ele é a soma das formas**, e a base neutra usa a mesma cor do
músculo não treinado. É o que permite "não treinou" sumir dentro do corpo em vez de virar um buraco
na figura.

**Cada grupo tem área de toque própria, invisível, e as áreas não se sobrepõem.** O alvo é a região,
não o desenho: o desenho tem vãos, e o centro do peito — onde o dedo pousa — caía entre os dois
peitorais e acertava o tronco. É também o que torna alcançáveis no celular o antebraço e a
panturrilha.

**A cor nunca é a única informação.** Verde e vermelho são o par que some no daltonismo mais comum,
então o mesmo dado está escrito na lista abaixo do boneco, no `aria-label` de cada grupo e no painel
de detalhe. A lista também alcança o músculo pequeno sem depender da mira.

**A foto do exercício mora numa tabela SUA, não na coluna do exercício.** O catálogo é global
(`userId = null`, o mesmo padrão da carteira principal dos investimentos), então gravar a foto na
linha dele seria escrever no exercício de todo mundo — e `getOwned`, com razão, proíbe editar o
catálogo. `GymExercisePhoto` (única por usuário×exercício, mesmo padrão do favorito) resolve os
dois: a leitura funde a sua foto por cima da do catálogo em `list`, `findOne` e no prefill do
treino, e `hasUserPhoto` diz se dá pra remover — sem ele a tela ofereceria "remover a foto" pra uma
imagem que não é sua. Pôr foto usa `getVisible`, não `getOwned`: ilustrar um exercício do catálogo é
legítimo, *editá-lo* não. Guardada como data URL no registro, pelo mesmo motivo da foto do bem
financiado — ~25 KB depois do corte no cliente não valem storage e rota estática — e revalidada no
servidor por `parseAssetPhoto`, porque chamada direta na API não passa pelo canvas.

**Exercício próprio é editável e excluível; o do catálogo, nunca.** A tela de detalhe só mostra
Editar/Excluir quando `custom` — e o botão de foto aparece nos dois casos, que é justamente a
diferença entre "seu exercício" e "seu jeito de ver o exercício".

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
