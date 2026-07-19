# Arquitetura — Sistema de Gerenciamento de Parcelas de Cartão de Crédito

## 1. Visão geral

Monorepo com dois pacotes:

```
apps/api   -> Backend REST (NestJS + TypeScript + Prisma + PostgreSQL)
apps/web   -> Frontend SPA (React + TypeScript + Vite + Tailwind)
```

Gerenciado com **pnpm workspaces**. Escolhas de stack e por quê:

| Camada | Tecnologia | Motivo |
|---|---|---|
| API | NestJS | Já impõe Clean Architecture (Modules/Controllers/Services/Providers), DI nativa, Guards/Interceptors/Pipes cobrem Middlewares/Policies/Validation pedidos no requisito. |
| ORM | Prisma | Migrations versionadas, schema fortemente tipado, índices/constraints declarativos, client type-safe (evita SQL injection por padrão). |
| Banco | PostgreSQL | Transações ACID, constraints reais, adequado para dado financeiro. |
| Auth | JWT (access token) + bcrypt | Stateless, simples de escalar horizontalmente. |
| Frontend | React + Vite + TS | Build rápido, DX moderna. |
| Estilo | Tailwind CSS + design tokens (CSS vars) | Consistência visual, dark/light mode barato, espaço em branco controlado. |
| Data fetching | TanStack Query | Cache, refetch, otimistic updates -> UX "tempo real" sem websockets. |
| Estado local | Zustand | Estado de UI (tema, sidebar, command palette) sem boilerplate. |
| Gráficos | Recharts | Composição declarativa, fácil customizar para o design system. |
| Animações | Framer Motion | Transições e microinterações suaves. |

## 2. Clean Architecture no backend

Cada módulo de domínio (`cards`, `purchases`, `installments`, ...) segue 4 camadas:

```
domain/         entidades de negócio puras, value objects, regras invariantes
application/    use-cases / services, orquestram domain + repositórios, DTOs, validação
infrastructure/ repositórios concretos (Prisma), mapeamento entidade <-> persistência
interface/      controllers HTTP, DTOs de request/response, guards, policies
```

Regra de dependência: `interface -> application -> domain`, `infrastructure -> domain`.
Controllers nunca falam com o Prisma diretamente; sempre passam por um Service (use-case),
que depende de uma **interface** de repositório (porta), implementada na infra. Isso permite
trocar Postgres/Prisma por outro storage sem tocar regra de negócio, e testar services com
repositórios em memória.

Transversais:
- `common/guards` — `JwtAuthGuard`, `OwnershipGuard` (policy: recurso pertence ao usuário logado)
- `common/pipes` — `ZodValidationPipe` (valida DTOs de entrada)
- `common/interceptors` — `TransformInterceptor` (envelope de resposta), `AuditInterceptor`
- `common/filters` — `AllExceptionsFilter` (erros padronizados, nunca vaza stack em prod)
- `@nestjs/throttler` — rate limiting global + por rota sensível (login)

## 3. Modelagem de dados (Prisma)

Entidades principais (ver `apps/api/prisma/schema.prisma`):

- **User** — conta, preferências (tema, moeda), 1:N com todo o resto.
- **Card** — cartão de crédito (nome, banco, bandeira, cor, limite, final, fechamento, vencimento, ativo).
- **Category** — categorias (globais padrão + custom por usuário), ícone/cor.
- **Purchase** — compra "guarda-chuva": valor total, data, cartão, categoria, parcelas, entrada, recorrência, tags, favorito, soft-delete (lixeira).
- **Installment** — cada parcela gerada (número, valor, mês/ano de competência, vencimento, status).
- **Payment** — registro de baixa de uma parcela (quando marcada como paga: data, valor pago, método).
- **Notification** — alertas gerados (fatura próxima, limite alto, atraso, aumento de gasto).
- **Setting** — preferências por usuário (tema, moeda, alertas ativos, dashboard customizável).
- **AuditLog** — histórico de alterações (o que pediu "histórico de alteração").
- **Attachment** — anexo (nota fiscal) vinculado à compra — armazenado como URL/nome (upload de binário fica fora do escopo deste MVP, ver Roadmap).

Constraints/índices relevantes:
- `Installment.amount >= 0`, `Purchase.totalAmount > 0`, `Purchase.installmentsCount >= 1` (check constraints via Prisma `@db` + validação de aplicação, já que Prisma não expõe `CHECK` nativamente em todas versões — reforçado na camada de aplicação e em SQL migration adicional).
- `Card.closingDay`/`dueDay` entre 1 e 28 (evita bug de mês com 28/30/31 dias).
- Índices em `Installment(userId, referenceMonth, referenceYear)`, `Installment(status)`, `Purchase(userId, purchaseDate)`, `Purchase(deletedAt)` para paginação/filtros rápidos sem N+1 (sempre `include` explícito, nunca lazy loop).
- `onDelete: Cascade` de Card -> Purchase é bloqueado pela regra de negócio (não pode excluir cartão com compras); a FK usa `Restrict`.

## 4. Motor de geração de parcelas (regra central do produto)

`InstallmentGeneratorService` (domain service puro, testável sem DB):

1. Recebe: `purchaseDate`, `card.closingDay`, `installmentsCount`, `totalAmount`, `downPayment?`.
2. Determina a **fatura de referência**:
   - Se `purchaseDate.day <= closingDay` → a compra entra na fatura do mês corrente.
   - Se `purchaseDate.day > closingDay` → entra na fatura do mês seguinte.
   - (Fechamento em dias que não existem em todos os meses, ex. 30/31, é normalizado para o último dia do mês.)
3. Se houver entrada (`downPayment`), ela é registrada como pagamento imediato fora do parcelamento e o valor restante é dividido pelo `installmentsCount`.
4. Divide `totalAmount` (ou `totalAmount - downPayment`) em N parcelas iguais, ajustando **o resto dos centavos na última parcela** (arredondamento bancário) para que a soma seja sempre idêntica ao valor total — regra de negócio explícita: "valor diferente da soma das parcelas nunca é permitido".
5. Gera N registros `Installment`, cada um com `dueDate` = dia de vencimento do cartão no mês de competência correspondente, `referenceMonth/Year` incrementando a partir da fatura de referência.
6. Compras à vista são o caso `installmentsCount = 1` (mesmo motor, sem ramificação especial).

Esse serviço é 100% unitário (sem I/O), o que permite testes determinísticos das regras de fechamento.

## 5. Status de parcela e efeitos colaterais

`Installment.status ∈ { PENDING, PAID, LATE, CANCELLED }`.

- Um **job idempotente** (`InstallmentStatusService.refreshLateStatuses`, chamado no boot de cada request de dashboard/listagem — sem necessidade de cron externo no MVP) marca como `LATE` toda parcela `PENDING` cuja `dueDate < hoje`.
- Marcar como `PAID` cria um `Payment` e é a única transição que grava valor/efetivo pago (permite pagar valor diferente do previsto, ex. juros).
- Cancelar uma parcela retira-a dos agregados de "comprometido" mas mantém histórico (nunca é hard-delete).
- Todas as mutações relevantes (criar compra, editar, pagar, cancelar, excluir) geram uma linha em `AuditLog`.

## 6. Endpoints (REST, prefixo `/api/v1`)

```
POST   /auth/register            /auth/login          GET /auth/me
GET    /cards        POST /cards        GET/PATCH/DELETE /cards/:id
GET    /categories    POST /categories   PATCH/DELETE /categories/:id
GET    /purchases (filtros+paginação+busca)   POST /purchases   GET/PATCH/DELETE /purchases/:id
POST   /purchases/:id/duplicate     POST /purchases/:id/restore   (lixeira)
GET    /installments (filtros)   PATCH /installments/:id/status   POST /installments/:id/pay
GET    /dashboard/summary        GET /dashboard/spending-evolution   GET /dashboard/by-category
GET    /calendar/:year           GET /calendar/:year/:month
GET    /timeline
GET    /statistics
GET    /search?q=
GET    /notifications             PATCH /notifications/:id/read
GET    /settings                  PATCH /settings
GET    /export/installments.csv
```

Todas protegidas por `JwtAuthGuard` (exceto `/auth/*`), respostas paginadas usam `?page&pageSize`,
filtros usam querystring tipada e validada via DTO + `class-validator`.

## 7. Frontend — estrutura

```
apps/web/src
  app/            rotas, layout, providers (QueryClient, Theme, Toaster)
  pages/          Dashboard, Cards, Purchases, Calendar, Timeline, Categories, Statistics, Settings, Auth
  components/ui/  design system (Button, Card, Modal, Input, Select, Tabs, Badge, Skeleton, EmptyState, Toast)
  components/     componentes de domínio (CreditCardVisual, InstallmentTable, SpendingChart, CategoryChart, CommandPalette)
  features/       hooks por domínio (useCards, usePurchases, useDashboard...) — encapsulam TanStack Query
  lib/            api client (fetch wrapper com auth), formatters (moeda/data), utils
  store/          Zustand (tema, sidebar, command palette)
```

Design tokens em `index.css` (CSS variables) + Tailwind `darkMode: 'class'`. Paleta neutra com um
accent roxo/azul (inspirado Nubank/Linear), cards com `rounded-2xl`, sombras suaves (`shadow-sm`/`shadow-lg` só em hover),
tipografia `Inter`.

## 8. Segurança

- Senhas com `bcrypt` (custo 12). JWT assinado (HS256) com expiração curta + refresh simples.
- Todas as entradas validadas com `class-validator`/DTO (frontend replica validação com `zod` antes do submit).
- Prisma parametriza queries → sem SQL Injection. Sanitização de strings livres (observações, nome) contra XSS ao renderizar (React escapa por padrão; nunca usamos `dangerouslySetInnerHTML` com dado do usuário).
- `helmet` para headers HTTP, CORS restrito à origem do frontend, `@nestjs/throttler` para rate limit (login: 5 tentativas/min).
- Toda query de listagem/detalhe filtra por `userId` do token — isolamento multi-tenant a nível de repositório (nunca confia em `id` da URL sozinho).
- CSRF: API é *token-based* (Authorization header, sem cookies de sessão), o que já neutraliza CSRF clássico; documentado no README.

## 9. Roadmap / itens reduzidos neste MVP

Os itens abaixo foram desenhados no schema/API mas implementados de forma simplificada por escopo de tempo:
- **Anexos**: hoje é URL/nome do arquivo (sem upload binário/S3).
- **Exportação**: CSV implementado; Excel/PDF ficam como próximos passos (mesma camada de serviço, troca de renderer).
- **Importação CSV**: endpoint de leitura pronto no roadmap, não incluído nesta primeira entrega.
- **Notificações**: geradas por regra síncrona ao consultar (sem push/e-mail).
