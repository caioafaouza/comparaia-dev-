# Compara IA (Frontend + API)

Node.js + React SaaS stack with Postgres, Redis and MinIO. Backend runs on Express (multi-tenant by schema), frontend on Vite/React.

## Requisitos

- Node 20.11+ e npm 10+
- Postgres 16, Redis 7, MinIO (ou S3 compatível)

## Configuração rápida

1. Copie `.env.example` para `.env` e preencha os valores (Postgres, Redis, MinIO, JWT, CORS).
   - Opcional: defina `MASTER_ADMIN_EMAIL` e `MASTER_ADMIN_PASSWORD` para criar o admin na seed.
2. Instale dependências (workspaces frontend + backend):

   ```bash
   npm install
   ```

3. Suba as dependências locais via Docker (opcional, recomendado):

   ```bash
   docker compose up -d postgres redis minio
   ```

4. Rode migrações e seeds do master:

   ```bash
   npm run migrate:master --workspace server
   npm run seed:master --workspace server
   ```

   Para migrar um tenant específico:

   ```bash
   TENANT_SCHEMA=tenant_demo npm run migrate:tenant --workspace server
   ```

5. Desenvolvimento (frontend + API em paralelo):

   ```bash
   npm run dev
   ```

6. Build + start (serve API + SPA estática):

   ```bash
   npm run build
   npm start
   ```

## Endpoints de health

- `GET /api/health` (app)
- `GET /api/health/db`
- `GET /api/health/redis`
- `GET /api/health/storage`

## Multi-tenant e auth

- Header obrigatório para rotas protegidas: `x-tenant-id`
- Login em contexto de tenant: `POST /api/auth/login`
- Rotas protegidas: `/jobs`, `/dashboard/metrics`, `/products/:id/intelligence`, `/ai/*`
- Admin/master: prefixo `/api/admin/*` sempre usa o schema master.

## Docker (stack completa)

```bash
docker compose up -d
# aplicar migrações dentro do app
docker compose exec app npm run migrate:master --workspace server
```

## Scripts úteis

- `npm run typecheck` – checagem TS do frontend
- `npm run lint` – ESLint (front + back)
- `npm --workspace server run dev|start|lint|migrate:master|migrate:tenant|seed:master`

## Testes (Jest + Supertest)

- Rodar local (requer Postgres/Redis/MinIO de teste):
  - `npm --workspace server test` (Roda todos os testes)
  - `npm --workspace server test tests/admin_overview.test.js` (Testes de Overview)
  - `npm --workspace server test tests/admin_tenants.test.js` (Testes de Tenants)
  - `npm --workspace server test tests/admin_users.test.js` (Testes de Usuários Globais)
- Lint backend: `npm --workspace server run lint`
- Build SPA: `npm run build:client`

### Ambiente de teste sugerido

```env
NODE_ENV=test
ALLOW_NON_LOCAL_TEST_DB=true
DB_HOST=localhost
DB_PORT=5432
DB_USER=postgres
DB_PASSWORD=postgres
DB_NAME=comparaia_test
DB_SSL=false
REDIS_HOST=localhost
REDIS_PORT=6379
MINIO_ENDPOINT=localhost
MINIO_PORT=9000
MINIO_USE_SSL=false
MINIO_ACCESS_KEY=admin
MINIO_SECRET_KEY=password123
MINIO_BUCKET=comparaia
JWT_SECRET=test-secret-please-change
MASTER_ADMIN_EMAIL=admin@seudominio.com.br
MASTER_ADMIN_PASSWORD=change_this_password_123
```

## Notas de segurança

- Senhas armazenadas com bcrypt.
- JWT com expiração configurável.
- Rate limit aplicado em login, register-tenant e endpoints de IA.
- CORS controlado por `CORS_ORIGINS`.
