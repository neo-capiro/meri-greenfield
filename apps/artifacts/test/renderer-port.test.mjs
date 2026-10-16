/** Qualified-renderer port: fail-closed states, admission shape, sandbox requirements and binding identity. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {createRendererPort,createLibreOfficeRendererPort,isRendererPort,admittedConverter,describeRenderer,RENDERER_SANDBOX_REQUIREMENTS} from '../renderer.mjs';
import {realPdf,syntheticConverter,syntheticAdmission} from './pdf-fixtures.mjs';

const unavailable=async(port,reason)=>{
 assert.equal(port.state,'unavailable');assert.equal(port.reason,reason);assert.equal(admittedConverter(port),null);assert.equal(isRendererPort(port),true);
 await assert.rejects(port.transform({bytes:Buffer.from('x'),format:'docx',target:'pdf'}),{code:'ARTIFACT_RENDERER_UNAVAILABLE'});
};
test('no admission record leaves the renderer unavailable and never reaches the converter',async()=>{
 const converter=syntheticConverter();
 for(const admission of [undefined,null])await unavailable(createRendererPort({admission,transformer:converter}),'RENDERER_NOT_ADMITTED');
 assert.equal(converter.calls.length,0);
});
test('every sandbox requirement must be attested true; each missing or false one is named',async()=>{
 assert.deepEqual(RENDERER_SANDBOX_REQUIREMENTS,['nonRootUser','noNetwork','readOnlyRootFilesystem','noNewPrivileges','dropAllCapabilities','privateWorkspace','boundedResources','noCredentials']);
 for(const requirement of RENDERER_SANDBOX_REQUIREMENTS)for(const value of [false,'true',1,undefined]){
  const admission=syntheticAdmission(),sandbox={...admission.sandbox};if(value===undefined)delete sandbox[requirement];else sandbox[requirement]=value;
  const port=createRendererPort({admission:{...admission,sandbox},transformer:syntheticConverter()});
  await unavailable(port,'RENDERER_SANDBOX_UNQUALIFIED');assert.deepEqual(port.missingRequirements,[requirement]);
 }
});
test('malformed admission records are invalid, including accessors and unknown sandbox claims',async()=>{
 const base=syntheticAdmission(),bad=[{...base,extra:true},{...base,rendererId:'other'},{...base,imageDigest:'sha256:abc'},{...base,executable:'soffice'},{...base,qualificationId:''},
  {...base,rendererVersion:'x y'},{...base,sandbox:{...base.sandbox,hostNetwork:true}},{...base,sandbox:[]},Object.defineProperty({...base},'qualificationId',{get(){return 'q';},enumerable:true}),[base],'admitted'];
 for(const admission of bad)await unavailable(createRendererPort({admission,transformer:syntheticConverter()}),'RENDERER_ADMISSION_INVALID');
 await unavailable(createRendererPort({admission:base,transformer:{}}),'RENDERER_ADMISSION_INVALID');
});
test('an admitted port binds the qualification into every receipt and is detached from later caller mutation',async()=>{
 const admission=syntheticAdmission(),converter=syntheticConverter(),port=createRendererPort({admission,transformer:converter});
 admission.sandbox.noNetwork=false;admission.qualificationId='changed';
 assert.equal(port.state,'available');assert.equal(admittedConverter(port),port);assert.equal(port.admission.qualificationId,'synthetic-test-admission');assert.equal(port.admission.sandbox.noNetwork,true);
 assert.throws(()=>{port.admission.sandbox.noNetwork=false;});
 await assert.rejects(port.transform({bytes:realPdf(['not docx']),format:'docx',target:'pdf'}),{code:'ARTIFACT_PROCESS_FAILED'});assert.equal(converter.calls.length,1);
 assert.deepEqual(describeRenderer(port),{state:'available',reason:'RENDERER_ADMITTED',sandboxRequirements:RENDERER_SANDBOX_REQUIREMENTS,missingRequirements:[],rendererId:'libreoffice',rendererVersion:'24.2.7.2',imageDigest:'sha256:'+'0'.repeat(64),qualificationId:'synthetic-test-admission'});
});
test('raw converters and look-alike objects are not renderer ports',()=>{
 const converter=syntheticConverter(),lookalike={state:'available',reason:'RENDERER_ADMITTED',admission:syntheticAdmission(),transform:converter.transform};
 for(const value of [converter,lookalike,null,undefined]){assert.equal(isRendererPort(value),false);assert.equal(admittedConverter(value),null);}
 assert.equal(describeRenderer(lookalike).state,'unavailable');
});
test('the LibreOffice port requires the admitted executable exactly and performs no IO at construction',async()=>{
 const admission=syntheticAdmission({executable:'/nonexistent/soffice'});
 await unavailable(createLibreOfficeRendererPort({admission,executable:'/other/soffice',tempRoot:'/tmp'}),'RENDERER_ADMISSION_INVALID');
 await unavailable(createLibreOfficeRendererPort({admission,executable:'/nonexistent/soffice',tempRoot:'relative'}),'RENDERER_ADMISSION_INVALID');
 await unavailable(createLibreOfficeRendererPort({admission:undefined,executable:'/nonexistent/soffice',tempRoot:'/tmp'}),'RENDERER_NOT_ADMITTED');
 assert.equal(createLibreOfficeRendererPort({admission,executable:'/nonexistent/soffice',tempRoot:'/tmp'}).state,'available');
});
