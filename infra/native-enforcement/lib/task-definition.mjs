// Fail-closed validation of actual ECS task-definition readbacks. Pure data; no
// AWS/network/process. Self-contained (no import from binding.mjs) to avoid a cycle:
// binding.mjs imports this. Neutral service defaults are accepted only where they were
// actually observed; unknown fields, wrong types and non-empty defaults are rejected.

const canonical=v=>{if(Array.isArray(v))return '['+v.map(canonical).join(',')+']';if(v&&typeof v==='object')return '{'+Object.keys(v).sort().map(k=>JSON.stringify(k)+':'+canonical(v[k])).join(',')+'}';const s=JSON.stringify(v);if(s===undefined)throw Error('undefined canonical value');return s;};
const check=(v,m)=>{if(!v)throw Error(m);};
const keysOnly=(v,allowed,label)=>{check(v&&typeof v==='object'&&!Array.isArray(v),label+' object');check(Object.keys(v).every(x=>allowed.includes(x)),label+' unknown field: '+Object.keys(v).filter(x=>!allowed.includes(x)).join(','));};
// Ordered arrays (command/entryPoint) are compared exactly; reorderable keyed collections
// (environment/volumes/mounts) are compared as unique-key sets, rejecting duplicates.
const ordered=(v,want,label)=>check(canonical(v)===canonical(want),label);
const keyedSet=(list,key,want,label)=>{
 check(Array.isArray(list),label+' array');
 const names=list.map(x=>x&&x[key]);
 check(names.every(n=>typeof n==='string'&&n.length>0),label+' keys');
 check(new Set(names).size===names.length,label+' duplicate keys');
 check(canonical([...list].sort((a,b)=>a[key]<b[key]?-1:a[key]>b[key]?1:0))===canonical([...want].sort((a,b)=>a[key]<b[key]?-1:a[key]>b[key]?1:0)),label+' content');
};
const emptyOr=(v,shape,label)=>check(v===undefined||canonical(v)===shape,label);
const boolFalseOrAbsent=(v,label)=>check(v===undefined||v===false,label);
// Narrow reviewed Attribute schema (public AWS API_Attribute). `name` allows letters, numbers,
// hyphen, underscore, period, forward slash and backslash (1..128). `value` additionally allows
// '@', ':' and interior spaces (1..128), but never a leading or trailing space. Unknown keys,
// wrong types, out-of-range lengths and disallowed characters fail closed.
const ATTR_NAME=/^[A-Za-z0-9_./\\-]{1,128}$/;
const ATTR_VALUE=/^[A-Za-z0-9_./\\@: -]{1,128}$/;
const reviewedAttributeValue=v=>typeof v==='string'&&ATTR_VALUE.test(v)&&v[0]!==' '&&v.at(-1)!==' ';
const attribute=a=>{
 check(a&&typeof a==='object'&&!Array.isArray(a),'attribute object');
 keysOnly(a,['name','value','targetId','targetType'],'attribute');
 check(typeof a.name==='string'&&ATTR_NAME.test(a.name),'attribute name');
 check(a.value===undefined||reviewedAttributeValue(a.value),'attribute value');
 check(a.targetId===undefined||typeof a.targetId==='string','attribute targetId');
 check(a.targetType===undefined||a.targetType==='container-instance','attribute targetType');
};

const CONTAINER_KEYS=['name','image','cpu','links','portMappings','essential','entryPoint','command','environment','environmentFiles','mountPoints','volumesFrom','linuxParameters','secrets','stopTimeout','user','privileged','readonlyRootFilesystem','dnsServers','dnsSearchDomains','extraHosts','dockerSecurityOptions','dockerLabels','ulimits','logConfiguration','systemControls','credentialSpecs'];
const TASK_KEYS=['taskDefinitionArn','containerDefinitions','family','taskRoleArn','executionRoleArn','networkMode','revision','volumes','status','requiresAttributes','placementConstraints','compatibilities','runtimePlatform','requiresCompatibilities','cpu','memory','registeredAt','registeredBy','ephemeralStorage'];
const EMPTY_ARRAY_FIELDS=['links','portMappings','environmentFiles','secrets','volumesFrom','dnsServers','dnsSearchDomains','extraHosts','dockerSecurityOptions','ulimits','credentialSpecs','systemControls'];

// Shared fail-closed validation of one actual task-definition record against the exact
// expected binding. Throws on any mismatch. Retained metadata (requiresAttributes/
// registeredAt/By/status/compatibilities) is type-checked but is not treated as authority.
// The closed invocation mode is supplied by the fixed wrapper: native reads `expect.command`
// ONLY at the original command-check position below; canary uses fixed literals and never
// reads `expect.command`.
const INVOCATION_NATIVE='native',INVOCATION_CANARY='canary';
function validateDefinition(t,expect,mode){
 check(t&&typeof t==='object'&&!Array.isArray(t),'definition object');
 keysOnly(t,TASK_KEYS,'task-definition');
 check(t.taskDefinitionArn===expect.arn&&t.family===expect.family&&Number.isInteger(t.revision)&&t.revision===expect.revision,'definition binding/revision');
 check(t.executionRoleArn===expect.executionRoleArn&&t.taskRoleArn===expect.workerRoleArn&&t.networkMode==='awsvpc','definition roles/networkMode');
 check(t.cpu==='2048'&&t.memory==='8192','definition resources');
 ordered(t.requiresCompatibilities,['FARGATE'],'requiresCompatibilities');
 check(canonical(t.runtimePlatform)===canonical({cpuArchitecture:'X86_64',operatingSystemFamily:'LINUX'}),'runtimePlatform');
 check(t.ephemeralStorage&&typeof t.ephemeralStorage==='object'&&!Array.isArray(t.ephemeralStorage),'ephemeralStorage object');
 keysOnly(t.ephemeralStorage,['sizeInGiB'],'ephemeralStorage');
 check(t.ephemeralStorage.sizeInGiB===50,'ephemeralStorage sizeInGiB');
 check(t.status===undefined||t.status==='ACTIVE','definition status');
 check(t.compatibilities===undefined||(Array.isArray(t.compatibilities)&&t.compatibilities.every(x=>typeof x==='string')&&t.compatibilities.includes('FARGATE')),'compatibilities');
 emptyOr(t.placementConstraints,'[]','placementConstraints');
 check(t.requiresAttributes===undefined||Array.isArray(t.requiresAttributes),'requiresAttributes array');
 if(t.requiresAttributes!==undefined)t.requiresAttributes.forEach(attribute);
 check(t.registeredAt===undefined||typeof t.registeredAt==='string','registeredAt');
 check(t.registeredBy===undefined||typeof t.registeredBy==='string','registeredBy');
 keyedSet(t.volumes,'name',[{name:'workspace',host:{}},{name:'tmp',host:{}}],'volumes');
 check(Array.isArray(t.containerDefinitions)&&t.containerDefinitions.length===1,'single worker container');

 const c=t.containerDefinitions[0];
 keysOnly(c,CONTAINER_KEYS,'container');
 check(c.name==='worker'&&c.image===expect.image,'worker name/image');
 check(c.user==='10001:10001'&&c.essential===true&&c.readonlyRootFilesystem===true&&c.privileged===false&&c.stopTimeout===60,'worker security');
 check(c.cpu===undefined||c.cpu===0,'container cpu');
 ordered(c.entryPoint,mode===INVOCATION_CANARY?['/usr/bin/sleep']:['node'],'entryPoint');
 ordered(c.command,mode===INVOCATION_CANARY?['1200']:[expect.command],'command');
 keyedSet(c.environment,'name',[['HOME','/workspace/home'],['TMPDIR','/tmp'],['CLAUDE_CONFIG_DIR','/workspace/config'],['PLAYWRIGHT_BROWSERS_PATH','/opt/meri-browsers'],['MERI_QUALIFICATION_ONLY','true'],['MERI_SOURCES_ENABLED','false'],['CHROMIUM_SANDBOX_REQUIRED','true']].map(([name,value])=>({name,value})),'environment');
 keyedSet(c.mountPoints,'sourceVolume',[{sourceVolume:'workspace',containerPath:'/workspace',readOnly:false},{sourceVolume:'tmp',containerPath:'/tmp',readOnly:false}],'mountPoints');
 keysOnly(c.linuxParameters,['capabilities','devices','tmpfs'],'linuxParameters');
 keysOnly(c.linuxParameters.capabilities,['add','drop'],'capabilities');
 ordered(c.linuxParameters.capabilities.drop,['ALL'],'capabilities.drop');
 emptyOr(c.linuxParameters.capabilities.add,'[]','capabilities.add');
 emptyOr(c.linuxParameters.devices,'[]','linuxParameters.devices');
 emptyOr(c.linuxParameters.tmpfs,'[]','linuxParameters.tmpfs');
 for(const f of EMPTY_ARRAY_FIELDS)emptyOr(c[f],'[]','container '+f);
 emptyOr(c.dockerLabels,'{}','dockerLabels');
 keysOnly(c.logConfiguration,['logDriver','options','secretOptions'],'logConfiguration');
 check(c.logConfiguration.logDriver==='awslogs','logDriver');
 keysOnly(c.logConfiguration.options,['awslogs-group','awslogs-region','awslogs-stream-prefix','mode'],'logConfiguration.options');
 check(canonical(c.logConfiguration.options)===canonical({'awslogs-group':expect.logGroup,'awslogs-region':expect.region,'awslogs-stream-prefix':`qualification-${expect.probeKind}`,'mode':'blocking'}),'logConfiguration.options values');
 emptyOr(c.logConfiguration.secretOptions,'[]','logConfiguration.secretOptions');
 return true;
}

// Native wrapper: unchanged public arity/signature. `expect.command` is read only inside the
// shared validator at the original command-check position, preserving the original failure
// order (definition/schema/security/entryPoint guards first).
export function validateTaskDefinition(t,expect){
 return validateDefinition(t,expect,INVOCATION_NATIVE);
}

// Canary wrapper: fixed direct `/usr/bin/sleep 1200` invocation only; `expect.command` is never
// read. No Node, shell, arbitrary argument or caller-selected entryPoint is accepted here.
export function validateCanaryTaskDefinition(t,expect){
 return validateDefinition(t,expect,INVOCATION_CANARY);
}
