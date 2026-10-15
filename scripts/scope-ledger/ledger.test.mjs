// Drift and consistency checks for the final scope ledger. Offline: reads repository files only (one optional git check).
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync, writeFileSync, mkdtempSync, mkdirSync, copyFileSync, rmSync, symlinkSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {tmpdir} from 'node:os';
import {resolve, dirname} from 'node:path';
import {DEFAULT_ROOT, SOURCE_PATHS, COVERAGE_ORIGIN, loadSources, scanReferences} from './sources.mjs';
import {decodeCoverageCsv} from './coverage-csv.mjs';
import {buildLedger} from './ledger.mjs';
import {renderGenerated, splice, BEGIN, END} from './markdown.mjs';
import {runCli, generate, JSON_PATH, MARKDOWN_PATH} from './cli.mjs';

const sources = loadSources();
const ledger = buildLedger(sources);
const rows = new Map(ledger.capabilities.map(r => [r.id, r]));
const included = ledger.capabilities.filter(r => r.decision === 'included');
const excluded = ledger.capabilities.filter(r => r.decision === 'excluded');
const quiet = {out: () => {}, err: () => {}};
const read = path => readFileSync(resolve(DEFAULT_ROOT, path), 'utf8');

test('committed JSON and the Markdown generated block equal regeneration', async () => {
  const outputs = generate();
  assert.equal(outputs.json, read(JSON_PATH));
  assert.equal(outputs.markdown, read(MARKDOWN_PATH));
  assert.equal(await runCli(['--check'], quiet), 0);
});

test('CLI refuses bad usage and documents its exit codes', async () => {
  assert.equal(await runCli([], quiet), 2);
  assert.equal(await runCli(['--check', '--write'], quiet), 2);
  let help = '';
  assert.equal(await runCli(['--help'], {out: text => { help = text; }, err: () => {}}), 0);
  assert.match(help, /Exit codes: 0 .*1 .*2 usage.*3 source/s);
});

test('the copied coverage CSV is the audit-published bytes: size, SHA-256, 97 CRLF lines, 96 unique rows', () => {
  const bytes = readFileSync(resolve(DEFAULT_ROOT, SOURCE_PATHS.coverage));
  assert.equal(bytes.length, COVERAGE_ORIGIN.bytes);
  assert.equal(ledger.provenance[SOURCE_PATHS.coverage], COVERAGE_ORIGIN.sha256);
  const decoded = decodeCoverageCsv(bytes.toString('utf8'));
  assert.equal(decoded.lineCount, 97);
  assert.equal(bytes.toString('utf8').split('\r\n').length - 1, 97);
  assert.equal(decoded.rows.length, 96);
  assert.match(read('docs/coordination/ledgers/.gitattributes'), /^TOOL-COVERAGE-96\.csv -text -whitespace$/m);
});

test('optional: the copy equals the audit branch blob when that ref is available locally', t => {
  let blob;
  try { blob = execFileSync('git', ['-C', DEFAULT_ROOT, 'show', `${COVERAGE_ORIGIN.commit}:${COVERAGE_ORIGIN.path}`], {stdio: ['ignore', 'pipe', 'ignore']}); }
  catch { t.skip('audit commit not available in this clone'); return; }
  assert.ok(blob.equals(readFileSync(resolve(DEFAULT_ROOT, SOURCE_PATHS.coverage))));
});

test('139 = 96 included + 43 excluded; the exclusion is the owner list of 15 Oct 2026, distinct from the old deferral', () => {
  assert.deepEqual([ledger.counts.legacyCapabilities, ledger.counts.included, ledger.counts.excluded], [139, 96, 43]);
  const direction = ledger.ownerDirection;
  assert.equal(direction.date, '2026-10-15');
  assert.equal(direction.quote, 'make sure all of these legacy meri tools are excluded. if you built them by accident delete them and make sure you dont leave dead code behind');
  assert.equal(direction.decision, 'excluded');
  assert.match(direction.distinction, /not by carrying the old deferral forward/);
  assert.deepEqual(ledger.counts.excludedByGroup, {'Research Portfolio': 17, 'Relationships, legislation and Florida': 9,
    'Older document and email workflows': 5, 'Direct canonical-memory writes': 3, 'Client and opportunity analysis': 9});
  const deferred = sources.scopeRows.filter(r => r.disposition === 'deferred').map(r => r.id).sort();
  assert.deepEqual(excluded.map(r => r.id).sort(), deferred);
  for (const row of excluded) {
    assert.equal(row.historicalDisposition, 'deferred', row.id);
    assert.match(row.decisionBasis, /owner direction, 15 Oct 2026/i, row.id);
  }
  for (const row of included) assert.equal(row.historicalDisposition, 'selected', row.id);
});

test('excluded rows: no contract, never registered, no implementation found, every naming file classified', () => {
  for (const row of excluded) {
    assert.deepEqual(row.contracts, [], row.id);
    assert.equal(row.implementationFound, false, row.id);
    for (const gate of ['EXCLUDED-NEVER-REGISTERED', 'EXCLUDED-NO-IMPLEMENTATION', 'EXCLUDED-RELEASE-NOTES']) assert.ok(row.gates.includes(gate), `${row.id} ${gate}`);
  }
  assert.deepEqual(excluded.filter(r => r.gates.includes('EXCLUDED-NEUTRALIZE-GUIDANCE')).map(r => r.id).sort(), ['create_client', 'update_client_profile']);
  assert.equal(ledger.counts.excludedImplementationsFound, 0);
  const known = new Set(sources.ownerExclusion.knownReferences.map(r => r.path));
  for (const ref of ledger.excludedReferences) assert.ok(known.has(ref.path), ref.path);
  assert.ok(!sources.coverage.rows.some(r => rows.get(r.legacyId).decision === 'excluded'));
});

test('audit accounting is reproduced exactly: 85 + 11; 53 = 52 + create_word; 43 = 33 + 10; 47 + 6 - 1 = 52', () => {
  const a = ledger.reconciliation.audit;
  assert.deepEqual([a.reads, a.nonReads, a.declared, a.declaredReads, a.undeclared, a.undeclaredReads, a.undeclaredNonReads], [85, 11, 53, 52, 43, 33, 10]);
  assert.deepEqual(a.declaredNonReads, ['create_word']);
  assert.match(a.declaredReadEquation, /^47 literal legacy-name read matches \+ 6 renamed read IDs - 1 historical query_action_items match = 52/);
  assert.deepEqual(a.renamedDeclaredReads.sort(), ['get_email_thread', 'list_emails', 'list_upcoming_meetings', 'query_debriefs', 'read_client_meetings', 'search_emails']);
  assert.equal(a.undeclaredReadBreakdown.domainReads, 29);
  assert.deepEqual(a.undeclaredReadBreakdown.currentSuccessor, ['query_action_items']);
});

test('p3 accounting is reproduced and every difference from the audit is explained row by row', () => {
  const p = ledger.reconciliation.p3;
  assert.deepEqual(p.selectedByKind, {'governed-write': 4, 'product-operation': 10, read: 82});
  assert.deepEqual([p.sameName, p.renamed, p.contracts], [88, 8, 97]);
  const differing = included.filter(r => r.reconciliation.differences.length);
  const byDifference = code => differing.filter(r => r.reconciliation.differences.includes(code)).map(r => r.id).sort();
  assert.deepEqual(byDifference('product-state-read'), ['list_memory_proposals', 'list_scheduled_tasks', 'read_chat_attachments']);
  assert.deepEqual(byDifference('declared-by-bill-watch'), ['create_word']);
  assert.deepEqual(byDifference('historical-successor'), ['query_action_items']);
  assert.deepEqual(byDifference('renamed-undeclared'), ['list_memory_proposals']);
  assert.equal(byDifference('renamed-declared').length, 6);
  for (const row of differing) for (const code of row.reconciliation.differences) assert.ok(ledger.reconciliation.differenceExplanations[code], code);
  // Rows without a difference agree: same kind family, and the audit's declared flag equals the literal legacy-name match.
  for (const row of included.filter(r => !r.reconciliation.differences.length)) {
    assert.equal(row.reconciliation.auditKind === 'read', row.kind === 'read', row.id);
    assert.equal(row.reconciliation.auditDeclared, row.reconciliation.legacyNameDeclared, row.id);
  }
  assert.deepEqual(ledger.reconciliation.bridge.map(b => [b.measure, b.audit, b.p3]), [
    ['reads', 85, 82], ['non-reads', 11, 14], ['undeclared / not named by skills', 43, 49],
    ['legacy names literally declared (full 14-manifest index)', 48, 48], ['contracts', 97, 97]]);
});

test('every included row names contracts, kind, declaration, adapter, route, lane, canonical owner and gates', () => {
  const lanes = new Set(['A/C', 'B', 'B/C', 'C']);
  for (const row of included) {
    assert.ok(row.contracts.length >= 1, row.id);
    assert.ok(['read', 'product-operation', 'governed-write'].includes(row.kind), row.id);
    assert.equal(typeof row.declaration.currentContractDeclared, 'boolean', row.id);
    assert.ok(row.adapter === 'missing' || (Array.isArray(row.adapter) && row.adapter.every(p => sources.exists(p))), row.id);
    assert.ok(row.route === 'general-read-server' || row.route.startsWith('governed-intent:mcp__meri_intents__'), row.id);
    assert.ok(lanes.has(row.ownerLane), row.id);
    assert.ok(row.canonicalOwner.length > 0, row.id);
    assert.equal(row.gates.at(-1), 'DEPLOY-G1-G7', row.id);
    if (row.route === 'general-read-server') for (const gate of ['READ-ADAPTER', 'READ-SERVER', 'READ-QUALIFICATION']) assert.ok(row.gates.includes(gate), `${row.id} ${gate}`);
    else { assert.ok(row.gates.includes('INTENT-ROUTE'), row.id); assert.ok(sources.exists(row.canonicalOwner), row.canonicalOwner); }
    assert.equal(row.gates.includes('READ-CONTEXT'), row.dispatchContext.startsWith('missing:'), row.id);
  }
  assert.deepEqual(ledger.counts.includedByRoute, {'general-read-server': 84, 'governed-intent': 12});
  assert.deepEqual(rows.get('query_action_items').gates.filter(g => g === 'SKILL-SUCCESSOR'), ['SKILL-SUCCESSOR']);
});

test('required product capabilities: all scope rows, browser on with destinations denied, memory, retention, mobile deferred', () => {
  const byScope = new Map(ledger.productCapabilities.filter(p => p.scopeRow).map(p => [p.scopeRow, p]));
  assert.equal(byScope.size, sources.requiredCapabilities.length);
  assert.equal(sources.requiredCapabilities.length, 11);
  for (const required of sources.requiredCapabilities) assert.equal(byScope.get(required.capability).plannedOwner, required.plannedOwner);
  const byId = new Map(ledger.productCapabilities.map(p => [p.id, p]));
  assert.match(byId.get('public-browser').decision, /browser ON by default.*7606375d/);
  assert.match(byId.get('public-browser').additionalAcceptance, /destinations denied by default/);
  assert.match(byId.get('memory-read-propose').currentState, /sourced corrections/);
  assert.match(byId.get('revocation-lifecycle').decision, /retention and deletion/);
  assert.equal(byId.get('mobile').decision, 'deferred relative to desktop');
  for (const id of ['authenticated-browser-workflow', 'device-browser-bridge', 'live-browser-takeover', 'in-browser-office-editing']) {
    assert.match(byId.get(id).decision, /^required for the first shipment \(owner decision, Neo Martinez, 15 Oct 2026/, id);
    assert.ok(byId.get(id).gates.includes('FEATURE-DESIGN-APPROVAL'), id);
  }
  assert.match(byId.get('full-139-workflow-parity').decision, /96 included capabilities and the 14 current skills replaces legacy 139-workflow parity; the 43 excluded tools stay excluded/);
});

test('ownership graph names the requested domains, verifies paths and states what is unowned today', () => {
  const ids = ledger.ownershipGraph.domains.map(d => d.id);
  for (const id of ['startup-composition', 'current-authority', 'persistence', 'budget-proxy', 'issuance-revocation', 'cleanup', 'schedules', 'artifacts', 'sources', 'retention'])
    assert.ok(ids.includes(id), id);
  assert.match(ledger.ownershipGraph.status, /^PROPOSAL for dot/);
  assert.deepEqual(ledger.ownershipGraph.summary.owned, []);
  assert.deepEqual(ledger.ownershipGraph.summary.unowned.sort(), ['budget-proxy', 'release', 'retention', 'settings']);
  for (const domain of ledger.ownershipGraph.domains) assert.ok(domain.ownedToday === 'owned' || domain.unowned.length > 0, domain.id);
});

test('nothing is live and every gate is open and used', () => {
  assert.equal(ledger.counts.live, 0);
  assert.ok(ledger.capabilities.every(r => r.live === false));
  for (const [id, gate] of Object.entries(ledger.gates)) { assert.equal(gate.state, 'open', id); }
});

test('the reference scanner finds a planted file and skips node_modules and symlinks', () => {
  const root = mkdtempSync(resolve(tmpdir(), 'scope-ledger-scan-'));
  try {
    for (const dir of ['apps/x', 'apps/x/node_modules/y', 'packages', 'scripts']) mkdirSync(resolve(root, dir), {recursive: true});
    writeFileSync(resolve(root, 'apps/x/tool.mjs'), "export const name = 'send_email';\n");
    writeFileSync(resolve(root, 'apps/x/node_modules/y/index.mjs'), "'send_email'\n");
    writeFileSync(resolve(root, 'apps/x/notes.md'), 'send_email\n');
    mkdirSync(resolve(root, 'outside'));
    writeFileSync(resolve(root, 'outside/linked.mjs'), "'save_note'\n");
    symlinkSync(resolve(root, 'outside'), resolve(root, 'scripts/linked-dir'));
    symlinkSync(resolve(root, 'outside/linked.mjs'), resolve(root, 'packages/linked.mjs'));
    assert.deepEqual(scanReferences(root, ['send_email', 'save_note']), [{path: 'apps/x/tool.mjs', tools: ['send_email']}]);
  } finally { rmSync(root, {recursive: true, force: true}); }
});

test('counterexamples: each changed source is refused or detected as drift', () => {
  const planted = {...sources, references: [...sources.references, {path: 'apps/worker/conversation/legacy/send-email.mjs', tools: ['send_email']}]};
  assert.throws(() => buildLedger(planted), /Unclassified file names an excluded tool: apps\/worker\/conversation\/legacy\/send-email\.mjs/);
  const shortList = {...sources, ownerExclusion: {...sources.ownerExclusion, groups: sources.ownerExclusion.groups.map((g, i) => i === 0 ? {...g, tools: g.tools.slice(1)} : g)}};
  assert.throws(() => buildLedger(shortList), /differs from the 43 historically deferred/);
  const flipped = {...sources, coverage: {...sources.coverage, rows: sources.coverage.rows.map(r => r.legacyId === 'search_memory' ? {...r, declaredCurrentContract: false, declaredBySkills: []} : r)}};
  assert.throws(() => buildLedger(flipped), /Declaring skills differ for search_memory/);
  const noScopeRow = {...sources, productCapabilities: sources.productCapabilities.filter(p => p.id !== 'public-browser')};
  assert.throws(() => buildLedger(noScopeRow), /Required product capability missing from the ledger: Public browser session/);
  const badPath = {...sources, ownershipGraph: {...sources.ownershipGraph, domains: sources.ownershipGraph.domains.map(d => d.id === 'retention' ? {...d, sourceModules: [...d.sourceModules, 'apps/control/retention/missing.mjs']} : d)}};
  assert.throws(() => buildLedger(badPath), /Ownership path missing at base: apps\/control\/retention\/missing\.mjs/);
  const unusedGate = {...sources, gates: {...sources.gates, 'UNUSED-GATE': {title: 'x', owner: 'x', requirement: 'x', source: 'x'}}};
  assert.throws(() => buildLedger(unusedGate), /Gate UNUSED-GATE is defined but no row names it/);
  assert.throws(() => decodeCoverageCsv('legacy_id\n'), /must end with CRLF/);
  assert.throws(() => splice('no markers', renderGenerated(ledger)), /markers missing/);
  assert.ok(read(MARKDOWN_PATH).includes(BEGIN) && read(MARKDOWN_PATH).includes(END));
});

test('counterexample: a CSV copy that differs from the audit bytes is refused before anything is built', () => {
  const root = mkdtempSync(resolve(tmpdir(), 'scope-ledger-csv-'));
  try {
    for (const path of Object.values(SOURCE_PATHS)) {
      mkdirSync(dirname(resolve(root, path)), {recursive: true});
      copyFileSync(resolve(DEFAULT_ROOT, path), resolve(root, path));
    }
    const csv = resolve(root, SOURCE_PATHS.coverage);
    writeFileSync(csv, readFileSync(csv, 'utf8').replace('get_research_portfolio,', 'get_research_portfolio ,'));
    assert.throws(() => loadSources(root), /differs from the audit-published bytes\/SHA-256/);
  } finally { rmSync(root, {recursive: true, force: true}); }
});
