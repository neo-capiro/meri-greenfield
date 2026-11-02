/** Validated configuration of ONE provisioned browser-only host from the protected installed bundle the bootstrap program
 * wrote (`native-processing-host/protected-bootstrap.mjs`): the same bundle, TLS pairs, reviewed profile pins and live
 * physical identity the native host reads, plus the browser host's own fixed layout. Nothing here comes from the
 * environment, a request or a tool; a bundle whose allocation is not browser-only refuses. */
import {installedHostMaterial,PROTECTED_HELPER} from '../native-processing-host/protected-bootstrap.mjs';
import {PLAYWRIGHT_MCP_VERSION} from '../../worker/conversation/browser/policy.mjs';

const REFUSED='BROWSER_HOST_INSTALLED_REFUSED';
const fault=()=>{throw Object.assign(new Error(REFUSED),{code:REFUSED});};
const BROWSER_HOST_LAYOUT_KIND='browser-host';
/** The relay helper the network owner's host-veth relay port spawns; fixed like the launcher helper. */
export const BROWSER_HOST_RELAY_HELPER='/opt/meri/meri-host-relay-launcher';
const LIMITS=Object.freeze({deadlineMaxMs:[1000,60000],maxFreshMs:[1000,30000],localSettleMs:[1000,120000]});
const IDENTITIES=Object.freeze(['sdk','browser','hostRelay','localRelay']);
const INTERFACE=/^[a-z][a-z0-9]{1,14}$/u;
const absolute=value=>{
 if(typeof value!=='string'||!value.startsWith('/')||value.includes('..')||value.includes('\0')||value.length>1024||value.endsWith('/'))fault();
 return value;
};
const id=value=>{if(!Number.isSafeInteger(value)||value<1000||value>65533)fault();return value;};
const port=value=>{if(!Number.isSafeInteger(value)||value<1024||value>65535)fault();return value;};

/** The fixed browser layout of the reviewed profile: finite limits, image paths, distinct unprivileged identities and
 * the private network facts the compartment needs. The helper path is the one protected executable. */
export function validateBrowserHostLayout(layout){
 if(layout===null||typeof layout!=='object'||layout.kind!==BROWSER_HOST_LAYOUT_KIND||layout.limits===null||typeof layout.limits!=='object'||
  layout.paths===null||typeof layout.paths!=='object'||layout.identities===null||typeof layout.identities!=='object'||
  layout.network===null||typeof layout.network!=='object')fault();
 const limits={};
 for(const [key,[min,max]] of Object.entries(LIMITS)){
  const value=layout.limits[key];
  if(!Number.isSafeInteger(value)||value<min||value>max)fault();
  limits[key]=value;
 }
 const p=layout.paths;
 if(p.helperPath!==PROTECTED_HELPER||p.hostRelayHelperPath!==BROWSER_HOST_RELAY_HELPER)fault();   // the layout cannot select other executables
 if(typeof p.cliPath!=='string'||!p.cliPath.endsWith('/cli.js'))fault();
 const paths=Object.freeze({helperPath:absolute(p.helperPath),hostRelayHelperPath:absolute(p.hostRelayHelperPath),nodePath:absolute(p.nodePath),
  cliPath:absolute(p.cliPath),browsersPath:absolute(p.browsersPath),workspaceRoot:absolute(p.workspaceRoot)});
 const identities={};
 for(const name of IDENTITIES){
  const value=layout.identities[name];
  if(value===null||typeof value!=='object')fault();
  identities[name]=Object.freeze({uid:id(value.uid),gid:id(value.gid)});
 }
 if(new Set(IDENTITIES.map(name=>identities[name].uid)).size!==IDENTITIES.length)fault();   // every identity is its own uid
 const n=layout.network;
 if(typeof n.privateInterfaceName!=='string'||!INTERFACE.test(n.privateInterfaceName))fault();
 const network=Object.freeze({privateInterfaceName:n.privateInterfaceName,browserProxyPort:port(n.browserProxyPort)});
 return Object.freeze({limits:Object.freeze(limits),paths,identities:Object.freeze(identities),network});
}

/** Complete validated browser host configuration: shared installed material plus the browser layout. */
export function installedBrowserHostConfig(options={}){
 const m=installedHostMaterial(options);
 if(m.allocation.hostMode!=='browser-only')fault();
 const layout=validateBrowserHostLayout(m.profile.layout);
 const {profile,...shared}=m;
 return Object.freeze({...shared,...layout,
  installation:Object.freeze({nodePath:layout.paths.nodePath,cliPath:layout.paths.cliPath,browsersPath:layout.paths.browsersPath,
   version:PLAYWRIGHT_MCP_VERSION,egressProxy:`http://127.0.0.1:${layout.network.browserProxyPort}`}),
  cwd:`${layout.paths.workspaceRoot}/${m.allocation.conversationId}`});
}
