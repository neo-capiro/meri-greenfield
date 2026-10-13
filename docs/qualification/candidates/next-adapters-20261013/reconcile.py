"""Build a new bounded source assessment; keep prior receipts and exact plan rows intact."""
import collections, hashlib, json, pathlib, subprocess

root = pathlib.Path(__file__).resolve().parents[4]
base = pathlib.Path(__file__).resolve().parent
prior_path = root / 'docs/qualification/candidates/whole-plan-next-20261013/reconciliation.json'
prior = json.loads(prior_path.read_text())
rows = prior['records']
plan = root / 'docs/plans/MERI-DEPLOYMENT.md'
plan_bytes = plan.read_bytes()
lines = plan_bytes.decode().splitlines()
for row in rows:
    locator = row['originalLocator']
    original = lines[locator['line'] - 1]
    assert row['originalRequirement'] == original
    assert locator['planSha256'] == hashlib.sha256(plan_bytes).hexdigest()
    assert locator['rowSha256'] == hashlib.sha256(original.encode()).hexdigest()

def bounded(row, description, source):
    row.setdefault('completedBoundedSubcriteria', []).append({
        'description': description, 'source': source,
        'acceptance': 'BOUNDED_IMPLEMENTED_SOURCE_ONLY', 'closesWholeCriterion': False})

for row in rows:
    key = row['id']
    if key in ['W04', 'R-04', 'REL-03', 'RG-12']:
        bounded(row, 'Six configured HTTP source adapters and canonical handlers implement mail candidate list/search, exact thread body, upcoming meeting calendar, debrief inventory/exact body and meeting inventory/exact note/transcript. Actual dispatcher preserves current authority, budgets, mail continuation and incomplete coverage. Native producer compatibility, immutable source versions/snapshots and activation remain unqualified.', ['apps/gateway/sources/mail/', 'apps/gateway/sources/meetings/', 'apps/gateway/test/next-read-adapters-integration.test.mjs'])
    if key in ['W01', 'W05', 'W06', 'REL-02', 'REL-04', 'RG-12']:
        bounded(row, 'Additive public conversation receiving contract and adaptation of the existing control mount supply request/response/event/cursor and POST subscription/GET reconnect semantics. Existing service, current opaque session checks, durable store, Temporal and AI SDK remain canonical. Frontend integration and native activation require their own acceptance.', ['packages/contracts/conversation-application/', 'apps/control/conversations/http.mjs'])
    if key == 'W01':
        row['missingImplementation'][0] = 'All14 original immutable prose/manifest pairs and the resolver were source accepted in PR60; complete executable workflows, required-source completion and full Bill Watch federal/state/client behavior remain missing.'
    if key == 'W04':
        row['missingImplementation'] = [
            'Selected-domain adapters remain incomplete beyond the prior and new mail/meeting slices; all-source continuation/snapshot/freshness producers and complete required-source joins remain missing.',
            'Canonical ordinary memory.read storage/query producer and full client/roster/portfolio families remain missing. Broad mail and meeting source callbacks are now implemented; source producer compatibility and activation are external qualification dependencies.',
            'Complete selected-source two-tenant/within-tenant wall/revocation fixtures and required-source completion joins remain missing.']
    if key == 'W05':
        row['missingImplementation'][0] = 'PR60 supplies initial persisted request/event journal, exact retry and Temporal start/cancel plus one SDK activity. General multi-run conversation lifecycle, approval integration, authenticated steering/fork, verified checkpoint/workspace resume and lifecycle composition remain missing.'
    for item in row.get('subcriteria', []):
        if key in ['R-07', 'R-08', 'REL-02', 'REL-04'] and item['class'] == 'missing-implementation':
            item['finding'] = 'PR60 added all14 original immutable asset pairs, exact manifest/prose selection, a read-only Commitments evidence projection and one request/SDK slice. Entire promised workflows, mandatory-source completion, semantic extraction/delivery proof, active-version migration, steering/fork/verified resume and frontend composition remain missing.'
        if key == 'R-08' and item['class'] == 'implemented-but-unqualified':
            item['finding'] = 'All14 original immutable skill asset pairs now exist in packages/skills; Commitments projection preserves quote/source/version/hash/scope and unknown owner/date/completion. Asset selection and projection are bounded source outcomes, not full workflow qualification.'
        if key == 'REL-03' and item['class'] == 'missing-implementation':
            item['finding'] = 'PR60 implemented trusted window resolution; this batch adds six mail/meeting callbacks. All selected source-family implementations, ordinary memory/client/roster behavior, complete multi-source truth joins and producer snapshot/continuation owners remain incomplete.'

counts = collections.Counter(r['primaryClass'] for r in rows if r['status'] == 'pending')
assert len(rows) == 53 and sum(counts.values()) == 51
assert dict(counts) == prior['counts']['primaryOpenClasses']
result = {
    'schema': 'meri.next-adapters-reconciliation/1',
    'baseline': {'pullRequest': 60, 'commit': 'a2aef4a5fcd3c19cec974dc62b69222836d71b3e', 'tree': 'c9fe3ebb35213af65a70c01563855dfe08ed2606', 'assessmentSha256': hashlib.sha256(prior_path.read_bytes()).hexdigest()},
    'assessedSourceCommit': subprocess.check_output(['git', 'rev-parse', 'HEAD'], cwd=root, text=True).strip(),
    'counts': {'originalRecords': 53, 'acceptedDiscovery': 2, 'wholeOpenBefore': 51, 'wholeOpenAfter': 51, 'wholeRuntimeQualified': 0, 'primaryOpenClasses': dict(counts), 'boundedImplementationUnits': 7, 'boundedMissingBefore': 7, 'boundedMissingAfter': 0},
    'classSemantics': prior['classSemantics'],
    'assessmentCorrections': 'Historical assessments remain immutable. Copied new assessment removes stale claims that13 original recipe pairs, trusted window resolution, initial conversation journal and mail/meeting callbacks are absent. Their complete workflow and other selected-source gaps remain explicit. No whole primary class changes because no entire original criterion was completed.',
    'boundedBatch': [{'units': 3, 'owner': 'apps/gateway/sources/mail/', 'outcome': 'Concrete candidate list/search and exact thread-body transport/handlers.'}, {'units': 3, 'owner': 'apps/gateway/sources/meetings/', 'outcome': 'Concrete upcoming/debrief/inventory/exact note-transcript transport/handlers.'}, {'units': 1, 'owner': 'packages/contracts/conversation-application/', 'outcome': 'Authoritative additive public receiving interface and existing-mount POST/GET compatibility.'}],
    'separatePrerequisiteRepair': 'Four obsolete public package0.1.0 assertions repaired to historical current0.1.2, independently accepted; subsequent authorized additive0.1.3 release changes only these package expectations again. Frozen wire0.1.0 assertions remain.',
    'records': rows,
    'criticalPath': prior['criticalPath'],
    'externalDependencies': ['Actual qualified native worker/image/current identity and activation.', 'Native producer implementation/route/payload compatibility with explicit configured canonical page protocol; no guessed routes.', 'Frontend owner acceptance of exact package/source contract and same-origin service/session wiring.', 'Protected PostgreSQL/Temporal/storage/source native qualification by existing owners; no competing fixtures.', 'Private transfer explicitly approved2026-10-13T10:16:00Z; producer supported Library HTTP401 remains blocker.'],
    'preservation': 'Canonical catalog0.2.15 still97 unimplemented/pending/null operations. Existing public wire/action/document APIs and generated bytes unchanged. Public0.1.3 only adds conversation receiving exports. No native pins, approved deployment scope, SDK loop or skill pins changed.',
    'historicalOriginalRecordHashes': prior['historicalOriginalRecordHashes'],
    'runtimeAcceptance': 'HOLD; source/local checks and independent reviews do not qualify native runtime or close all51 remaining requirements.'}
(base / 'reconciliation.json').write_text(json.dumps(result, indent=2) + '\n')
print(json.dumps(result['counts']))
