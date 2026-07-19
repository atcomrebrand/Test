# Parcelas — Gestão de Cartão de Crédito

Sistema completo de gerenciamento de parcelas de cartão de crédito: dashboard em tempo real,
calendário financeiro, linha do tempo, controle de status de parcelas, categorias, busca e
filtros avançados, alertas inteligentes e estatísticas.

Veja a arquitetura completa e as decisões de design em [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md).

## Stack

- **API**: NestJS + TypeScript + Prisma + PostgreSQL (Clean Architecture)
- **Web**: React + TypeScript + Vite + Tailwind CSS + TanStack Query + Recharts + Framer Motion

## Rodando localmente

### 1. Banco de dados

```bash
# Postgres precisa estar rodando e ter um banco/usuário criado, ex.:
createuser cc_app --pwprompt --createdb
createdb creditcard_dev -O cc_app
```

### 2. Backend

```bash
cd apps/api
cp .env.example .env   # ajuste DATABASE_URL se necessário
pnpm install
pnpm prisma:generate
pnpm prisma:migrate     # cria as tabelas
pnpm prisma:seed        # popular com dados de demonstração
pnpm start:dev           # http://localhost:3333/api/v1
```

Login de demonstração criado pelo seed: `mauroo.galvaoo@gmail.com` / `demo1234`.

### 3. Frontend

```bash
cd apps/web
cp .env.example .env
pnpm install
pnpm dev                 # http://localhost:5173
```

### 4. Testes

```bash
cd apps/api
pnpm test                # testes unitários do motor de parcelamento (regras de fechamento)
```

## Estrutura do monorepo

```
apps/api     API REST (Clean Architecture: domain / application / infrastructure / interface)
apps/web     SPA (design system próprio, dark/light mode, command palette, gráficos)
docs/        Documentação de arquitetura e decisões de design
```
