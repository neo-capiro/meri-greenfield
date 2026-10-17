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
const fileIds = new Map(files.flatMap(([file, , id]) => [[`/opt/meri/${file}`, id], [file, id]]));
const stages = new Set('START FIRST_METADATA FIRST_READ REFRESH SECOND_METADATA SECOND_READ STATUS CLOSE CLEANUP'.split(' '));
const codes = new Set(('ERR_ASSERTION ERR_MODULE_NOT_FOUND MODULE_NOT_FOUND ERR_WORKER_INIT_FAILED ERR_WORKER_OUT_OF_MEMORY EAGAIN ENOENT EACCES EPERM RUNTIME_SECRET_FILE TASK_BOOTSTRAP_REFUSED ' +
  'TEMPORAL_PRODUCT_TOKEN_CONFIGURATION TEMPORAL_PRODUCT_TOKEN_DELIVERY TEMPORAL_PRODUCT_TOKEN_PLATFORM TEMPORAL_PRODUCT_TOKEN_DIRECTORY TEMPORAL_PRODUCT_TOKEN_OWNERSHIP TEMPORAL_PRODUCT_TOKEN_PATH_OCCUPIED TEMPORAL_PRODUCT_TOKEN_CLEANUP_UNKNOWN TEMPORAL_PRODUCT_TOKEN_IO_UNKNOWN TEMPORAL_PRODUCT_TOKEN_CURRENTNESS TEMPORAL_PRODUCT_TOKEN_EXPIRY TEMPORAL_PRODUCT_TOKEN_CLOCK TEMPORAL_PRODUCT_TOKEN_CLOSED TEMPORAL_PRODUCT_TOKEN_INTERRUPTED TEMPORAL_PRODUCT_TOKEN_REVOKED TEMPORAL_PRODUCT_TOKEN_UNAVAILABLE TEMPORAL_PRODUCT_TOKEN_REFUSED').split(' '));
const types = new Set('testCodeFailure subtestsFailed hookFailed cancelledByParent testTimeoutFailure testAborted uncaughtException unhandledRejection'.split(' '));
const signals = new Set('SIGABRT SIGSEGV SIGKILL SIGTERM SIGBUS'.split(' '));
const exceptions = new Set('Error AssertionError TypeError RangeError SyntaxError OTHER'.split(' '));

export default async function* productImageTestReporter(source) {
  const seen = new Set();
  const failed = new Set();
  let unknownFailures = 0;
  let unknownOutcomes = 0;
  let duplicateCases = 0;
  let skippedCases = 0;
  const fileCaseCounts = {B: 0, R: 0, W: 0};
  const fileFailureIds = new Set();
  const stderrCodes = new Map();
  const details = new Map();
  let detailTruncated = false;
  for await (const event of source) {
    if (event?.type === 'test:stderr') {
      const fileId = fileIds.get(event.data?.file);
      const message = typeof event.data?.message === 'string' ? event.data.message.slice(0, 8192) : '';
      if (fileId) for (const code of codes) if (message.includes(code)) { stderrCodes.set(fileId, code); break; }
      continue;
    }
    if (event?.type !== 'test:pass' && event?.type !== 'test:fail') continue;
    const data = event.data;
    const fileId = fileIds.get(data?.file) ?? fileIds.get(data?.name);
    const id = typeof data?.file === 'string' && typeof data?.name === 'string'
      ? cases.get(`${data.file}\0${data.name}`) : undefined;
    if (event.type === 'test:fail') {
      if (fileId) fileFailureIds.add(fileId);
      const detailId = id ?? (fileId ? `${fileId}_FILE` : 'UNMAPPED');
      if (!details.has(detailId)) {
        if (details.size >= 4) {
          detailTruncated = true;
          if (detailId === 'W08') details.delete(details.keys().next().value);
        }
        if (details.size < 4) {
          const error = data?.details?.error;
          let stage = 'NONE', code = stderrCodes.get(fileId) ?? 'OTHER', current = error;
          let checkId = 0, exception = 'NONE', capturedCode;
          for (let depth = 0; current && depth < 4; depth++, current = current.cause) {
            if (id === 'W08' && typeof current.message === 'string') for (const value of stages) if (current.message === `PRODUCT_IMAGE_W08_${value}`) stage = value;
            if (codes.has(current.code)) code = current.code;
            if (id === 'W08' && Number.isInteger(current.checkId) && current.checkId >= 1 && current.checkId <= 30 && exceptions.has(current.checkException) && (codes.has(current.checkCode) || current.checkCode === 'OTHER')) {
              checkId = current.checkId; exception = current.checkException; capturedCode = current.checkCode;
            }
          }
          details.set(detailId, {id: detailId, stage, code: capturedCode ?? code, checkId, exception,
            failureType: types.has(error?.failureType) ? error.failureType : 'UNKNOWN',
            exitCode: Number.isInteger(error?.exitCode) && error.exitCode >= -255 && error.exitCode <= 255 ? error.exitCode : null,
            signal: signals.has(error?.signal) ? error.signal : error?.signal === undefined ? 'NONE' : 'OTHER'});
        }
      }
    }
    if (id === undefined) {
      unknownOutcomes = Math.min(25, unknownOutcomes + 1);
      if (event.type === 'test:fail') unknownFailures = Math.min(25, unknownFailures + 1);
      continue;
    }
    if (seen.has(id)) duplicateCases = Math.min(25, duplicateCases + 1);
    else fileCaseCounts[id[0]]++;
    seen.add(id);
    if (data.skip || data.todo) skippedCases = Math.min(25, skippedCases + 1);
    if (event.type === 'test:fail') failed.add(id);
  }
  yield `${JSON.stringify({schemaVersion: 1, observedCases: seen.size,
    failedCaseIds: [...failed].sort(), unknownFailures, unknownOutcomes,
    duplicateCases, skippedCases, fileCaseCounts, fileFailureIds: [...fileFailureIds].sort(),
    failureDetails: [...details.values()], detailTruncated})}\n`;
}
