/** Pure production configuration for the pinned Temporal 1.32.1 server. */
import {TEMPORAL_MIGRATION_PLAN_SHA256} from './temporal-migration-plan.mjs';
const SERVER_DIGEST='sha256:2695f2564ec51aa84232bf3fa59b31e2cce99bec437a64f5bc487cbe21b2de0e';
const SERVICE_ROLE=Object.freeze({frontend:'frontend',history:'history',matching:'matching','internal-worker':'worker','internal-frontend':'internal-frontend'});
const ROLE_PORTS=Object.freeze({frontend:[7233,6933,7243],history:[7234,6934],matching:[7235,6935],worker:[7239,6939],'internal-frontend':[7236,6936,7246]});
const fail=()=>{throw Error('TEMPORAL_LAUNCH_REFUSED');};
const dns=/^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,}$/u;
const hex64=/^[a-f0-9]{64}$/u;
const pem=(value,label)=>{
 if(typeof value!=='string'||value.length<80||value.length>32768||
    !value.startsWith(`-----BEGIN ${label}-----\n`)||!value.trimEnd().endsWith(`-----END ${label}-----`))fail();
 return value;
};
const required=(env,key,pattern)=>{const v=env[key];if(typeof v!=='string'||!pattern.test(v))fail();return v;};
const exact=(env,key,value)=>{if(env[key]!==value)fail();};
const path=(value)=>{if(typeof value!=='string'||!/^\/run\/temporal\/launch-[a-zA-Z0-9_-]+\/[a-z-]+\.pem$/u.test(value))fail();return value;};

/** Validate only data needed to render; never echo input or credentials in an error. */
export function validateTemporalLaunch(env,argv){
 if(!env||typeof env!=='object'||!Array.isArray(argv)||argv.length!==1)fail();
 const service=required(env,'MERI_TEMPORAL_SERVICE_NAME',/^(?:frontend|history|matching|internal-worker|internal-frontend)$/u);
 const role=SERVICE_ROLE[service];
 if(argv[0]!==role||env.MERI_TEMPORAL_ROLE!==role)fail();
 exact(env,'MERI_TEMPORAL_ACTIVATION','approved');
 exact(env,'MERI_TEMPORAL_PREVIEW_REQUIRED','1');
 exact(env,'MERI_TEMPORAL_UPSTREAM_IMAGE_DIGEST',SERVER_DIGEST);
 required(env,'MERI_TEMPORAL_LAUNCH_CONTRACT_SHA256',hex64);
 const commit=required(env,'MERI_TEMPORAL_LAUNCH_SOURCE_COMMIT',/^[a-f0-9]{40}$/u);
 exact(env,'MERI_TEMPORAL_IMAGE_SOURCE_COMMIT',commit);
 exact(env,'MERI_TEMPORAL_RENDER_DIR','/run/temporal');
 if(env.NODE_TLS_REJECT_UNAUTHORIZED==='0')fail();
 exact(env,'DB','postgres12');exact(env,'DB_PORT','5432');
 exact(env,'DBNAME','temporal');exact(env,'VISIBILITY_DBNAME','temporal_visibility');
 exact(env,'NUM_HISTORY_SHARDS','128');
 exact(env,'SQL_TLS_ENABLED','true');exact(env,'SQL_HOST_VERIFICATION','true');
 exact(env,'TEMPORAL_TLS_REQUIRE_CLIENT_AUTH','true');
 exact(env,'TEMPORAL_TLS_INTERNODE_DISABLE_HOST_VERIFICATION','false');
 exact(env,'TEMPORAL_TLS_FRONTEND_DISABLE_HOST_VERIFICATION','false');
 exact(env,'TEMPORAL_AUTH_AUTHORIZER','default');exact(env,'TEMPORAL_AUTH_CLAIM_MAPPER','default');
 exact(env,'TEMPORAL_AUTH_AUDIENCE','meri-temporal');
 exact(env,'TEMPORAL_JWT_KEY_REFRESH','300s');
 exact(env,'USE_INTERNAL_FRONTEND','true');
 exact(env,'TEMPORAL_NAMESPACE','meri');
 const queue=required(env,'TEMPORAL_TASK_QUEUE',/^[a-zA-Z0-9._-]{1,128}$/u);
 const databaseHost=required(env,'POSTGRES_SEEDS',dns);
 exact(env,'VISIBILITY_POSTGRES_SEEDS',databaseHost);exact(env,'SQL_HOST_NAME',databaseHost);
 const frontendName=required(env,'TEMPORAL_TLS_FRONTEND_SERVER_NAME',dns);
 const internodeName=required(env,'TEMPORAL_TLS_INTERNODE_SERVER_NAME',dns);
 if(!frontendName.startsWith('frontend.')||internodeName!==`internode.${frontendName.slice('frontend.'.length)}`)fail();
 const issuer=required(env,'TEMPORAL_AUTH_ISSUER',/^https:\/\/[a-z0-9.-]+:8445\/$/u);
 const jwks=required(env,'TEMPORAL_JWT_KEY_SOURCE1',/^https:\/\/[a-z0-9.-]+:8445\/\.well-known\/jwks\.json$/u);
 if(new URL(jwks).origin!==new URL(issuer).origin)fail();
 const conns=service==='history'?20:10;
 for(const key of ['SQL_MAX_CONNS','SQL_MAX_IDLE_CONNS','SQL_VIS_MAX_CONNS','SQL_VIS_MAX_IDLE_CONNS'])exact(env,key,String(conns));
 const primaryUser=required(env,'POSTGRES_USER',/^[a-z][a-z0-9_]{0,62}$/u);
 const visibilityUser=required(env,'VISIBILITY_POSTGRES_USER',/^[a-z][a-z0-9_]{0,62}$/u);
 exact(env,'MERI_TEMPORAL_PRIMARY_USERNAME_EXPECTED',primaryUser);
 exact(env,'MERI_TEMPORAL_VISIBILITY_USERNAME_EXPECTED',visibilityUser);
 if(primaryUser===visibilityUser||!env.POSTGRES_PWD||!env.VISIBILITY_POSTGRES_PWD||env.POSTGRES_PWD===env.VISIBILITY_POSTGRES_PWD)fail();
 for(const key of ['POSTGRES_PWD','VISIBILITY_POSTGRES_PWD'])if(typeof env[key]!=='string'||env[key].length>4096)fail();
 required(env,'MERI_TEMPORAL_RDS_CA_SHA256',hex64);
 required(env,'MERI_TEMPORAL_ISSUER_CA_SHA256',hex64);
 exact(env,'MERI_TEMPORAL_MIGRATION_PLAN_SHA256',TEMPORAL_MIGRATION_PLAN_SHA256);
 pem(env.MERI_TEMPORAL_INTERNODE_CERT_PEM,'CERTIFICATE');
 pem(env.MERI_TEMPORAL_INTERNODE_KEY_PEM,'PRIVATE KEY');
 pem(env.MERI_TEMPORAL_INTERNODE_CA_PEM,'CERTIFICATE');
 pem(env.MERI_TEMPORAL_FRONTEND_CA_PEM,'CERTIFICATE');
 pem(env.MERI_TEMPORAL_RDS_CA_PEM,'CERTIFICATE');
 if(service==='frontend'){
  pem(env.MERI_TEMPORAL_FRONTEND_CERT_PEM,'CERTIFICATE');
  pem(env.MERI_TEMPORAL_FRONTEND_KEY_PEM,'PRIVATE KEY');
  pem(env.MERI_TEMPORAL_CLIENT_CA_PEM,'CERTIFICATE');
 }else if(['MERI_TEMPORAL_FRONTEND_CERT_PEM','MERI_TEMPORAL_FRONTEND_KEY_PEM','MERI_TEMPORAL_CLIENT_CA_PEM'].some(key=>env[key]!==undefined))fail();
 return Object.freeze({service,role,queue,databaseHost,frontendName,internodeName,issuer,jwks,conns,primaryUser,visibilityUser});
}

/** JSON is a YAML 1.2 flow document; this also avoids scalar-injection ambiguity. */
export function renderTemporalConfig(env,argv,broadcastAddress,files){
 const v=validateTemporalLaunch(env,argv);
 if(typeof broadcastAddress!=='string'||!/^10\.(?:\d{1,3}\.){2}\d{1,3}$|^172\.(?:1[6-9]|2\d|3[01])\.(?:\d{1,3}\.)\d{1,3}$|^192\.168\.(?:\d{1,3}\.)\d{1,3}$/u.test(broadcastAddress)||
    broadcastAddress.split('.').some(x=>Number(x)>255))fail();
 if(!files||typeof files!=='object')fail();
 const f={rdsCa:path(files.rdsCa),internodeCert:path(files.internodeCert),internodeKey:path(files.internodeKey),
  internodeCa:path(files.internodeCa),frontendCa:path(files.frontendCa)};
 if(v.service==='frontend'){
  f.frontendCert=path(files.frontendCert);f.frontendKey=path(files.frontendKey);f.clientCa=path(files.clientCa);
 }
 const sql=(name,user,password)=>({pluginName:'postgres12',databaseName:name,connectAddr:`${v.databaseHost}:5432`,
  connectProtocol:'tcp',user,password,maxConns:v.conns,maxIdleConns:v.conns,maxConnLifetime:'1h',
  tls:{enabled:true,caFile:f.rdsCa,enableHostVerification:true,serverName:v.databaseHost}});
 const rpc=(name)=>({grpcPort:ROLE_PORTS[name][0],membershipPort:ROLE_PORTS[name][1],bindOnIP:'0.0.0.0',
  ...(ROLE_PORTS[name][2]?{httpPort:ROLE_PORTS[name][2]}:{})});
 const frontendServer=v.service==='frontend'?{server:{requireClientAuth:true,certFile:f.frontendCert,keyFile:f.frontendKey,
  clientCaFiles:[f.clientCa,f.internodeCa]}}:{};
 const config={
  log:{stdout:true,level:'info'},
  persistence:{numHistoryShards:128,defaultStore:'default',visibilityStore:'visibility',datastores:{
   default:{sql:sql('temporal',v.primaryUser,env.POSTGRES_PWD)},
   visibility:{sql:sql('temporal_visibility',v.visibilityUser,env.VISIBILITY_POSTGRES_PWD)}}},
  global:{membership:{maxJoinDuration:'30s',broadcastAddress},
   tls:{internode:{server:{requireClientAuth:true,certFile:f.internodeCert,keyFile:f.internodeKey,clientCaFiles:[f.internodeCa]},
     client:{serverName:v.internodeName,disableHostVerification:false,rootCaFiles:[f.internodeCa]}},
    frontend:{...frontendServer,client:{serverName:v.frontendName,disableHostVerification:false,rootCaFiles:[f.frontendCa]}}},
   authorization:{jwtKeyProvider:{keySourceURIs:[v.jwks],refreshInterval:'300s'},permissionsClaimName:'permissions',
    authorizer:'default',claimMapper:'default',audience:'meri-temporal'}},
  services:{frontend:{rpc:rpc('frontend')},'internal-frontend':{rpc:rpc('internal-frontend')},
   history:{rpc:rpc('history')},matching:{rpc:rpc('matching')},worker:{rpc:rpc('worker')}},
  clusterMetadata:{enableGlobalNamespace:false,failoverVersionIncrement:10,masterClusterName:'active',currentClusterName:'active',
   clusterInformation:{active:{enabled:true,initialFailoverVersion:1,rpcName:'frontend',
    rpcAddress:`${v.frontendName}:7233`,httpAddress:`${v.frontendName}:7243`}}},
  dcRedirectionPolicy:{policy:'noop'},
  archival:{history:{state:'disabled'},visibility:{state:'disabled'}},
  namespaceDefaults:{archival:{history:{state:'disabled'},visibility:{state:'disabled'}}}
 };
 return JSON.stringify(config,null,2)+'\n';
}
