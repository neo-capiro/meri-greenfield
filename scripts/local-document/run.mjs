#!/usr/bin/env node
/** Explicit local one-shot Word workflow; imports/help do not allocate any resources. */
import {fileURLToPath,pathToFileURL} from 'node:url';
import {isAbsolute,resolve} from 'node:path';

const usage = 'Usage: node scripts/local-document/run.mjs --run --python /absolute/python | --help\nCreates and revises real DOCX files via loopback HTTP, then removes owned files/listeners. Identity and SQL are synthetic. No paid model, native qualification or source connection. Exit 0 success/help; 1 run/check/cleanup failure; 2 invalid usage.\n';
export async function main(args = process.argv.slice(2),write = value => process.stdout.write(value)) {
  if (args.length === 1 && args[0] === '--help') {write(usage);return 0;}
  if (args.length !== 3 || args[0] !== '--run' || args[1] !== '--python' || !isAbsolute(args[2])) {write(usage);return 2;}
  const root = fileURLToPath(new URL('../../',import.meta.url)),previous = process.env.MERI_REVIEW_SOURCE_ROOT;
  let fixture,server,result,failure,cleanupFailure,app;
  try {
    if (previous !== undefined && resolve(previous) !== resolve(root)) throw Error('LOCAL_DOCUMENT_CONFIGURATION');
    process.env.MERI_REVIEW_SOURCE_ROOT = root;
    const [{createLocalDocumentFixture},{mountLocalDocumentApplication},{runLocalDocumentFlow},{listenActionApplication}] = await Promise.all([
      import('../../apps/control/document-application/local/fixture.mjs'),import('../../apps/control/document-application/local/mount.mjs'),
      import('../../apps/control/document-application/local/flow.mjs'),import('../../apps/control/action-application/node-http.mjs'),
    ]);
    fixture = await createLocalDocumentFixture({mode: 'synthetic-local',pythonExecutable: args[2]});
    app = mountLocalDocumentApplication(fixture);
    server = await listenActionApplication({app: {handle: request => app.handle(request)},host: '127.0.0.1',port: 0,lifetimeMs: 25000});
    result = await runLocalDocumentFlow({fixture,pythonExecutable: args[2],
      send: (path,body,credential) => fetch(server.origin+path,{method: 'POST',redirect: 'error',
        headers: {authorization: 'Bearer '+credential,'content-type': 'application/json'},body: JSON.stringify(body)}),
      reconstruct: async () => {app = mountLocalDocumentApplication(fixture);},
    });
  } catch (error) {
    // This executable accepts only fixed synthetic content. Keep useful failure evidence without tokens or paths.
    failure = {name: error?.name ?? 'Error',code: error?.code ?? 'LOCAL_DOCUMENT_FAILURE',message: String(error?.message ?? '').slice(0,2048)};
  } finally {
    try {await server?.close();} catch {cleanupFailure = true;}
    try {await fixture?.close();} catch {cleanupFailure = true;}
    if (previous === undefined) delete process.env.MERI_REVIEW_SOURCE_ROOT;else process.env.MERI_REVIEW_SOURCE_ROOT = previous;
  }
  const stats = fixture?.stats(),http = server?.status();
  if (stats && (!stats.closed || !stats.cleanup?.executorDirectoriesAbsent || !stats.cleanup?.storeRemoved) || http && (!http.closed || http.listening || http.activeSockets)) cleanupFailure = true;
  write(JSON.stringify({status: failure || cleanupFailure ? 'FAIL' : 'PASS',mode: 'synthetic-local',transport: 'loopback-http',
    nativeDatabase: false,nativeQualified: false,productionActivated: false,...(result ? {result} : {}),
    ...(failure ? {failure} : {}),cleanup: {failed: Boolean(cleanupFailure),http: http ?? null,fixture: stats ?? null}})+'\n');
  return failure || cleanupFailure ? 1 : 0;
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) process.exitCode = await main();
