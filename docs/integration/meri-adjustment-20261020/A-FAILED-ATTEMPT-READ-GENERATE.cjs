// Builds the RunTask overrides for the package A durable-state read from A-FAILED-ATTEMPT-READONLY.sql and
// A-FAILED-ATTEMPT-READ-RUNNER.cjs. Run from this directory: `node A-FAILED-ATTEMPT-READ-GENERATE.cjs`.
// ECS refused a single 8,120-byte compact payload with "Container Overrides length must be at most 8192", so the
// "-- @login" sections are packed in order into as many runs as needed, each at most MAX_BYTES compact. Each run
// carries only the "\set" variables its sections reference. Output: A-FAILED-ATTEMPT-READ-<n>.overrides.json, one
// file per RunTask, replacing any earlier output.
const fs = require('node:fs');

const MAX_BYTES = 7600;
const OUTPUT = /^A-FAILED-ATTEMPT-READ(-\d+)?\.overrides\.json$/;
const COMMAND = 'set -euo pipefail; umask 077; printf "%s" "$MERI_D2_RDS_CA_PEM" > /run/meri/rds-ca.pem; ' +
  'unset MERI_D2_RDS_CA_PEM PGUSER PGPASSWORD MERI_D2_ISSUER_PASSWORD MERI_D2_TEMPORAL_MIGRATOR_PASSWORD MERI_D2_TEMPORAL_PRIMARY_PASSWORD; ' +
  'printf "%s  /run/meri/rds-ca.pem\\n" "$MERI_D2_RDS_CA_SHA256" | sha256sum -c - >/dev/null; exec node -e "$MERI_A_READ_JS"';

// Drops blank and comment lines (keeping "-- @login" markers) and collapses whitespace.
function compact(text, keep) {
  return text.split('\n').map(line => line.trim())
    .filter(line => line && (!/^(--|\/\/)/.test(line) || keep(line)))
    .map(line => line.replace(/\s+/g, ' ')).join('\n');
}

const sql = compact(fs.readFileSync('A-FAILED-ATTEMPT-READONLY.sql', 'utf8'), line => line.startsWith('-- @login '));
const js = compact(fs.readFileSync('A-FAILED-ATTEMPT-READ-RUNNER.cjs', 'utf8'), () => false);
const variables = sql.split('\n').filter(line => line.startsWith('\\set '));
const sections = sql.split(/^(?=-- @login )/m).slice(1).map(section => section.trim());

function overrides(run) {
  const body = run.join('\n');
  const used = variables.filter(line => body.includes(`:'${line.split(' ')[1]}'`));
  return {containerOverrides: [{name: 'd2-migrate', command: [COMMAND],
    environment: [{name: 'MERI_A_READ_SQL', value: [...used, body].join('\n')}, {name: 'MERI_A_READ_JS', value: js}]}]};
}
const size = run => JSON.stringify(overrides(run)).length;

const runs = [];
for (const section of sections) {
  const last = runs.at(-1);
  if (last && size([...last, section]) <= MAX_BYTES) last.push(section);
  else runs.push([section]);
}
for (const [index, run] of runs.entries()) {
  if (size(run) > MAX_BYTES) throw new Error(`run ${index + 1} is ${size(run)} bytes (limit ${MAX_BYTES}); split that SQL section`);
}

for (const file of fs.readdirSync('.').filter(name => OUTPUT.test(name))) fs.unlinkSync(file);
for (const [index, run] of runs.entries()) {
  const file = `A-FAILED-ATTEMPT-READ-${index + 1}.overrides.json`;
  fs.writeFileSync(file, `${JSON.stringify(overrides(run), null, 1)}\n`);
  const logins = run.map(section => section.slice('-- @login '.length, section.indexOf('\n')));
  console.log(`${file}: ${size(run)} bytes compact, logins ${logins.join(', ')}`);
}
