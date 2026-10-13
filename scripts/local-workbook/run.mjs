#!/usr/bin/env node
/** Explicit local workbook outcome; inert import/help and fixed synthetic data only. */
import assert from 'node:assert/strict';
import {mkdir,stat} from 'node:fs/promises';
import {isAbsolute,resolve} from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';

const usage = 'Usage: node scripts/local-workbook/run.mjs --run --python /absolute/python --soffice /absolute/soffice --output /absolute/new-directory | --help\nCreate/revise real XLSX via loopback HTTP; inspect/recalculate and render immutable local copies. Retain requested evidence files; close owned temporary stores/processes/listener. Identity and SQL are synthetic. No model, native qualification or production activation. Exit0 success/help;1 run/check/cleanup failure;2 invalid usage.\n';
export async function main(args = process.argv.slice(2),write = text => process.stdout.write(text)) {
  if (args.length === 1 && args[0] === '--help') {write(usage);return 0;}
  if (args.length !== 7 || args[0] !== '--run' || args[1] !== '--python' || args[3] !== '--soffice' || args[5] !== '--output' ||
      ![args[2],args[4],args[6]].every(isAbsolute)) {write(usage);return 2;}
  const root = fileURLToPath(new URL('../../',import.meta.url)),previous = process.env.MERI_REVIEW_SOURCE_ROOT;
  let fixture,other,server,app,result,failure,cleanupFailure;
  try {
    if (previous !== undefined && resolve(previous) !== resolve(root)) throw Error('LOCAL_WORKBOOK_CONFIGURATION');
    for (const executable of [args[2],args[4]]) if (!(await stat(executable)).isFile()) throw Error('LOCAL_WORKBOOK_CONFIGURATION');
    await mkdir(args[6],{mode: 0o700});
    process.env.MERI_REVIEW_SOURCE_ROOT = root;
    const [{createLocalDocumentFixture},{mountLocalDocumentApplication},{runLocalWorkbookFlow},{listenActionApplication}] = await Promise.all([
      import('../../apps/control/document-application/local/fixture.mjs'),import('../../apps/control/document-application/local/mount.mjs'),
      import('../../apps/control/document-application/local/workbook/flow.mjs'),import('../../apps/control/action-application/node-http.mjs'),
    ]);
    fixture = await createLocalDocumentFixture({mode: 'synthetic-local',pythonExecutable: args[2],operation: 'create_excel'});
    other = await createLocalDocumentFixture({mode: 'synthetic-local',pythonExecutable: args[2],operation: 'create_excel'});
    assert.notEqual(fixture.directory,other.directory);assert.notEqual(fixture.nativeCredential,other.nativeCredential);
    app = mountLocalDocumentApplication(fixture);const otherApp = mountLocalDocumentApplication(other);
    server = await listenActionApplication({app: {handle: request => app.handle(request)},host: '127.0.0.1',port: 0,lifetimeMs: 25000});
    const send = (path,body,credential) => fetch(server.origin+path,{method: 'POST',redirect: 'error',
      headers: {authorization: 'Bearer '+credential,'content-type': 'application/json'},body: JSON.stringify(body)});
    result = await runLocalWorkbookFlow({fixture,send,pythonExecutable: args[2],sofficeExecutable: args[4],outputDirectory: args[6],
      reconstruct: async () => {app = mountLocalDocumentApplication(fixture);},
      checkIsolation: async ({versionId,credential}) => {
        const otherSend = (path,body,token) => otherApp.handle(new Request('https://isolated-fixture.invalid'+path,{method: 'POST',
          headers: {authorization: 'Bearer '+token,'content-type': 'application/json'},body: JSON.stringify(body)}));
        const crossed = await otherSend('/api/documents/download',{versionId},credential);assert.equal(crossed.status,403);
        const issued = await otherSend('/api/action-followthrough/session',{},other.nativeCredential);assert.equal(issued.status,200);
        const own = await issued.json();assert.notEqual(own.credential,credential);
        const foreignVersion = await otherSend('/api/documents/download',{versionId},own.credential);assert.notEqual(foreignVersion.status,200);
        assert.equal(other.stats().generations,0);assert.equal(other.stats().consumedMicroUsd,'0');
      },
    });
  } catch (error) {
    failure = {name: error?.name ?? 'Error',code: error?.code ?? 'LOCAL_WORKBOOK_FAILURE',message: String(error?.message ?? '').slice(0,2048),
      ...(error?.receipt ? {process: error.receipt} : {}),
      ...(Buffer.isBuffer(error?.stdout) ? {stdoutBase64: error.stdout.toString('base64')} : {}),
      ...(Buffer.isBuffer(error?.stderr) ? {stderrBase64: error.stderr.toString('base64')} : {})};
  } finally {
    for (const resource of [server,other,fixture]) try {await resource?.close();} catch {cleanupFailure = true;}
    if (previous === undefined) delete process.env.MERI_REVIEW_SOURCE_ROOT;else process.env.MERI_REVIEW_SOURCE_ROOT = previous;
  }
  const stats = [fixture,other].filter(Boolean).map(item => item.stats()),http = server?.status();
  if (stats.some(item => !item.closed || !item.cleanup?.executorDirectoriesAbsent || !item.cleanup?.storeRemoved) ||
      http && (!http.closed || http.listening || http.activeSockets)) cleanupFailure = true;
  write(JSON.stringify({status: failure || cleanupFailure ? 'FAIL' : 'PASS',mode: 'synthetic-local',transport: 'loopback-http',
    nativeDatabase: false,nativeQualified: false,productionActivated: false,outputDirectory: args[6],
    ...(result ? {result} : {}),...(failure ? {failure} : {}),cleanup: {failed: Boolean(cleanupFailure),http: http ?? null,fixtures: stats}})+'\n');
  return failure || cleanupFailure ? 1 : 0;
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) process.exitCode = await main();
