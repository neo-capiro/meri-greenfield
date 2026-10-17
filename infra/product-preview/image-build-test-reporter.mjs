// Embedded as a data URL only after the immutable source archive is verified.
// Node's test events stay inside this reporter. Only fixed case IDs and counts
// leave the nonroot, networkless product-image test sandbox.
const files = [
  ['apps/runtime/test/prepared-candidate-bootstrap.test.mjs', [
    'standard task bootstrap polls only existing capability route and returns validated original gated binding',
    'foreign bootstrap proof refuses before returning executable configuration',
    'poststart TLS files are joined only to the validated remote task and a remote TLS override refuses',
    'cancelled bootstrap invokes no transport or execution',
    'gated standard runner starts one Query after HTTP release and retains listener through final control stop',
    'gated SDK failure and parent cancellation retain callback HTTP until positive original control stop',
  ], 'B'],
  ['apps/runtime/test/remote-conversation-runner.test.mjs', [
    'concrete runner owns same worker/query/mirror and keeps listener through cleanup; all execution ports scripted',
    'execute failure still retires original worker/mirror before listener; no source/provider call',
    'foreign original binding fails before secret reads/listener/worker construction',
    'actual private HTTP listener and canonical existing mirror/client share snapshot owner; Query/native process remain scripted',
    'failed physical cleanup and mirror cleanup remain bounded and close listener without reporting success',
    'caller cancellation keeps actual HTTP receiver alive through original worker close',
  ], 'R'],
  ['apps/runtime/temporal-product-token-writer.test.mjs', [
    'writer configuration defaults disabled and is closed before resource allocation',
    'delivery inspection reuses canonical token validation, caps expiry at currentness, and exposes no material',
    'delivery denies revoked, unavailable, stale, foreign or contradictory current identity and token claims',
    'disabled writer never touches supplied ports or timers, and close is idempotent',
    'expiry fences immediately while renewal and cleanup remain unresolved',
    'an unsettled canonical lifetime permanently quarantines new work before and after a late reply',
    'enabled construction is inert and unsupported native platform refuses before delivery',
    'Linux: atomic owner-only replacement stays compatible with the existing reader and closes only owned files',
    'Linux: renewal, expiry and revocation remove published authorization and notify the application',
    'Linux: bounded delivery abort and late reply never reinstall an authorization file',
    'Linux: close aborts in-flight delivery, ignores its late reply and removes the task-local lock',
    'Linux: preexisting credentials and foreign replacements are preserved rather than adopted or removed',
  ], 'W'],
];

const cases = new Map(files.flatMap(([file, names, prefix]) => names.map((name, index) => [
  `/opt/meri/${file}\0${name}`, `${prefix}${String(index + 1).padStart(2, '0')}`,
])));

export default async function* productImageTestReporter(source) {
  const seen = new Set();
  const failed = new Set();
  let unknownFailures = 0;
  let unknownOutcomes = 0;
  let duplicateCases = 0;
  let skippedCases = 0;
  for await (const event of source) {
    if (event?.type !== 'test:pass' && event?.type !== 'test:fail') continue;
    const data = event.data;
    const id = typeof data?.file === 'string' && typeof data?.name === 'string'
      ? cases.get(`${data.file}\0${data.name}`) : undefined;
    if (id === undefined) {
      unknownOutcomes = Math.min(25, unknownOutcomes + 1);
      if (event.type === 'test:fail') unknownFailures = Math.min(25, unknownFailures + 1);
      continue;
    }
    if (seen.has(id)) duplicateCases = Math.min(25, duplicateCases + 1);
    seen.add(id);
    if (data.skip || data.todo) skippedCases = Math.min(25, skippedCases + 1);
    if (event.type === 'test:fail') failed.add(id);
  }
  yield `${JSON.stringify({schemaVersion: 1, observedCases: seen.size,
    failedCaseIds: [...failed].sort(), unknownFailures, unknownOutcomes,
    duplicateCases, skippedCases})}\n`;
}
