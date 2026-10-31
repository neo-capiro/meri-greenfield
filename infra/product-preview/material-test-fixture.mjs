/** Synthetic static material fixture; no credential issuer or service is called. */
import {createHash} from 'node:crypto';
import {agentcoreControlFixture} from '../../apps/runtime/test/agentcore-fixture.mjs';
import {canonicalSha256} from '../../packages/contracts/validate.mjs';
import {compileProductMaterialPlan} from './material-delivery.mjs';

export const runtimeUser='1000:1000',materialRoot='/run/meri/';
export function controlMaterialConfiguration(){
 const c=structuredClone(agentcoreControlFixture().configuration);
 c.native.capabilityFile=materialRoot+'control-capability';c.database.connectionFile=materialRoot+'database-url';
 c.privateHttp={hostname:'0.0.0.0',port:8082,frontendOrigin:c.native.origin};
 c.temporal.tls={caFile:materialRoot+'temporal-ca',certFile:materialRoot+'temporal-cert',keyFile:materialRoot+'temporal-key'};
 return c;
}
export function workerMaterialConfiguration(){
 const c=controlMaterialConfiguration();delete c.database;delete c.sessions;delete c.versions;delete c.agentcore;delete c.privateHttp;delete c.models;
 c.native={...c.native,preparedKickoff:true};c.http.port=8081;return c;
}
export function staticMaterialFixture(role='control',configuration=role==='control'?controlMaterialConfiguration():workerMaterialConfiguration()){
 const plan=compileProductMaterialPlan({role,configuration,runtimeUser}),files=plan.requiredFiles.map(file=>({path:file.path,
  base64:Buffer.from(file.path===plan.configurationPath?JSON.stringify(configuration):'synthetic-static-material:'+file.path).toString('base64')}));
 const contract={schemaVersion:1,role,runtimeUser,sourceCommit:'1'.repeat(40),imageDigest:'sha256:'+'2'.repeat(64),
  sha256ByPath:Object.fromEntries(files.map(file=>[file.path,createHash('sha256').update(Buffer.from(file.base64,'base64')).digest('hex')]))};
 return {configuration,plan,expected:{...contract,materialContractSha256:canonicalSha256(contract)},bundle:{files}};
}
