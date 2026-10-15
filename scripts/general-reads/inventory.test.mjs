// Drift and consistency checks for the general-read inventory. Offline: reads repository files only.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readdirSync, existsSync, readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {DEFAULT_ROOT, loadSources, parseScopeLedger} from './sources.mjs';
import {buildInventory} from './inventory.mjs';
import {runCli, OUTPUT_PATH, render} from './cli.mjs';

const sources = await loadSources();
const inventory = buildInventory(sources);
const byId = new Map(inventory.capabilities.map(c => [c.id, c]));
const quiet = {out: () => {}, err: () => {}};

test('committed inventory equals regeneration from the catalog, scope ledger, skills and adapter/route inputs', async () => {
  assert.equal(render(inventory), readFileSync(resolve(DEFAULT_ROOT, OUTPUT_PATH), 'utf8'));
  assert.equal(await runCli(['--check'], quiet), 0);
});

test('CLI refuses bad usage before reading sources and documents its exit codes', async () => {
  assert.equal(await runCli([], quiet), 2);
  assert.equal(await runCli(['--check', '--write'], quiet), 2);
  let help = '';
  assert.equal(await runCli(['--help'], {out: text => { help = text; }, err: () => {}}), 0);
  assert.match(help, /Exit codes: 0 .*1 .*2 usage/s);
});

test('139 legacy capabilities split 96 selected / 43 deferred in both the catalog and the accepted scope ledger', () => {
  const scope = readFileSync(resolve(DEFAULT_ROOT, 'docs/CAPABILITY-SCOPE.md'), 'utf8');
  assert.match(scope, /96 selected and 43 deferred legacy-registry capabilities/);
  const ledger = parseScopeLedger(scope);
  assert.equal(ledger.length, 139);
  assert.equal(ledger.filter(r => r.disposition === 'selected').length, 96);
  assert.deepEqual([inventory.counts.legacyCapabilities, inventory.counts.selected, inventory.counts.deferred], [139, 96, 43]);
  for (const row of ledger) assert.equal(byId.get(row.id).disposition, row.disposition, row.id);
});

test('96 selected capabilities map to 97 contracts: 88 same-name, 8 renamed, one retained historical contract', () => {
  const m = inventory.mapping;
  assert.equal(inventory.counts.operationContracts, 97);
  assert.equal(m.distinctReplacementContracts, 96);
  assert.equal(m.sameName, 88);
  assert.deepEqual(m.renamed.map(r => `${r.legacy}->${r.contract}`).sort(), [
    'get_email_thread->mail.read_thread', 'list_emails->mail.list_messages', 'list_memory_proposals->memory.list_own_proposals',
    'list_upcoming_meetings->meeting.list_upcoming_meetings', 'query_action_items->actions.query', 'query_debriefs->meeting.query_debriefs',
    'read_client_meetings->meeting.read_client_meetings', 'search_emails->mail.search_messages']);
  assert.deepEqual(m.oneToMany, [{legacy: 'query_action_items', contracts: ['actions.query (renamed)', 'query_action_items (historical-superseded)']}]);
  assert.deepEqual(m.manyToOne, []);
  assert.deepEqual(m.contractsWithoutLegacyCapability, []);
  assert.deepEqual(m.historicalContractsBeyondReplacements, [{id: 'query_action_items', supersededBy: 'actions.query'}]);
  for (const c of inventory.capabilities.filter(c => c.disposition === 'deferred')) assert.deepEqual(c.operations, [], c.id);
});

test('reconciled skill-route counts: 49 = 14 + 29 + 6 against the originals directory, 48 = 13 + 29 + 6 with Bill Watch', () => {
  const {originalsDirectory: dir, fullSkillIndex: full} = inventory.reconciliation;
  assert.equal(dir.skills.length, 13);
  assert.deepEqual([dir.selectedNotNamedBySkills, dir.productOperationsAndGovernedWrites.length, dir.readsWithoutSkillRoute.length, dir.reachedThroughRenamedContracts.length], [49, 14, 29, 6]);
  assert.equal(full.skills.length, 14);
  assert.deepEqual([full.selectedNotNamedBySkills, full.productOperationsAndGovernedWrites.length, full.readsWithoutSkillRoute.length], [48, 13, 29]);
  assert.ok(!full.productOperationsAndGovernedWrites.some(row => row.startsWith('create_word ')), 'Bill Watch allows create_word');
  assert.deepEqual(dir.readsWithoutSkillRouteWithAdapter, ['get_research_evidence', 'list_global_datasets']);
  assert.equal(dir.readsWithoutSkillRouteWithoutAdapter.length, 27);
  assert.deepEqual([...inventory.reconciliation.productStateReads].sort(), ['list_memory_proposals', 'list_scheduled_tasks', 'read_chat_attachments']);
});

test('the skill index covers every packaged original manifest plus the preserved Bill Watch manifest', () => {
  const fromAssets = sources.skills.map(s => s.manifestPath).filter(p => p.startsWith('packages/skills/originals/'));
  assert.deepEqual(fromAssets.sort(), [...sources.originalManifestPaths].sort());
  assert.deepEqual(sources.skills.map(s => s.manifestPath).filter(p => !p.startsWith('packages/skills/originals/')),
    ['apps/control/document-application/research-brief/manifest.json']);
});

test('adapter coverage is declared by the adapter source and every gateway source adapter is listed', () => {
  const listed = new Set(sources.adapters.adapters.map(a => a.path));
  const base = resolve(DEFAULT_ROOT, 'apps/gateway/sources');
  const actual = readdirSync(base, {withFileTypes: true}).filter(e => e.isDirectory() && existsSync(resolve(base, e.name, 'handler.mjs')))
    .map(e => `apps/gateway/sources/${e.name}`);
  assert.deepEqual([...listed].sort(), actual.sort());
  for (const adapter of sources.adapters.adapters) {
    const text = adapter.declaredIn.map(path => sources.readSourceText(path)).join('\n');
    for (const id of adapter.operations) assert.ok(text.includes(`'${id}'`), `${adapter.path} does not declare ${id}`);
  }
  for (const check of Object.values(sources.adapters.authorizationChecks)) assert.ok(sources.exists(check.file), check.file);
  assert.equal(inventory.counts.operationsWithAdapter, 18);
  assert.equal(inventory.counts.selectedWithAdapter, 17);
});

test('every selected product operation and governed write has a route whose owner exists; command routes name the contract action', () => {
  for (const c of inventory.capabilities.filter(c => c.disposition === 'selected' && c.kind !== 'read')) {
    const route = sources.routes.routes[c.id];
    assert.ok(route, c.id);
    assert.ok(sources.exists(route.owner), route.owner);
    const action = sources.bindings.get(c.operations[0].id).action;
    if (action) assert.ok(route.entry.includes(action), `${c.id} route does not name ${action}`);
  }
  assert.deepEqual(inventory.counts.selectedByKind, {'governed-write': 4, 'product-operation': 10, read: 82});
});

test('nothing is live: every contract is unimplemented/pending with a null handler', () => {
  assert.deepEqual(inventory.counts.operationsByAvailability, {'unimplemented/pending': 97});
  assert.ok(inventory.operations.every(o => o.handler === null && o.live === false));
  assert.equal(inventory.counts.live, 0);
});

test('deferred legacy tool names in model-visible text are known and tracked for neutralization', () => {
  assert.deepEqual(inventory.deferredToolReferences, [
    {where: 'packages/contracts/retrieval-0.2/tenant-contacts-validation.mjs:61', tool: 'update_client_profile'},
    {where: 'catalog descriptor lookup_client_registry', tool: 'create_client'}]);
  assert.equal(byId.get('update_client_profile').disposition, 'deferred');
  assert.equal(byId.get('create_client').disposition, 'deferred');
});


test('counterexamples: a changed source is detected as drift or refused as inconsistent', () => {
  const flipped = {...sources, scopeRows: sources.scopeRows.map(r => r.id === 'search_memory' ? {...r, disposition: 'deferred'} : r)};
  assert.throws(() => buildInventory(flipped), /Disposition mismatch for search_memory/);
  const unknown = {...sources, adapters: {...sources.adapters, adapters: [...sources.adapters.adapters, {path: 'x', operations: ['update_client_profile'], adapterChecks: []}]}};
  assert.throws(() => buildInventory(unknown), /unknown operation update_client_profile/);
  const extraSkillUse = {...sources, skills: sources.skills.map(s => s.skillId === 'quick_skill.mail_history' ? {...s, operations: [...s.operations, 'search_congress_bills@0.2.0']} : s)};
  assert.notEqual(render(buildInventory(extraSkillUse)), readFileSync(resolve(DEFAULT_ROOT, OUTPUT_PATH), 'utf8'));
  const noRoute = {...sources, routes: {...sources.routes, routes: Object.fromEntries(Object.entries(sources.routes.routes).filter(([id]) => id !== 'save_memory'))}};
  assert.throws(() => buildInventory(noRoute), /save_memory lacks a route/);
});
