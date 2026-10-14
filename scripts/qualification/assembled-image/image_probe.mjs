import fs from 'node:fs';
import crypto from 'node:crypto';
import {createRequire} from 'node:module';
import {pathToFileURL} from 'node:url';
import {resolveNativeCli, probeNativeCli} from './native-cli.mjs';
import {resolveTemporal} from './temporal-binding.mjs';
import {swcDiagnostic} from '/opt/meri/apps/runtime/build/swc-diagnostic.mjs';
const sha = p => crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
const root = '/opt/meri';
const sdkEntry = fs.realpathSync(createRequire(root + '/apps/worker/conversation/package.json').resolve('@anthropic-ai/claude-agent-sdk'));
const pkg = JSON.parse(fs.readFileSync(new URL('./package.json',pathToFileURL(sdkEntry)), 'utf8'));
if (process.getuid() !== 1000 || process.version !== 'v24.21.0' || pkg.version !== '0.3.295') throw Error('Runtime pin differs');
for (const p of ['/tmp/meri-home', '/tmp/meri-config']) fs.mkdirSync(p, {recursive: true, mode: 0o700});
const env = {PATH:'/usr/local/bin:/usr/bin:/bin', HOME:'/tmp/meri-home', CLAUDE_CONFIG_DIR:'/tmp/meri-config', CLAUDE_SECURESTORAGE_CONFIG_DIR:'/tmp/meri-config', DISABLE_AUTOUPDATER:'1'};
const nativeCli = probeNativeCli(resolveNativeCli({root, sdkEntry}), env);
const cli = nativeCli.version;

// Mandatory native upstream bundle qualification; no worker/service is started.
const http=await import('node:http'),https=await import('node:https'),net=await import('node:net'),tls=await import('node:tls');
let networkAttempts=0;const deny=()=>{networkAttempts++;throw Error('NATIVE_PROBE_NETWORK_OR_LISTENER');};
globalThis.fetch=deny;http.default.request=deny;https.default.request=deny;net.default.connect=deny;net.default.createConnection=deny;tls.default.connect=deny;net.default.Server.prototype.listen=deny;
for(const p of ["packages/skills/evidence/typed-reads.mjs", "packages/skills/evidence/material-records.mjs", "packages/skills/evidence/record-pages.mjs", "apps/gateway/qualification/action-gateway.mjs", "apps/worker/qualification/checkpoint/verify-session-store.mjs", "apps/worker/qualification/sdk-options.mjs"]) await import(root+'/'+p);
// Resolve through the runtime owner using the package's public entry, preserving npm layout independence.
const temporal = resolveTemporal(root);
const temporalEntry = temporal.entry;
const {bundleWorkflowCode,DefaultLogger}=await import(pathToFileURL(temporalEntry).href);
const {workerOptions}=await import(root+'/apps/runtime/temporal-worker.mjs');
const options=workerOptions({configuration:{temporal:{namespace:'synthetic-image-only',taskQueue:'synthetic-image-only'},limits:{shutdownMs:1000}},connection:{},native:{}});
let bundle;
try {bundle=await bundleWorkflowCode({workflowsPath:options.workflowsPath,logger:new DefaultLogger('ERROR',()=>{})});}
catch(error){
  // Webpack may discard Error.cause. Probe the same runtime-owned native loader for structured causes.
  let nativeError=error;
  try{createRequire(root+'/apps/runtime/package.json')('@swc/core');}catch(cause){nativeError=cause;}
  console.error('MERI_SWC_DIAGNOSTIC '+JSON.stringify(swcDiagnostic(root,nativeError)));
  throw Error('NATIVE_WORKFLOW_BUNDLE_NOT_ADMISSIBLE');
}
if(typeof bundle.code!=='string'||!bundle.code.includes('meriConversationLifecycleWorkflow')||Buffer.byteLength(bundle.code)>16*1024*1024||networkAttempts!==0)throw Error('NATIVE_WORKFLOW_BUNDLE_NOT_ADMISSIBLE');
const workflowBundle={sha256:crypto.createHash('sha256').update(bundle.code).digest('hex'),bytes:Buffer.byteLength(bundle.code),nativeTemporalBundling:true,networkAttempts,temporalVersion:temporal.version,temporalPackage:temporal.name,temporalPackageRoot:temporal.packageRoot,temporalEntry,temporalEntrySha256:sha(temporalEntry)};

await import(root + '/apps/runtime/control.mjs');
await import(root + '/apps/runtime/temporal-worker.mjs');
await import(root + '/apps/runtime/conversation-runner.mjs');
const expected = JSON.parse(fs.readFileSync('/probe/source-manifest.json', 'utf8'));
for (const row of expected.files) if (sha(root + '/' + row.path) !== row.sha256) throw Error('Source image mismatch: ' + row.path);
const paths = ['apps/runtime/cli.mjs','apps/runtime/conversation-runner.mjs','apps/runtime/task-bootstrap.mjs','apps/runtime/prepared-candidate.mjs','apps/runtime/prepared-candidate-config.mjs'];
console.log(JSON.stringify({node:process.version,uid:process.getuid(),platform:process.platform,architecture:process.arch,sdk:pkg.version,cli,
 executablePath:fs.realpathSync(process.execPath),executableSha256:sha(process.execPath),sdkCliPath:nativeCli.path,sdkCliSha256:nativeCli.sha256,nativeCli,
 modules:Object.fromEntries(paths.map(p=>[p,sha(root+'/'+p)])),qualifiedManifestFilesMatched:expected.files.length,
 ordinaryRuntimeImports:true,workflowBundle,restoredSourceModulesMatched:6,providerRequests:0,modelTurns:0,network:'none',liveAcceptance:false}));
