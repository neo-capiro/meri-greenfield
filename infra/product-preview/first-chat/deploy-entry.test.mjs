/** The real `bindings` entry: supplied/absent/invalid public-search gateway outputs through
 * stage3-deploy.mjs -> buildStage3Bindings -> manifest control environment. Fully synthetic inputs in the
 * OS temp directory; no AWS call, network request, credential or deploy command is invoked. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,readFile,writeFile,rm,stat} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createRenderFixture} from './render-material.fixture.mjs';
import {ROLES} from './render-material.mjs';
import {STAGE3_FAMILIES,nextRevisions,stage3RenderInput} from './stage3-bindings.mjs';
import {main,parseLatestTsv} from './stage3-deploy.mjs';

const fixture=createRenderFixture();
test.after(()=>fixture.cleanup());
const fakeVersion=n=>`${String(n).repeat(8)}-aaaa-4bbb-8ccc-${String(n).repeat(12)}`;
const GATEWAY_URL='https://meri-preview-web-search-abc123.gateway.bedrock-agentcore.us-east-1.amazonaws.com/mcp';
const TARGET_TOOL='WebSearch-tool-abc123';
const PUBLIC_TG='arn:aws:elasticloadbalancing:us-east-1:967807252336:targetgroup/meri-preview-control-8080/03297203fa59801c';
const LIVE_APP={Resources:{controlService:{Type:'AWS::ECS::Service',Properties:{LoadBalancers:[{ContainerName:'control',ContainerPort:8080,TargetGroupArn:PUBLIC_TG},
 {ContainerName:'control',ContainerPort:8082,TargetGroupArn:'arn:aws:elasticloadbalancing:us-east-1:967807252336:targetgroup/meri-preview-control-8082/1732509ee5fbf759'}]}}}};
const LATEST=[...Object.values(STAGE3_FAMILIES).flatMap(f=>[`${f}\tNone`,`${f}\tNone`])].join('\n').replace(
 'meri-product-preview-temporal-worker\tNone','meri-product-preview-temporal-worker\tarn:aws:ecs:us-east-1:967807252336:task-definition/meri-product-preview-temporal-worker:3')+'\n';
const outputs=value=>Object.entries(value).map(([OutputKey,OutputValue])=>({OutputKey,OutputValue}));

let state;
async function inputs(){
 if(state)return state;
 const i=await fixture.setup(),dir=await mkdtemp(join(tmpdir(),'meri-deploy-entry-'));
 const revisions=nextRevisions(parseLatestTsv(LATEST));
 const stage3=stage3RenderInput({deployment:i.deployment,foundationOutputs:fixture.foundationOutputs,revisions});
 const rendered=await fixture.render(x=>{x.stage3=structuredClone(stage3);});
 const renderedDir=join(dir,'rendered');
 await mkdir(renderedDir);
 await writeFile(join(renderedDir,'summary.json'),JSON.stringify(rendered.summary));
 for(const role of ROLES){await mkdir(join(renderedDir,role));await writeFile(join(renderedDir,role,'expected.json'),JSON.stringify(rendered.roles[role].expected));}
 const files={deployment:join(dir,'deployment.json'),foundation:join(dir,'foundation.json'),
  privateEdge:join(dir,'private-edge.json'),versions:join(dir,'versions.tsv'),scans:join(dir,'scans.json'),
  live:join(dir,'live.template.json'),rendered:renderedDir};
 await writeFile(files.deployment,JSON.stringify(i.deployment));
 await writeFile(files.foundation,JSON.stringify(outputs(fixture.foundationOutputs)));
 await writeFile(files.privateEdge,JSON.stringify(outputs({ControlPrivateOrigin:i.deployment.privateEdge.controlPrivateOrigin,
  ControlPrivateTargetGroupArn:i.deployment.privateEdge.controlPrivateTargetGroupArn,
  PrivateAlbSecurityGroupId:i.deployment.privateEdge.privateAlbSecurityGroupId})));
 await writeFile(files.versions,ROLES.map((role,n)=>`${role}\t${fakeVersion(n+1)}`).join('\n')+'\n');
 await writeFile(files.scans,JSON.stringify({nodeRuntime:'d'.repeat(64)}));
 await writeFile(files.live,JSON.stringify(LIVE_APP));
 state={dir,files};
 return state;
}
async function bindings(argv){
 const lines={out:[],err:[]};
 const code=await main(argv,{out:t=>lines.out.push(t),err:t=>lines.err.push(t)});
 return {code,out:lines.out.join(''),err:lines.err.join('')};
}
function flags(files,out,extra=[]){
 return ['bindings','--deployment-inputs',files.deployment,'--foundation-outputs',files.foundation,
  '--private-edge-outputs',files.privateEdge,'--rendered',files.rendered,'--secret-versions',files.versions,
  '--image-scans',files.scans,'--live-app-template',files.live,...extra,'--out',out];
}
const controlEnv=template=>template.Resources.controlTask.Properties.ContainerDefinitions.find(c=>c.Name==='control').Environment;
const searchEnv=template=>Object.fromEntries(controlEnv(template).filter(e=>e.Name.startsWith('MERI_WEB_SEARCH_')).map(e=>[e.Name,e.Value]));
const read=async(path,...parts)=>JSON.parse(await readFile(join(path,...parts),'utf8'));

test('the real bindings entry adds exactly three control variables when the gateway outputs are supplied',async()=>{
 const {dir,files}=await inputs();
 const plain=join(dir,'out-plain'),supplied=join(dir,'out-search');
 const missing=await bindings(flags(files,plain));
 assert.equal(missing.code,0,missing.err);
 const suppliedRun=await bindings(flags(files,supplied,['--web-search-outputs',join(dir,'gw.outputs.json')]));
 // The outputs file is created after the plain run so the plain invocation cannot have seen it.
 assert.equal(suppliedRun.code,2,'an unreadable outputs file is an input error, not a silent default');
 assert.match(suppliedRun.err,/STAGE3_INPUT_UNREADABLE|STAGE3_REFUSED/u);

 await writeFile(join(dir,'gw.outputs.json'),JSON.stringify(outputs({GatewayUrl:GATEWAY_URL,TargetToolName:TARGET_TOOL,
  GatewayArn:'arn:aws:bedrock-agentcore:us-east-1:967807252336:gateway/meri-preview-web-search',
  GatewayId:'meri-preview-web-search-abc123',ConnectorOperation:'WebSearch',ConnectorVersion:'1.2.0',ProtocolVersion:'2026-07-28'})));
 const enabled=await bindings(flags(files,supplied,['--web-search-outputs',join(dir,'gw.outputs.json')]));
 assert.equal(enabled.code,0,enabled.err);
 assert.match(enabled.out,/"status":"STAGE3_BINDINGS_WRITTEN"/u);

 const before=await read(plain,'app.template.json'),after=await read(supplied,'app.template.json');
 assert.deepEqual(searchEnv(before),{},'the default invocation writes no public search environment');
 assert.deepEqual(searchEnv(after),{MERI_WEB_SEARCH_GATEWAY_ENDPOINT:GATEWAY_URL,MERI_WEB_SEARCH_TOOL:TARGET_TOOL,
  MERI_WEB_SEARCH_REGION:'us-east-1'});
 // Everything except those three variables is identical in the rendered application template.
 const strip=template=>{const copy=structuredClone(template);
  for(const c of copy.Resources.controlTask.Properties.ContainerDefinitions)
   if(c.Name==='control')c.Environment=c.Environment.filter(e=>!e.Name.startsWith('MERI_WEB_SEARCH_'));
  return copy;};
 assert.deepEqual(strip(after),before);
 // The binding file carries the search target and nothing else changes there either.
 const plainBinding=await read(plain,'app.binding.json'),searchBinding=await read(supplied,'app.binding.json');
 assert.equal(Object.hasOwn(plainBinding,'controlWebSearch'),false);
 assert.deepEqual(searchBinding.controlWebSearch,{gatewayUrl:GATEWAY_URL,toolName:TARGET_TOOL,region:'us-east-1'});
 assert.deepEqual({...searchBinding,controlWebSearch:undefined},{...plainBinding,controlWebSearch:undefined});
 // Unrelated outputs keep their shape and content: deploy plan, other stacks, services.
 const plainPlan=await read(plain,'deploy-plan.json'),searchPlan=await read(supplied,'deploy-plan.json');
 assert.deepEqual(Object.keys(searchPlan),['order','stacks','expectedTaskDefinitions','services']);
 // Same stacks, commands, task definitions and services; only the rendered template size grows.
 const sizeFree=(plan,out)=>{const copy=structuredClone(JSON.parse(JSON.stringify(plan).split(JSON.stringify(out).slice(1,-1)).join('<OUT>')));
  for(const stack of Object.values(copy.stacks))delete stack.bytes;
  return copy;};
 assert.deepEqual(sizeFree(searchPlan,supplied),sizeFree(plainPlan,plain));
 assert(searchPlan.stacks.app.bytes>plainPlan.stacks.app.bytes,'the enabled template carries three more variables');
 assert.equal(searchPlan.stacks.app.viaS3,false);
});

test('invalid public search outputs are refused by the real entry before any template is written',async()=>{
 const {dir,files}=await inputs();
 const cases={originOnly:{GatewayUrl:GATEWAY_URL.replace('/mcp',''),TargetToolName:TARGET_TOOL},
  badTool:{GatewayUrl:GATEWAY_URL,TargetToolName:'bad tool'},
  foreignHost:{GatewayUrl:'https://example.com/mcp',TargetToolName:TARGET_TOOL},
  notJson:'not-json'};
 for(const [name,value] of Object.entries(cases)){
  const file=join(dir,`invalid-${name}.json`),out=join(dir,`out-invalid-${name}`);
  await writeFile(file,typeof value==='string'?value:JSON.stringify(outputs(value)));
  const run=await bindings(flags(files,out,['--web-search-outputs',file]));
  assert.equal(run.code,2,`${name} must be refused`);
  assert.match(run.err,/STAGE3_BINDING_REFUSED|STAGE3_INPUT_REFUSED/u,`${name} refusal reason`);
  await assert.rejects(stat(out),{code:'ENOENT'},`${name} must not create an output directory`);
 }
});

test('the entry help documents the optional flag and keeps every required one',async()=>{
 const lines={out:[],err:[]};
 assert.equal(await main(['--help'],{out:t=>lines.out.push(t),err:t=>lines.err.push(t)}),0);
 const text=lines.out.join('');
 for(const required of ['--deployment-inputs','--foundation-outputs','--private-edge-outputs','--rendered',
  '--secret-versions','--image-scans','--live-app-template','--out'])assert(text.includes(required),required);
 assert.match(text,/\[--web-search-outputs gw\.outputs\.json\]/u);
});
