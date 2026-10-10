// Explicit service boundary: legacy fixtures stay byte-identical; SDK PascalCase
// is opt-in. Never recursively rename input keys or overwrite retained $raw.
import { scanJsonKeys } from '../../../scripts/sdk-capture/json-records.mjs';

export const SDK_WIRE_PROFILE = 'ecs-sdk-pascal_ec2-pascal_sts-pascal_v2';
export const LEGACY_WIRE_PROFILE = 'ecs-native_ec2-pascal_sts-pascal_v1';
export const isSdkWire = p => p.wireProfile === SDK_WIRE_PROFILE;
export const wireField = (p, name) => isSdkWire(p) ? ({tasks:'Tasks',failures:'Failures',taskArns:'TaskArns',nextToken:'NextToken',taskArn:'TaskArn',createdAt:'CreatedAt'})[name] : name;

function assertSdkKeys(value, depth=0) {
 if(depth>32)throw Error('SDK wire depth');
 if(Array.isArray(value)){for(const item of value)assertSdkKeys(item,depth+1);return;}
 if(value && typeof value==='object'){
  const seen=new Set();
  for(const [key,item] of Object.entries(value)){
   const folded=key.toLowerCase();
   if(!/^[A-Z]/.test(key)||seen.has(folded))throw Error('SDK wire mixed-case/collision');
   seen.add(folded);assertSdkKeys(item,depth+1);
  }
 }
}

export function parseWireEvidence(body, p) {
 if(!isSdkWire(p))return JSON.parse(body);
 scanJsonKeys(body);
 const wr=JSON.parse(body);
 if(Object.keys(wr).sort().join(',')!=='describeResult,eniResult,identityResult,listResult,profile,timestampEncoding')throw Error('SDK evidence fields');
 for(const key of ['listResult','describeResult','eniResult','identityResult'])assertSdkKeys(wr[key]);
 const list=wr.listResult,describe=wr.describeResult;
 if(!list||typeof list!=='object'||Array.isArray(list)||Object.keys(list).some(k=>!['TaskArns','NextToken'].includes(k))||!Array.isArray(list.TaskArns)
    ||(list.NextToken!==undefined&&(typeof list.NextToken!=='string'||list.NextToken.length===0))
    ||!describe||typeof describe!=='object'||Array.isArray(describe)||Object.keys(describe).some(k=>!['Tasks','Failures'].includes(k))||!Array.isArray(describe.Tasks)
    ||(describe.Failures!==undefined&&!Array.isArray(describe.Failures)))throw Error('SDK wire evidence shape');
 return wr;
}

// This validates casing/collisions, not a dynamic case-conversion algorithm.
// Service values such as detail names remain unchanged. All immediate array
// records are checked before projection; singleton/empty arrays are preserved.
export function sdkResultGuard(e, kind) {
 const rootKeys=kind==='list'?"['TaskArns','NextToken']":"['Tasks','Failures']";
 const casing=`($valid:=function($v,$d){$d>32?false:($type($v)='object'?($ks:=$keys($v);$count($ks)=$count($distinct($map($ks,function($k){$lowercase($k)}))) and $count($filter($ks,function($k){$not($contains($k,/^[A-Z]/)) or $not($valid($lookup($v,$k),$d+1))}))=0):($type($v)='array'?$count($filter($v,function($x){$not($valid($x,$d+1))}))=0:true))};$valid(${e},0))`;
 const records=(a,predicate="true")=>`$type(${a})='array' and $count(${a})=$count($filter(${a},function($x){$type($x)='object' and (${predicate})}))`;
 const optionalRecords=(key,predicate='true')=>`($not($exists($t.${key})) or (${records(`$t.${key}`,predicate)}))`;
 const optionalTypes=(e,names,type)=>names.map(k=>`($not($exists(${e}.${k})) or $type(${e}.${k})='${type}')`).join(' and ');
 const containerTypes=optionalTypes('$x',['Name','Image','ImageDigest','LastStatus','ContainerArn','TaskArn'],'string')+' and '+optionalTypes('$x',['ExitCode'],'number');
 const taskShape=["$type($t.TaskArn)='string'",optionalTypes('$t',['ClusterArn','TaskDefinitionArn','StartedBy','Group','LaunchType','PlatformFamily','PlatformVersion','AvailabilityZone','LastStatus','DesiredStatus'],'string'),optionalTypes('$t',['EnableExecuteCommand'],'boolean'),"($not($exists($t.CreatedAt)) or $type($t.CreatedAt) in ['number','string'])",optionalRecords('Containers',containerTypes),optionalRecords('Tags',"$type($x.Key)='string' and $type($x.Value)='string'"),optionalRecords('Attachments',optionalTypes('$x',['Type','Status'],'string')+" and ($not($exists($x.Details)) or ($type($x.Details)='array' and $count($x.Details)=$count($filter($x.Details,function($d){$type($d)='object' and $type($d.Name)='string' and $type($d.Value)='string'}))))")].join(' and ');
 const tasks=kind==='list'?`$type(${e}.TaskArns)='array'`:`$type(${e}.Tasks)='array' and $count(${e}.Tasks)=$count($filter(${e}.Tasks,function($t){$type($t)='object' and (${taskShape})})) and ($not($exists(${e}.Failures)) or (${records(`${e}.Failures`)}))`;
 return `($type(${e})='object' and $count($keys(${e})[$not($ in ${rootKeys})])=0 and (${casing}) and (${tasks}))`;
}

const mappedArray=(e,body)=>`($exists(${e})?($type(${e})='array'?$append([],$map(${e},function($x){${body}})):${e}):$lookup({},'absent'))`;
const pairs=(e,names)=>'{'+Object.entries(names).map(([key,value])=>`'${key}':${e}.${value}`).join(',')+'}';

// Unsupported override fields must survive as a rejection marker; dropping them
// would turn a credential/command override into an apparently empty override.
function overrides(e) {
 return `($o:=${e};$not($exists($o))?$lookup({},'absent'):($type($o)!='object'?$o:($count($keys($o)[$not($ in ['ContainerOverrides','InferenceAcceleratorOverrides'])])>0?{'unsupported':true}:$merge([{},$exists($o.ContainerOverrides)?{'containerOverrides':${mappedArray('$o.ContainerOverrides',"$type($x)='object' and $count($keys($x))=1 and $x.Name='worker'?{'name':$x.Name}:{'unsupported':true}")}}:{},$exists($o.InferenceAcceleratorOverrides)?{'inferenceAcceleratorOverrides':$o.InferenceAcceleratorOverrides}:{}]))))`;
}

export function sdkTaskFacts(e) {
 const fields={arn:'TaskArn',clusterArn:'ClusterArn',definition:'TaskDefinitionArn',startedBy:'StartedBy',group:'Group',launchType:'LaunchType',platformFamily:'PlatformFamily',platformVersion:'PlatformVersion',availabilityZone:'AvailabilityZone',enableExecuteCommand:'EnableExecuteCommand',lastStatus:'LastStatus',desiredStatus:'DesiredStatus',createdAt:'CreatedAt'};
 const worker=`$filter(${e}.Containers,function($c){$c.Name='worker'})[0]`;
 const workerFields={image:'Image',imageDigest:'ImageDigest',lastStatus:'LastStatus',exitCode:'ExitCode',containerArn:'ContainerArn',taskArn:'TaskArn'};
 const details=mappedArray('$x.Details',"{'name':$x.Name,'value':$x.Value}");
 const attachments=mappedArray(`${e}.Attachments`,`{'type':$x.Type,'status':$x.Status,'details':${details}}`);
 return `$merge([{},${pairs(e,fields)},{'containerCount':$count(${e}.Containers),'worker':$merge([{},${pairs(worker,workerFields)}]),'overrides':${overrides(`${e}.Overrides`)},'tags':${mappedArray(`${e}.Tags`,"{'key':$x.Key,'value':$x.Value}")},'attachments':${attachments}}])`;
}

export function sdkCreatedMs(encoding) {
 const e='$states.result.Tasks[0].CreatedAt';
 if(encoding==='epoch-seconds')return `($type(${e})='number' and ${e}>=0 and ${e}<253402300800?${e}*1000:null)`;
 if(encoding==='iso8601')return `($type(${e})='string' and $count($match(${e},/^\\d{4}-\\d{2}-\\d{2}T\\d{2}:\\d{2}:\\d{2}(?:\\.\\d{1,9})?(?:Z|[+-]\\d{2}:\\d{2})$/))=1?$toMillis(${e}):null)`;
 throw Error('unsupported SDK timestamp encoding');
}
