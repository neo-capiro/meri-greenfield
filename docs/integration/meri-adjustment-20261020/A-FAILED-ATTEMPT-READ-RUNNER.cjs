// Package A read runner. Executed inside meri-product-preview-d2-migrate:6 as `node -e "$MERI_A_READ_JS"`
// (A-FAILED-ATTEMPT-READ.overrides.json); reads the SQL from MERI_A_READ_SQL. Each "-- @login <name>" section runs on
// its own least-privilege login with default_transaction_read_only=on. Prints one JSON line per SELECT. Long strings
// and byte values are shortened so prompts, transcripts and blobs do not land in the log group.
const {createRequire} = require('node:module');
const {readFileSync} = require('node:fs');

const LOGINS = {
  control: {user: 'meri_control_runtime', passwordEnv: 'MERI_D2_CONTROL_PASSWORD', database: 'capiro'},
  owner: {user: 'meri_model_budget_owner', passwordEnv: 'MERI_D2_MODEL_OWNER_PASSWORD', database: 'capiro'},
  visibility: {user: 'meri_temporal_visibility_runtime', passwordEnv: 'MERI_D2_TEMPORAL_VISIBILITY_PASSWORD', database: 'temporal_visibility'},
};

function shorten(value) {
  if (Buffer.isBuffer(value)) return `<bytes ${value.length}>`;
  if (typeof value === 'string') return value.length > 160 ? `${value.slice(0, 160)}...<${value.length} chars>` : value;
  if (Array.isArray(value)) return value.map(shorten);
  if (value instanceof Date) return value.toISOString();
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, shorten(v)]));
  return value;
}

// psql variables: "\set name 'value'" lines, referenced as :'name' (values contain no quotes).
function substitute(sql) {
  const values = Object.fromEntries([...sql.matchAll(/^\\set (\w+) '([^']*)'$/gm)].map(m => [m[1], m[2]]));
  return sql.replace(/^\\set .*$/gm, '').replace(/:'(\w+)'/g, (whole, name) => {
    if (!(name in values)) throw Object.assign(new Error(`unset variable ${name}`), {code: 'A_READ_VARIABLE'});
    return `'${values[name]}'`;
  });
}

function sections(sql) {
  return substitute(sql).split(/^-- @login /m).slice(1).map(part => {
    const newline = part.indexOf('\n');
    const name = part.slice(0, newline).trim();
    const body = part.slice(newline + 1).split('\n').filter(line => !line.trim().startsWith('--')).join('\n');
    return {name, statements: body.split(/;\s*(?:\n|$)/).map(s => s.trim()).filter(Boolean)};
  });
}

async function main() {
  const pg = createRequire('/opt/meri/apps/runtime/package.json')('pg');
  const ca = readFileSync('/run/meri/rds-ca.pem', 'utf8');
  for (const {name, statements} of sections(process.env.MERI_A_READ_SQL)) {
    const login = LOGINS[name];
    if (!login) throw Object.assign(new Error(`unknown login ${name}`), {code: 'A_READ_LOGIN'});
    const client = new pg.Client({
      host: process.env.PGHOST, port: 5432, database: login.database, user: login.user, password: process.env[login.passwordEnv],
      ssl: {ca, rejectUnauthorized: true, servername: process.env.PGHOST}, connectionTimeoutMillis: 10000,
      options: '-c default_transaction_read_only=on -c statement_timeout=15000',
    });
    await client.connect();
    try {
      for (const [index, statement] of statements.entries()) {
        try {
          const result = await client.query(statement);
          if (result.command === 'SELECT') {
            console.log(JSON.stringify({login: name, statement: index + 1, rowCount: result.rowCount, rows: shorten(result.rows)}));
          }
        } catch (error) {
          console.log(JSON.stringify({login: name, statement: index + 1, error: error.code ?? 'ERROR', message: String(error.message).slice(0, 200)}));
          await client.query('ROLLBACK').catch(() => {});
          await client.query('BEGIN TRANSACTION READ ONLY');
        }
      }
    } finally {
      await client.end();
    }
  }
  console.log(JSON.stringify({complete: true}));
}

// Runs only as the `node -e` payload; requiring the file (for review or tests) has no effect.
if (module.id === '[eval]') {
  main().catch(error => {
    console.log(JSON.stringify({error: error.code ?? 'ERROR', message: String(error.message).slice(0, 200)}));
    process.exit(2);
  });
}
module.exports = {sections, shorten, substitute};
