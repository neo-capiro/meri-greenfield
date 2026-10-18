/** Immutable image/runner/path/SDK-option intent, compiled before RunTask. */
import {isAbsolute,normalize,dirname} from 'node:path';
import {own,data} from '../../../packages/contracts/commands-0.2/execution-boundary.mjs';
import {canonicalSha256 as hash} from '../../../packages/contracts/validate.mjs';
import {createHash,timingSafeEqual} from 'node:crypto';
import {executionFault} from './execution-broker.mjs';
import {continuationLaunchArgs} from './continuation-pin.mjs';
const refuse=()=>{throw executionFault('PREPARATION_REFUSED');};
/** The one extra trust anchor the SDK subprocess may load: the pinned control/server CA the runner poststart owner writes
 * (MERI_POSTSTART_CA_SHA256) to /run/meri/poststart + bootstrap/control-ca.pem. It signs the model proxy's server certificate. */
export const RUNNER_SDK_CA_FILE='/run/meri/poststart/bootstrap/control-ca.pem';
const absolute=p=>typeof p==='string'&&isAbsolute(p)&&normalize(p)===p&&p!=='/'&&!p.endsWith('/')&&!/[\x00-\x1f\x7f]/u.test(p);
export function compileNativePreparationIntent(value){
 const c=data(own(value,['workspace','configParentDirectory','secureStorageDirectory','launchTemplate','executableSha256','imageSha256','runnerSha256','sdkOptionsSha256','authoritySha256']));
 const t=own(c.launchTemplate,['command','args','env']);
 if(![c.workspace,c.configParentDirectory,c.secureStorageDirectory,t.command].every(absolute)||!['executableSha256','imageSha256','runnerSha256','sdkOptionsSha256','authoritySha256'].every(k=>typeof c[k]==='string'&&/^[a-f0-9]{64}$/u.test(c[k]))||!Array.isArray(t.args)||t.args.length>256||t.args.some(v=>typeof v!=='string'||v.includes('\0'))||!t.env||typeof t.env!=='object'||Array.isArray(t.env)||Object.hasOwn(t.env,'CLAUDE_CONFIG_DIR')||Object.hasOwn(t.env,'ANTHROPIC_AUTH_TOKEN')||t.env.CLAUDE_SECURESTORAGE_CONFIG_DIR!==c.secureStorageDirectory||Object.entries(t.env).some(([k,v])=>! /^[a-zA-Z_][a-zA-Z0-9_]*$/u.test(k)||typeof v!=='string'||v.includes('\0'))||Buffer.byteLength(JSON.stringify(t))>131072)refuse();
 const forbidden=new Set(['DATABASE_URL','PGPASSWORD','ANTHROPIC_API_KEY','CLAUDE_CODE_OAUTH_TOKEN','ANTHROPIC_AWS_BEARER_TOKEN','ANTHROPIC_AWS_REGION','TEMPORAL_API_KEY','MERI_NATIVE_ADMIN_TOKEN','CLAUDE_CODE_USE_BEDROCK','CLAUDE_CODE_USE_VERTEX','CLAUDE_CODE_USE_FOUNDRY']);
 if(Object.keys(t.env).some(k=>/^(AWS_|GOOGLE_|GCP_|AZURE_|OPENAI_)/u.test(k)||forbidden.has(k)))refuse();
 // TLS trust is never an arbitrary path: only the pinned runner CA, and no other trust-store override.
 if(Object.hasOwn(t.env,'NODE_EXTRA_CA_CERTS')&&t.env.NODE_EXTRA_CA_CERTS!==RUNNER_SDK_CA_FILE||['NODE_OPTIONS','NODE_TLS_REJECT_UNAUTHORIZED','SSL_CERT_FILE','SSL_CERT_DIR','CLAUDE_CODE_CERT_STORE'].some(k=>Object.hasOwn(t.env,k)))refuse();
 runLaunchArgs(t.args,c.workspace); // a misplaced or malformed run-workspace placeholder refuses here, before any launch
 return c;
}
/** G3: the run workspace inside the `--settings` launch argument. Workspace tools pre-approve exactly this run's workspace through
 * `settings.permissions.allow` (apps/worker/conversation/capabilities/workspace-tools.mjs workspaceRule: `Read(/<workspace>/**)` and
 * `Edit(/<workspace>/**)`), and the pinned SDK serializes `settings` as the JSON token after `--settings`, so that one argument names
 * the run's workspace. The configured launch template carries LAUNCH_WORKSPACE_PLACEHOLDER in those rules instead (launchTemplateArgs,
 * applied by the in-image measurement); a run's launch is the template with exactly its own intent.workspace put back (runLaunchArgs,
 * via preparedLaunchTemplate), mirroring continuationLaunchArgs. The descriptor match then still compares every byte of every
 * argument: a `--settings` naming any other workspace, any other rule or any other changed byte refuses (PREPARATION_REFUSED). A
 * template without the placeholder (every run without workspace tools) is used unchanged. */
export const LAUNCH_WORKSPACE_PLACEHOLDER='[run workspace]';
const SETTINGS_FLAG='--settings',RULE_TOOLS=Object.freeze(['Read','Edit']);
/** The `--settings` JSON token with its allow rules for workspace `from` (exactly the workspace rules, nothing else) rewritten for `to`.
 * The token must be the canonical JSON.stringify bytes the SDK emits, so the rewrite changes nothing but the workspace. */
function placeWorkspace(token,from,to){
 let s;try{s=JSON.parse(token);}catch{refuse();}
 if(s===null||typeof s!=='object'||Array.isArray(s)||JSON.stringify(s)!==token)refuse();
 const p=s.permissions;if(p===null||typeof p!=='object'||Array.isArray(p)||!Array.isArray(p.allow)||!p.allow.length)refuse();
 const allow=p.allow.map(rule=>{const tool=RULE_TOOLS.find(t=>rule===`${t}(/${from}/**)`);if(tool===undefined)refuse();return `${tool}(/${to}/**)`;});
 const out=JSON.stringify({...s,permissions:{...p,allow}});if(out.includes(from))refuse();return out;
}
/** Rewrites the one `--settings` token that names `from`; `from` anywhere else (another argument, a `--settings=` form) refuses. */
function placeLaunchWorkspace(args,from,to){
 if(!Array.isArray(args)||args.some(a=>typeof a!=='string'))refuse();
 const at=args.indexOf(SETTINGS_FLAG)+1;if(args.some((a,i)=>a.includes(from)&&(i!==at||at===0)))refuse();
 return at>0&&args[at]?.includes(from)?args.map((a,i)=>i===at?placeWorkspace(a,from,to):a):[...args];
}
/** The configured launch template's arguments from a captured launch of a run with workspace `workspace` (the in-image measurement):
 * that run's workspace rules in `--settings` become the placeholder; a launch without them is unchanged. */
export function launchTemplateArgs(args,workspace){
 if(typeof workspace!=='string'||!workspace||args?.some?.(a=>typeof a==='string'&&a.includes(LAUNCH_WORKSPACE_PLACEHOLDER)))refuse();
 return placeLaunchWorkspace(args,workspace,LAUNCH_WORKSPACE_PLACEHOLDER);
}
/** A run's launch arguments from the configured template: exactly this run's workspace (intent.workspace) put back into `--settings`. */
export function runLaunchArgs(templateArgs,workspace){
 if(typeof workspace!=='string'||!workspace||workspace.includes(LAUNCH_WORKSPACE_PLACEHOLDER))refuse();
 return placeLaunchWorkspace(templateArgs,LAUNCH_WORKSPACE_PLACEHOLDER,workspace);
}
const credential=value=>typeof value==='string'&&/^\S{1,8192}$/u.test(value);
const sameSecret=(a,b)=>credential(a)&&credential(b)&&timingSafeEqual(createHash('sha256').update(a).digest(),createHash('sha256').update(b).digest());
/** The launch this run must present: the configured fresh template with exactly this run's workspace in `--settings` (runLaunchArgs) and
 * exactly the run's SDK continuation arguments where the SDK emits them (continuation-pin.mjs continuationLaunchArgs). `continuation` is
 * null for a fresh run, else the continuation option set the CALLER derived from its own source (control: its saved lineage; task: its
 * session mirror's restoration), never the descriptor. The workspace is the compiled intent's, never the descriptor's. */
export function preparedLaunchTemplate(intent,continuation=null){const i=compileNativePreparationIntent(intent);return data({...i.launchTemplate,args:continuationLaunchArgs(runLaunchArgs(i.launchTemplate.args,i.workspace),continuation)});}
function match(value,intent,verify,continuation){
 const i=compileNativePreparationIntent(intent),d=data(own(value,['command','args','cwd','env'])),env=d.env;
 if(!env||Array.isArray(env)||!absolute(env.CLAUDE_CONFIG_DIR)||dirname(env.CLAUDE_CONFIG_DIR)!==i.configParentDirectory||d.cwd!==i.workspace||!verify(env.ANTHROPIC_AUTH_TOKEN))refuse();
 const {CLAUDE_CONFIG_DIR:ignored,ANTHROPIC_AUTH_TOKEN:verified,...fixed}=env;
 if(hash({command:d.command,args:d.args,env:fixed})!==hash(preparedLaunchTemplate(i,continuation)))refuse();
 return d;
}
/** Trusted preparation: the per-task proxy credential is excluded from the static template and verified only against the issuer's exact value supplied by the caller; the configured template never carries it. */
export function matchPreparedDescriptor(value,intent,proxyCredential,continuation=null){if(!credential(proxyCredential))refuse();return match(value,intent,presented=>sameSecret(presented,proxyCredential),continuation);}
/** Untrusted task-side pre-check before the preparation authority sees the descriptor: the same shape checks with only a well-formed credential value present; exactness is the authority's check. */
export function matchPreparedDescriptorShape(value,intent,continuation=null){return match(value,intent,credential,continuation);}
