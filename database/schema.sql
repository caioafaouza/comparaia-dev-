-- ==============================================================
-- COMPARA IA - CANONICAL SCHEMA (MASTER + TENANT TEMPLATE)
-- Derived from current migrations and runtime expectations.
-- Use this file for clean production bootstrap.
-- ==============================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- --------------------------------------------------------------
-- MASTER (public schema)
-- --------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.tenants (
  id uuid PRIMARY KEY,
  name text NOT NULL,
  slug text UNIQUE NOT NULL,
  db_host text NOT NULL,
  db_name text UNIQUE NOT NULL,
  db_user text NOT NULL,
  db_password text NOT NULL,
  status text NOT NULL DEFAULT 'ACTIVE',
  plan text NOT NULL DEFAULT 'STARTER',
  cnpj text,
  phone text,
  sector text,
  purchase_volume text,
  custom_domain text,
  brand_color text,
  logo_url text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.token_plans (
  id text PRIMARY KEY,
  name text NOT NULL,
  slug text UNIQUE,
  price numeric(10,2) NOT NULL DEFAULT 0,
  currency text DEFAULT 'BRL',
  active boolean NOT NULL DEFAULT true,
  limits json,
  features json,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.users (
  id uuid PRIMARY KEY,
  name text NOT NULL,
  email text NOT NULL UNIQUE,
  password text NOT NULL,
  role text DEFAULT 'PLATFORM_ADMIN',
  status text DEFAULT 'ACTIVE',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.user_tenants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES public.users(id) ON DELETE CASCADE,
  tenant_id uuid REFERENCES public.tenants(id) ON DELETE CASCADE,
  role text DEFAULT 'MEMBER',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE (user_id, tenant_id)
);

CREATE TABLE IF NOT EXISTS public.system_config (
  key text PRIMARY KEY,
  value json NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.products (
  id uuid PRIMARY KEY,
  name text NOT NULL,
  category text,
  initial_cost numeric(15,2),
  stock_quantity integer DEFAULT 0,
  min_stock integer DEFAULT 5,
  technical_specs json,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.comparison_jobs (
  id uuid PRIMARY KEY,
  user_id uuid REFERENCES public.users(id),
  reference_name text NOT NULL,
  status text DEFAULT 'QUEUED',
  candidate_count integer DEFAULT 0,
  cost numeric(10,2) DEFAULT 0,
  files json,
  result json,
  error_message text,
  created_at timestamptz DEFAULT now(),
  completed_at timestamptz
);

CREATE TABLE IF NOT EXISTS public.stock_movements (
  id serial PRIMARY KEY,
  product_id uuid REFERENCES public.products(id),
  type text NOT NULL,
  quantity integer NOT NULL,
  unit_cost numeric(15,2),
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.ai_request_logs (
  id text PRIMARY KEY,
  tenant_id text,
  user_id text,
  provider text NOT NULL,
  model text NOT NULL,
  context text NOT NULL DEFAULT 'unknown',
  tokens_in integer NOT NULL DEFAULT 0,
  tokens_out integer NOT NULL DEFAULT 0,
  latency_ms integer NOT NULL DEFAULT 0,
  success boolean NOT NULL DEFAULT true,
  error_message text,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.token_packages (
  id text PRIMARY KEY,
  name text NOT NULL,
  tokens integer NOT NULL DEFAULT 0,
  price numeric(12,2) NOT NULL DEFAULT 0,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.token_transactions (
  id uuid PRIMARY KEY,
  tenant_id uuid REFERENCES public.tenants(id),
  amount numeric(14,2) NOT NULL,
  type text NOT NULL DEFAULT 'USAGE',
  description text,
  metadata json,
  reference_id text,
  status text DEFAULT 'CONFIRMED',
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.tenant_api_keys (
  id text PRIMARY KEY,
  tenant_id text NOT NULL,
  name text NOT NULL,
  key_prefix text NOT NULL UNIQUE,
  key_hash text NOT NULL UNIQUE,
  status text NOT NULL DEFAULT 'ACTIVE',
  created_at timestamptz DEFAULT now(),
  revoked_at timestamptz
);

CREATE TABLE IF NOT EXISTS public.billing_failures (
  id text PRIMARY KEY,
  tenant_id text NOT NULL,
  amount numeric(14,2) NOT NULL DEFAULT 0,
  reason text,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.api_gateway_config (
  id serial PRIMARY KEY,
  enabled boolean NOT NULL DEFAULT true,
  api_version text NOT NULL DEFAULT 'v1',
  global_rate_limit integer NOT NULL DEFAULT 1200,
  timeout_ms integer NOT NULL DEFAULT 15000,
  cors_origins text,
  enable_logging boolean NOT NULL DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.smtp_config (
  id serial PRIMARY KEY,
  host text,
  port integer,
  user text,
  pass text,
  secure boolean NOT NULL DEFAULT false,
  from_email text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.crm_leads (
  id text PRIMARY KEY,
  company_name text NOT NULL,
  contact_name text NOT NULL,
  email text NOT NULL,
  status text NOT NULL DEFAULT 'NEW',
  value numeric(14,2) NOT NULL DEFAULT 0,
  probability numeric(5,2) NOT NULL DEFAULT 0,
  notes text,
  interactions text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.system_api_keys (
  id text PRIMARY KEY,
  name text NOT NULL,
  key_prefix text NOT NULL UNIQUE,
  key_hash text NOT NULL UNIQUE,
  role text NOT NULL DEFAULT 'READ_ONLY',
  status text NOT NULL DEFAULT 'ACTIVE',
  created_at timestamptz DEFAULT now(),
  revoked_at timestamptz
);

CREATE TABLE IF NOT EXISTS public.webhooks (
  id text PRIMARY KEY,
  name text NOT NULL,
  url text NOT NULL,
  secret text,
  events text,
  active boolean NOT NULL DEFAULT true,
  last_status text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.webhook_logs (
  id text PRIMARY KEY,
  webhook_id text NOT NULL,
  event text NOT NULL,
  "timestamp" timestamptz DEFAULT now(),
  status_code integer NOT NULL DEFAULT 0,
  latency integer NOT NULL DEFAULT 0,
  payload_preview text
);

CREATE TABLE IF NOT EXISTS public.payment_gateways (
  provider text PRIMARY KEY,
  name text NOT NULL,
  active boolean NOT NULL DEFAULT false,
  is_default boolean NOT NULL DEFAULT false,
  credentials text,
  custom_instructions text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.wallet (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  balance numeric(15,2) NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE (tenant_id)
);

CREATE TABLE IF NOT EXISTS public.billing_orders (
  id uuid PRIMARY KEY,
  tenant_id uuid NOT NULL,
  user_id uuid NOT NULL,
  order_type text NOT NULL,
  item_id text NOT NULL,
  amount numeric(14,2) NOT NULL DEFAULT 0,
  currency text DEFAULT 'BRL',
  status text NOT NULL DEFAULT 'CREATED',
  provider text NOT NULL DEFAULT 'MERCADO_PAGO',
  idempotency_key text NOT NULL UNIQUE,
  external_reference text,
  preference_id text,
  payment_id text,
  init_point text,
  sandbox_init_point text,
  metadata jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.billing_events (
  id uuid PRIMARY KEY,
  provider text NOT NULL,
  event_id text NOT NULL,
  event_type text,
  resource_id text,
  payload jsonb,
  signature_valid boolean DEFAULT false,
  status text NOT NULL DEFAULT 'RECEIVED',
  received_at timestamptz DEFAULT now(),
  processed_at timestamptz,
  UNIQUE (provider, event_id)
);

CREATE TABLE IF NOT EXISTS public.password_reset_codes (
  id uuid PRIMARY KEY,
  email varchar(255) NOT NULL,
  code_hash varchar(128) NOT NULL,
  attempts integer NOT NULL DEFAULT 0,
  expires_at timestamptz NOT NULL,
  used_at timestamptz NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Master indexes/hardening
CREATE INDEX IF NOT EXISTS idx_tenants_slug ON public.tenants(slug);
CREATE INDEX IF NOT EXISTS idx_tenants_status ON public.tenants(status);
CREATE INDEX IF NOT EXISTS idx_products_category ON public.products(category);
CREATE INDEX IF NOT EXISTS idx_comp_jobs_status ON public.comparison_jobs(status);
CREATE INDEX IF NOT EXISTS idx_comp_jobs_created_at ON public.comparison_jobs(created_at);
CREATE INDEX IF NOT EXISTS ai_request_logs_tenant_idx ON public.ai_request_logs(tenant_id);
CREATE INDEX IF NOT EXISTS ai_request_logs_created_idx ON public.ai_request_logs(created_at);
CREATE INDEX IF NOT EXISTS token_transactions_tenant_idx ON public.token_transactions(tenant_id);
CREATE INDEX IF NOT EXISTS token_transactions_reference_idx ON public.token_transactions(reference_id);
CREATE INDEX IF NOT EXISTS tenant_api_keys_tenant_idx ON public.tenant_api_keys(tenant_id);
CREATE INDEX IF NOT EXISTS billing_failures_tenant_idx ON public.billing_failures(tenant_id);
CREATE INDEX IF NOT EXISTS billing_orders_tenant_idx ON public.billing_orders(tenant_id);
CREATE INDEX IF NOT EXISTS billing_orders_user_idx ON public.billing_orders(user_id);
CREATE INDEX IF NOT EXISTS billing_orders_status_idx ON public.billing_orders(status);
CREATE INDEX IF NOT EXISTS billing_orders_external_reference_idx ON public.billing_orders(external_reference);
CREATE INDEX IF NOT EXISTS billing_events_provider_idx ON public.billing_events(provider);
CREATE INDEX IF NOT EXISTS password_reset_codes_email_idx ON public.password_reset_codes(lower(email));
CREATE INDEX IF NOT EXISTS password_reset_codes_expires_idx ON public.password_reset_codes(expires_at);
CREATE UNIQUE INDEX IF NOT EXISTS master_users_email_lower_uniq ON public.users(lower(email));
CREATE UNIQUE INDEX IF NOT EXISTS tenants_cnpj_digits_uniq
  ON public.tenants((regexp_replace(cnpj, '\D', '', 'g')))
  WHERE cnpj IS NOT NULL AND regexp_replace(cnpj, '\D', '', 'g') <> '';

-- --------------------------------------------------------------
-- TENANT TEMPLATE (replace :schema_name before applying)
-- --------------------------------------------------------------

CREATE SCHEMA IF NOT EXISTS :schema_name AUTHORIZATION CURRENT_USER;
SET search_path TO :schema_name, public;

CREATE TABLE IF NOT EXISTS :schema_name.users (
  id uuid PRIMARY KEY,
  name text NOT NULL,
  email text NOT NULL UNIQUE,
  password text NOT NULL,
  role text DEFAULT 'MEMBER',
  status text DEFAULT 'ACTIVE',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS :schema_name.products (
  id uuid PRIMARY KEY,
  name text NOT NULL,
  category text,
  initial_cost numeric(15,2),
  stock_quantity integer DEFAULT 0,
  min_stock integer DEFAULT 5,
  technical_specs json,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS :schema_name.comparison_jobs (
  id uuid PRIMARY KEY,
  user_id uuid REFERENCES :schema_name.users(id),
  reference_name text NOT NULL,
  status text DEFAULT 'QUEUED',
  candidate_count integer DEFAULT 0,
  cost numeric(10,2) DEFAULT 0,
  type text DEFAULT 'COMPARE_DOCS',
  started_at timestamptz NULL,
  completed_at timestamptz NULL,
  error_message text NULL,
  result json NULL,
  files json NULL,
  language text DEFAULT 'pt',
  created_at timestamptz DEFAULT now()
);

ALTER TABLE :schema_name.comparison_jobs
  DROP CONSTRAINT IF EXISTS comparison_jobs_type_check;
ALTER TABLE :schema_name.comparison_jobs
  ADD CONSTRAINT comparison_jobs_type_check
  CHECK (type IN ('COMPARE_DOCS', 'COMPARE_DATA', 'EXTRACT_DATA'));

CREATE TABLE IF NOT EXISTS :schema_name.stock_movements (
  id serial PRIMARY KEY,
  product_id uuid REFERENCES :schema_name.products(id),
  type text NOT NULL,
  quantity integer NOT NULL,
  unit_cost numeric(15,2),
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS :schema_name.audit_logs (
  id text PRIMARY KEY,
  tenant_id text,
  user_id text,
  action text NOT NULL,
  resource text NOT NULL,
  details text,
  created_at timestamptz DEFAULT now()
);

-- Tenant indexes/hardening
CREATE INDEX IF NOT EXISTS idx_t_products_category ON :schema_name.products(category);
CREATE INDEX IF NOT EXISTS idx_t_jobs_status ON :schema_name.comparison_jobs(status);
CREATE INDEX IF NOT EXISTS idx_t_jobs_created_at ON :schema_name.comparison_jobs(created_at);
CREATE UNIQUE INDEX IF NOT EXISTS tenant_users_email_lower_uniq ON :schema_name.users(lower(email));
