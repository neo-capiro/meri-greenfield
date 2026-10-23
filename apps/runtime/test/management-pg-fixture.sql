-- Synthetic, disposable PG16 fixture only. Minimal pre-migration Core tables consumed by the real generated Prisma client.
-- Product metadata/bootstrap tables and guards are installed from the pinned canonical migrations, not copied here.
CREATE TYPE tenant_status AS ENUM ('active','suspended','pending');
CREATE TYPE membership_status AS ENUM ('invited','active','removed');
CREATE TABLE tenants(id uuid PRIMARY KEY,status tenant_status NOT NULL DEFAULT 'active');
CREATE TABLE tenant_memberships(id uuid PRIMARY KEY,tenant_id uuid NOT NULL REFERENCES tenants,user_id uuid NOT NULL,status membership_status NOT NULL DEFAULT 'active');
CREATE TABLE clients(id uuid PRIMARY KEY);
CREATE TABLE clio_conversations(
 id uuid PRIMARY KEY,tenant_id uuid NOT NULL REFERENCES tenants,user_id uuid NOT NULL,client_id uuid REFERENCES clients ON DELETE SET NULL,
 workspace_id uuid,workspace_key text NOT NULL DEFAULT 'workspace',title text NOT NULL,status text NOT NULL DEFAULT 'active',
 nanoclaw_platform_id text,nanoclaw_agent_group_id text,metadata_jsonb jsonb NOT NULL DEFAULT '{}',
 summary text,summary_up_to_message_id uuid,summary_tokens integer,created_at timestamptz(6) NOT NULL DEFAULT now(),
 updated_at timestamptz(6) NOT NULL DEFAULT now(),archived_at timestamptz(6)
);
CREATE FUNCTION current_tenant_id() RETURNS uuid LANGUAGE sql AS $$SELECT nullif(current_setting('app.current_tenant',true),'')::uuid$$;
CREATE FUNCTION rls_bypass() RETURNS boolean LANGUAGE sql AS $$SELECT coalesce(current_setting('app.bypass_rls',true),'off')='on'$$;
