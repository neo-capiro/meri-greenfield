import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {writeFileSync,readFileSync} from 'node:fs';
import {createCrossRepoMeriFixture} from '../../../../../apps/control/action-host/application-adapters/cross-repo/meri-fixture.mjs';
const root=process.cwd(),packet='docs/qualification/candidates/capiro-endpoint-integration-20261013/author/',base='a0614e7e16d6f92d0ca6eaa192cea7c5def21ec8';
const git=(...args)=>execFileSync('git',['-c','gc.auto=0',...args],{cwd:root,encoding:'utf8',timeout:10000,maxBuffer:8*1024*1024});
const tree=ref=>new Map(git('ls-tree','-r','-z',ref).split('\0').filter(Boolean).map(row=>{const [meta,path]=row.split('\t');return[path,meta];}));
const original=tree(base),current=tree('HEAD'),allowed=new Set(['apps/control/action-host/application-adapters/README.md','apps/control/action-host/application-adapters/authority-http.mjs']);
let unchanged=0;for(const[path,identity]of original){if(allowed.has(path))continue;assert.equal(current.get(path),identity,path);unchanged++;}
const old=git('show',base+':apps/control/action-host/application-adapters/authority-http.mjs'),next=readFileSync('apps/control/action-host/application-adapters/authority-http.mjs','utf8');assert.equal(next,old.replace('for the proposed Capiro authority bridge.','for the Capiro authority bridge.'));
const fixture=await createCrossRepoMeriFixture({sourceRepository:process.env.CAPIRO_SOURCE_REPOSITORY??'/tmp/capiro-endpoint-integration-source-20261013.git',typescriptModulePath:process.env.MERI_TYPESCRIPT_MODULE??'/workspace/meri-read-continuation-20261012/packages/contracts/node_modules/typescript/lib/typescript.js'});
let metadata;try{metadata=fixture.native.sourceMetadata();assert.equal(fixture.native.stats().requests,0);assert.equal(metadata.sourceMembers.length,19);assert.ok(metadata.selections.length>10);}finally{fixture.close();}
writeFileSync(packet+'source-identities.json',JSON.stringify(metadata,null,2)+'\n');
const sourceFiles=git('ls-files','apps/control/action-host/application-adapters/cross-repo').trim().split('\n');
const source=sourceFiles.map(path=>{const bytes=readFileSync(path);return{path,bytes:bytes.length,sha256:createHash('sha256').update(bytes).digest('hex')};});
const receipt={base,sourceFreeze:git('rev-parse','9063f707').trim(),docsFreeze:git('rev-parse','HEAD').trim(),originalEntries:original.size,unchangedOriginalEntries:unchanged,allocatedExistingChanges:[...allowed],commentOnlyTransportChange:true,pinnedFiles:metadata.sourceMembers.length,exactAstSelections:metadata.selections.length,constructorSourceRequests:0,source,checksPassed:true,scope:'SOURCE_ONLY_MOCKED_EXTERNAL_PORTS_NOT_NATIVE_QUALIFICATION'};
writeFileSync(packet+'audit.json',JSON.stringify(receipt,null,2)+'\n');console.log(JSON.stringify({checksPassed:true,originalEntries:original.size,unchangedOriginalEntries:unchanged,pinnedFiles:metadata.sourceMembers.length,exactAstSelections:metadata.selections.length}));
