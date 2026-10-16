import test from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {renderTemporalConfig} from './temporal-launch-render.mjs';
import {readTaskEniAddress,checkIssuerJwks,checkCa} from './temporal-launch-main.mjs';
import {rootCertificates} from 'node:tls';
import {X509Certificate} from 'node:crypto';
import {TEMPORAL_MIGRATION_PLAN_SHA256} from './temporal-migration-plan.mjs';

const cert='-----BEGIN CERTIFICATE-----\n'+'A'.repeat(80)+'\n-----END CERTIFICATE-----\n';
const key='-----BEGIN PRIVATE KEY-----\n'+'B'.repeat(80)+'\n-----END PRIVATE KEY-----\n';
const sha='a'.repeat(64),commit='b'.repeat(40);
function env(service='frontend'){
 const role=service==='internal-worker'?'worker':service,conns=service==='history'?'20':'10';
 return {MERI_TEMPORAL_SERVICE_NAME:service,MERI_TEMPORAL_ROLE:role,MERI_TEMPORAL_ACTIVATION:'approved',
  MERI_TEMPORAL_PREVIEW_REQUIRED:'1',MERI_TEMPORAL_UPSTREAM_IMAGE_DIGEST:'sha256:2695f2564ec51aa84232bf3fa59b31e2cce99bec437a64f5bc487cbe21b2de0e',
  MERI_TEMPORAL_LAUNCH_CONTRACT_SHA256:sha,MERI_TEMPORAL_LAUNCH_SOURCE_COMMIT:commit,MERI_TEMPORAL_IMAGE_SOURCE_COMMIT:commit,
  MERI_TEMPORAL_RENDER_DIR:'/run/temporal',DB:'postgres12',DB_PORT:'5432',DBNAME:'temporal',VISIBILITY_DBNAME:'temporal_visibility',
  NUM_HISTORY_SHARDS:'128',SQL_TLS_ENABLED:'true',SQL_HOST_VERIFICATION:'true',TEMPORAL_TLS_REQUIRE_CLIENT_AUTH:'true',
  TEMPORAL_TLS_INTERNODE_DISABLE_HOST_VERIFICATION:'false',TEMPORAL_TLS_FRONTEND_DISABLE_HOST_VERIFICATION:'false',
  TEMPORAL_AUTH_AUTHORIZER:'default',TEMPORAL_AUTH_CLAIM_MAPPER:'default',TEMPORAL_AUTH_AUDIENCE:'meri-temporal',
  TEMPORAL_JWT_KEY_REFRESH:'300s',USE_INTERNAL_FRONTEND:'true',TEMPORAL_NAMESPACE:'meri',TEMPORAL_TASK_QUEUE:'meri-conversations',
  POSTGRES_SEEDS:'temporal-db.meri.internal',VISIBILITY_POSTGRES_SEEDS:'temporal-db.meri.internal',SQL_HOST_NAME:'temporal-db.meri.internal',
  TEMPORAL_TLS_FRONTEND_SERVER_NAME:'frontend.temporal.meri.internal',TEMPORAL_TLS_INTERNODE_SERVER_NAME:'internode.temporal.meri.internal',
  TEMPORAL_AUTH_ISSUER:'https://issuer.meri.internal/',TEMPORAL_JWT_KEY_SOURCE1:'https://issuer.meri.internal/.well-known/jwks.json',
  SQL_MAX_CONNS:conns,SQL_MAX_IDLE_CONNS:conns,SQL_VIS_MAX_CONNS:conns,SQL_VIS_MAX_IDLE_CONNS:conns,
  POSTGRES_USER:'temporal_user',POSTGRES_PWD:'synthetic-primary',VISIBILITY_POSTGRES_USER:'visibility_user',VISIBILITY_POSTGRES_PWD:'synthetic-visibility',
  MERI_TEMPORAL_PRIMARY_USERNAME_EXPECTED:'temporal_user',MERI_TEMPORAL_VISIBILITY_USERNAME_EXPECTED:'visibility_user',
  MERI_TEMPORAL_RDS_CA_SHA256:sha,MERI_TEMPORAL_ISSUER_CA_SHA256:sha,MERI_TEMPORAL_MIGRATION_PLAN_SHA256:TEMPORAL_MIGRATION_PLAN_SHA256,MERI_TEMPORAL_INTERNODE_CERT_PEM:cert,
  MERI_TEMPORAL_INTERNODE_KEY_PEM:key,MERI_TEMPORAL_INTERNODE_CA_PEM:cert,MERI_TEMPORAL_FRONTEND_CA_PEM:cert,
  MERI_TEMPORAL_RDS_CA_PEM:cert,
  ...(service==='frontend'?{MERI_TEMPORAL_FRONTEND_CERT_PEM:cert,MERI_TEMPORAL_FRONTEND_KEY_PEM:key,MERI_TEMPORAL_CLIENT_CA_PEM:cert}:{})};
}
function files(frontend=true){
 const prefix='/run/temporal/launch-test/';return {rdsCa:prefix+'rds-ca.pem',internodeCert:prefix+'internode-cert.pem',
  internodeKey:prefix+'internode-key.pem',internodeCa:prefix+'internode-ca.pem',frontendCa:prefix+'frontend-ca.pem',
  ...(frontend?{frontendCert:prefix+'frontend-cert.pem',frontendKey:prefix+'frontend-key.pem',clientCa:prefix+'client-ca.pem'}:{})};
}
const rendered=(service='frontend')=>JSON.parse(renderTemporalConfig(env(service),[service==='internal-worker'?'worker':service],
 '10.4.8.12',files(service==='frontend')));

test('complete frontend config binds two SQL stores, ENI membership, reachable frontend, mTLS and audience',()=>{
 const c=rendered();
 assert.equal(c.persistence.numHistoryShards,128);
 assert.equal(c.persistence.datastores.default.sql.databaseName,'temporal');
 assert.equal(c.persistence.datastores.visibility.sql.databaseName,'temporal_visibility');
 assert.notEqual(c.persistence.datastores.default.sql.user,c.persistence.datastores.visibility.sql.user);
 assert.equal(c.persistence.datastores.default.sql.tls.enableHostVerification,true);
 assert.equal(c.global.membership.broadcastAddress,'10.4.8.12');
 assert.equal(c.clusterMetadata.clusterInformation.active.rpcAddress,'frontend.temporal.meri.internal:7233');
 assert.equal(c.global.authorization.audience,'meri-temporal');
 assert.equal(c.global.authorization.authorizer,'default');
 assert.equal(c.global.authorization.claimMapper,'default');
 assert.deepEqual(c.global.tls.frontend.server.clientCaFiles,[files().clientCa,files().internodeCa]);
 assert.equal(c.global.tls.internode.server.requireClientAuth,true);
 assert.equal(c.archival.history.state,'disabled');assert.equal(c.archival.visibility.state,'disabled');
 assert(!JSON.stringify(c).includes('127.0.0.1'));
});

test('internal worker renders only internode server key and exact worker role',()=>{
 const c=rendered('internal-worker');
 assert.equal(c.services.worker.rpc.grpcPort,7239);
 assert.equal(c.global.tls.frontend.server,undefined);
 assert.equal(c.global.tls.frontend.client.serverName,'frontend.temporal.meri.internal');
});

test('activation, role, issuer, SQL, cert scope and broadcast contradictions fail closed',()=>{
 const changes=[
  x=>{x.MERI_TEMPORAL_ACTIVATION='disabled';},x=>{x.MERI_TEMPORAL_ROLE='worker';},
  x=>{x.TEMPORAL_AUTH_AUDIENCE='';},x=>{x.TEMPORAL_AUTH_CLAIM_MAPPER='';},
  x=>{x.TEMPORAL_JWT_KEY_SOURCE1='https://foreign.invalid/.well-known/jwks.json';},
  x=>{x.SQL_HOST_VERIFICATION='false';},x=>{x.POSTGRES_USER=x.VISIBILITY_POSTGRES_USER;},
  x=>{x.MERI_TEMPORAL_PRIMARY_USERNAME_EXPECTED='other_user';},
  x=>{x.MERI_TEMPORAL_VISIBILITY_USERNAME_EXPECTED='other_user';},
  x=>{x.MERI_TEMPORAL_MIGRATION_PLAN_SHA256=sha;},
  x=>{x.MERI_TEMPORAL_INTERNODE_KEY_PEM='';},x=>{x.MERI_TEMPORAL_IMAGE_SOURCE_COMMIT='';}
 ];
 for(const change of changes){const e=env();change(e);assert.throws(()=>renderTemporalConfig(e,['frontend'],'10.4.8.12',files()),/TEMPORAL_LAUNCH_REFUSED/u);}
 for(const ip of ['127.0.0.1','169.254.1.1','8.8.8.8','10.999.1.1'])
  assert.throws(()=>renderTemporalConfig(env(),['frontend'],ip,files()),/TEMPORAL_LAUNCH_REFUSED/u);
 const other=env('history');other.MERI_TEMPORAL_FRONTEND_KEY_PEM=key;
 assert.throws(()=>renderTemporalConfig(other,['history'],'10.4.8.12',files(false)),/TEMPORAL_LAUNCH_REFUSED/u);
});

test('ENI and JWKS preflight accept one scoped response and reject ambiguity',async()=>{
 const e=env(),metadata={Family:'meri-product-preview-temporal-frontend',Containers:[{Name:'frontend',Networks:[{
  NetworkMode:'awsvpc',IPv4Addresses:['10.4.8.12']}]}]};
 const fetcher=async()=>new Response(JSON.stringify(metadata),{status:200});
 e.ECS_CONTAINER_METADATA_URI_V4='http://169.254.170.2/v4/task-id';
 assert.equal(await readTaskEniAddress(e,fetcher),'10.4.8.12');
 const trusted=rootCertificates.map(pem=>new X509Certificate(pem)).find(c=>
  c.ca&&c.publicKey.asymmetricKeyType==='rsa'&&c.publicKey.asymmetricKeyDetails.modulusLength>=2048&&
  Date.parse(c.validFrom)<Date.now()&&Date.parse(c.validTo)>Date.now());
 assert(trusted);
 const jwk={...trusted.publicKey.export({format:'jwk'}),kid:'one',use:'sig',alg:'RS256'};
 const jwks=async()=>({keys:[jwk]});
 assert.equal(await checkIssuerJwks(e,jwks,cert),true);
 const bad={...metadata,Containers:[...metadata.Containers,...metadata.Containers]};
 await assert.rejects(readTaskEniAddress(e,async()=>new Response(JSON.stringify(bad))),/TEMPORAL_LAUNCH_REFUSED/u);
 await assert.rejects(checkIssuerJwks(e,async()=>({keys:[]}),cert),/TEMPORAL_LAUNCH_REFUSED/u);
 await assert.rejects(checkIssuerJwks(e,async()=>({keys:[{...jwk,n:'synthetic'}]}),cert),/TEMPORAL_LAUNCH_REFUSED/u);
 await assert.rejects(checkIssuerJwks(e,async()=>({keys:[{...jwk,kid:'bad',d:'private'}]}),cert),/TEMPORAL_LAUNCH_REFUSED/u);
 await assert.rejects(checkIssuerJwks(e,async()=>({keys:[jwk,jwk]}),cert),/TEMPORAL_LAUNCH_REFUSED/u);
 e.ECS_CONTAINER_METADATA_URI_V4='https://example.org/v4/task-id';
 await assert.rejects(readTaskEniAddress(e,fetcher),/TEMPORAL_LAUNCH_REFUSED/u);
});

test('CLI help and invalid role stop before configuration, metadata or server access',()=>{
 const path=fileURLToPath(new URL('./temporal-launch-main.mjs',import.meta.url));
 const help=spawnSync(process.execPath,[path,'--help'],{encoding:'utf8',env:{}});
 assert.equal(help.status,0);assert.match(help.stdout,/Usage: temporal-launch/u);
 const bad=spawnSync(process.execPath,[path,'all'],{encoding:'utf8',env:{}});
 assert.equal(bad.status,64);assert.equal(bad.stderr,'TEMPORAL_LAUNCH_USAGE\n');
});

test('public CA preflight requires a valid CA, including its not-before bound',()=>{
 const trusted=rootCertificates.find(pem=>{
  const cert=new X509Certificate(pem);return cert.ca&&Date.parse(cert.validFrom)<Date.now()&&Date.parse(cert.validTo)>Date.now();
 });
 assert(trusted);
 assert.doesNotThrow(()=>checkCa(trusted));
 const validFrom=Date.parse(new X509Certificate(trusted).validFrom);
 assert.throws(()=>checkCa(trusted,validFrom-1),/TEMPORAL_LAUNCH_REFUSED/u);
});
