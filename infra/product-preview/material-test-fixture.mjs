/** Synthetic static material fixture; no credential issuer or service is called. */
import {normalize} from 'node:path';
import {createHash} from 'node:crypto';
import {candidateFixture} from '../../apps/runtime/test/prepared-candidate-fixture.mjs';
import {canonicalSha256} from '../../packages/contracts/validate.mjs';
import {compileProductMaterialPlan} from './material-delivery.mjs';

export const runtimeUser='1000:1000',materialRoot='/run/meri/';
export function controlMaterialConfiguration(){
 const c=structuredClone(candidateFixture().configuration),n=c.nativeCandidate,i=n.preparationIntent;
 for(const key of ['workspace','configParentDirectory','secureStorageDirectory'])i[key]=normalize(i[key]);
 i.launchTemplate.command=normalize(i.launchTemplate.command);i.launchTemplate.env.CLAUDE_SECURESTORAGE_CONFIG_DIR=i.secureStorageDirectory;
 c.native.capabilityFile=materialRoot+'control-capability';c.database.connectionFile=materialRoot+'database-url';
 c.privateHttp={hostname:'0.0.0.0',port:8082,frontendOrigin:c.native.origin};
 n.taskOrigin=c.native.origin;n.taskHttp.frontendOrigin=c.native.origin;
 n.multiRun={runWindowMs:600000,materialDirectory:'/tmp/meri-material',dynamicInitialRuns:true};
 c.taskRouter={enabled:true,runnerCaFile:materialRoot+'runner-ca',zone:'tasks.meri.internal',vpcId:'vpc-1234abcd'};
 c.temporal.tls={caFile:materialRoot+'temporal-ca',certFile:materialRoot+'temporal-cert',keyFile:materialRoot+'temporal-key'};
 n.identity.credentialFile=materialRoot+'identity-capability';n.taskCapabilityFile=materialRoot+'task-capability';
 n.controlCapabilityFile=c.native.capabilityFile;n.proxyCredentialFile=materialRoot+'proxy-capability';return c;
}
export function workerMaterialConfiguration(){
 const c=controlMaterialConfiguration();delete c.database;delete c.sessions;delete c.versions;delete c.nativeCandidate;delete c.privateHttp;delete c.taskRouter;
 c.native={...c.native,preparedKickoff:true};c.http.port=8081;return c;
}
export function staticMaterialFixture(role='control',configuration=role==='control'?controlMaterialConfiguration():workerMaterialConfiguration()){
 const plan=compileProductMaterialPlan({role,configuration,runtimeUser}),files=plan.requiredFiles.map(file=>({path:file.path,
  base64:Buffer.from(file.path===plan.configurationPath?JSON.stringify(configuration):'synthetic-static-material:'+file.path).toString('base64')}));
 const contract={schemaVersion:1,role,runtimeUser,sourceCommit:'1'.repeat(40),imageDigest:'sha256:'+'2'.repeat(64),
  sha256ByPath:Object.fromEntries(files.map(file=>[file.path,createHash('sha256').update(Buffer.from(file.base64,'base64')).digest('hex')]))};
 return {configuration,plan,expected:{...contract,materialContractSha256:canonicalSha256(contract)},bundle:{files}};
}
