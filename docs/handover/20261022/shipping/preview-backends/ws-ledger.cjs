// READ ONLY: which workspace migrations the clone ledger has, plus the columns their DDL targets.
const { Client } = require('node:module').createRequire('/app/apps/api/package.json')('pg');
(async () => {
  const c = new Client({ host: process.env.DB_HOST, port: +process.env.DB_PORT, database: process.env.DB_NAME,
    user: process.env.DB_USER, password: process.env.DB_PASSWORD, ssl: { rejectUnauthorized: false } });
  await c.connect(); console.log('host', process.env.DB_HOST);
  await c.query('BEGIN READ ONLY');
  const names = ["00000000000000_init_workspace", "20260627185725_ws_doc_version", "20260627185727_ws_edit_lock", "20260627190000_ws_collaborator", "20260628120000_ws_notification", "20260628170000_ws_draft_last_editor", "20260812120000_document_agent", "20260815000000_ws_guest_comment", "20260815120000_ws_intake_generation_run", "20260816000000_ws_theme_brand_asset", "20260901120000_ws_hillday", "20260911160000_hillday_first_page_edits", "20260913020000_legiwatch_preparation_actions", "20261006210000_workspace_newsletters", "20261007020000_newsletter_review", "20261007030000_newsletter_brand_kit", "20261007040000_newsletter_asset_library_deletion", "20261007050000_newsletter_asset_folders", "20261007060000_newsletter_image_revisions", "20261007070000_newsletter_thread_email", "20261007080000_newsletter_author_access", "20261007090000_newsletter_email_invitations", "20261007100000_newsletter_account_role", "20261012030000_prospect_resource_origin", "20261012040000_saved_version_immutability", "20261013090000_prospect_brief_workspace_copy"];
  const r = await c.query('SELECT migration_name, finished_at IS NOT NULL done, rolled_back_at IS NOT NULL rb, applied_steps_count FROM _prisma_migrations WHERE migration_name = ANY($1)', [names]);
  const have = new Map(r.rows.map((x) => [x.migration_name, x]));
  for (const n of names) console.log(have.has(n) ? 'APPLIED' : 'MISSING', n, have.has(n) ? JSON.stringify(have.get(n)) : '');
  const cols = await c.query("SELECT table_name, column_name FROM information_schema.columns WHERE table_schema='public' AND table_name LIKE 'ws_%' AND column_name IN ('client_id','prospect_id','source_client_ids','resource_origin')");
  console.log('ws cols', JSON.stringify(cols.rows));
  await c.query('ROLLBACK'); await c.end();
})().catch((e) => { console.log('FATAL', e.message); process.exit(1); });
