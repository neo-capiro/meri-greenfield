/** Purpose-isolated facade over the canonical file authority. Model and task may share an issuance key, never a file slot or ref.
 * Construction is inert. Only the future authorized owner calls generate; tests use synthetic ports, never real credentials. */
import {join,isAbsolute} from 'node:path';
import {own,data} from '../../packages/contracts/commands-0.2/execution-boundary.mjs';
import {createFileCapabilityAuthority} from './capability-material-authority.mjs';
const fail=()=>{throw Object.assign(Error('MODEL_MATERIAL_REFUSED'),{code:'MODEL_MATERIAL_REFUSED'});};
const raw=/^material:([a-f0-9]{64})$/u,model=/^model-material:v1:([a-f0-9]{64})$/u;
const modelRef=ref=>{const m=typeof ref==='string'&&raw.exec(ref);if(!m)fail();return 'model-material:v1:'+m[1];};
const taskRef=ref=>{const m=typeof ref==='string'&&model.exec(ref);if(!m)fail();return 'material:'+m[1];};
export function createModelMaterialAuthority({authority}){
 if(['generate','retrieve','status'].some(k=>typeof authority?.[k]!=='function'))fail();
 return Object.freeze({
  ...(typeof authority.directory==='string'?{directory:authority.directory}:{}),
  async generate(value){const r=data(own(await authority.generate(value),['grantId','capability','materialRef'])),ref=modelRef(r.materialRef);if(ref!=='model-material:v1:'+value.issuanceKey)fail();return {...r,materialRef:ref};},
  async retrieve(value){const v=own(value,['materialRef','grantId'],['signal']);return authority.retrieve({...v,materialRef:taskRef(v.materialRef)});},
  async status(value){const r=data(own(await authority.status(value),['state'],['grantId','capabilitySha256','materialRef']));
   if(r.state!=='PRESENT')return r;const ref=modelRef(r.materialRef);if(ref!=='model-material:v1:'+value.issuanceKey)fail();return {...r,materialRef:ref};},
 });
}
/** The existing task material directory remains unchanged; the model authority receives its distinct child directory. */
export function createFileModelMaterialAuthority({taskMaterialDirectory,now=Date.now}){
 if(typeof taskMaterialDirectory!=='string'||!isAbsolute(taskMaterialDirectory))fail();
 return createModelMaterialAuthority({authority:createFileCapabilityAuthority({directory:join(taskMaterialDirectory,'model-grants'),now})});
}
