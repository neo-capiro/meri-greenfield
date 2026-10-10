import { LIMITS, prefix } from './binding.mjs';

// JSONata expression helper. All values are inert data; nothing here performs IO.
export const J = e => `{% ${e} %}`;
export const lit = JSON.stringify;
export const now = '$toMillis($now())';
export const array = e => `$append([],${e})`;
export const currentOwned = '$append($ctx.owned,$ctx.overflow)[arn=$ctx.currentArn][0]';

// JSONata counts Unicode code points; worst-case UTF-8 is 4 bytes per code point and
// JSON escaping can expand a code point to six ASCII characters. Six times the
// serialized $string length is therefore a proven-safe upper bound for the serialized
// UTF-8 byte length. Every persistent write is guarded with byteBound before commit.
export const byteBound = (e, cap) => `($s:=$string(${e});$length($s)*6<=${cap})`;
export const boundedValue = (e, cap, fallback = 'null') => `($s:=$string(${e});$length($s)*6<=${cap}?${e}:${fallback})`;
export const boundedExpr = (src, cap, fallback = 'null') => `($v:=${src};${byteBound('$v', cap)}?$v:${fallback})`;
// Before-write whole-context commit: the proposed merged $ctx must satisfy the proven
// UTF8 bound, otherwise a bounded compact fallback keeps the immutable owned/overflow
// stop identities and sticky hold/failure while dropping only heavy transient arrays.
export const commitCtx = update => `($next:=$merge([$ctx,${update}]);${byteBound('$next', LIMITS.ctxBytes)}?$next:$merge([$next,{'hold':true,'qualificationFailed':true,'overflowed':true,'allArns':[],'tokens':[],'finalQueue':[],'current':null,'eni':null,'queue':$ctx.direct,'issues':[{'kind':'ctx-overflow'}]}]))`;
export const errSummary = e => `($s:=$string(${e});$length($s)<=${LIMITS.errorChars}?$s:$substring($s,0,${LIMITS.errorChars}))`;
export const issue = (kind, extra = '{}') => `$merge([{'kind':${lit(kind)}},${extra}])`;
export const pushIssue = e => `($a:=$append($ctx.issues,${e});$count($a)<=${LIMITS.issues}?$a:$filter($a,function($x,$i){$i>=$count($a)-${LIMITS.issues}}))`;

// Compact immutable task projection: no initial/terminal/raw duplicates, only the
// facts ownership, security, attachment and terminal predicates actually read.
export const workerOf = e => `$filter(${e}.containers,function($c){$c.name='worker'})[0]`;
export const taskFacts = e => `$merge([{},{'arn':${e}.taskArn,'clusterArn':${e}.clusterArn,'definition':${e}.taskDefinitionArn,'startedBy':${e}.startedBy,'group':${e}.group,'launchType':${e}.launchType,'platformFamily':${e}.platformFamily,'platformVersion':${e}.platformVersion,'availabilityZone':${e}.availabilityZone,'enableExecuteCommand':${e}.enableExecuteCommand,'lastStatus':${e}.lastStatus,'desiredStatus':${e}.desiredStatus,'createdAt':${e}.createdAt,'containerCount':$count(${e}.containers),'worker':$merge([{},${workerOf(e)}.{'image':image,'imageDigest':imageDigest,'lastStatus':lastStatus,'exitCode':exitCode,'containerArn':containerArn,'taskArn':taskArn}]),'overrides':${e}.overrides,'tags':${e}.tags,'attachments':${e}.attachments}])`;
export const taskCore = e => `{'arn':${e}.taskArn,'clusterArn':${e}.clusterArn,'definition':${e}.taskDefinitionArn}`;
// Retain the compact projection when it fits the byte cap, else keep only the stop
// identity (arn/definition) plus an explicit truncation marker so containment survives.
export const retainTask = e => `($f:=${taskFacts(e)};${byteBound('$f', LIMITS.ledgerBytes)}?$f:$merge([${taskCore(e)},{'truncated':true}]))`;

export function buildPredicates(p) {
 const taskPrefix = `${prefix}task/${p.clusterArn.split('/')[1]}/`;
 const taskArnTest = e => `($type(${e})='string'?$count($match(${e},/^${taskPrefix.replaceAll('/','\\/')}[a-f0-9]{32}$/))=1:false)`;
 const selected = `($ctx.run.probeKind='sdk'?${lit(p.taskDefinitionArns.sdk)}:${lit(p.taskDefinitionArns.office)})`;
 const group = `'meri-greenfield-qualification:' & $ctx.run.probeKind`;
 const worker = '$ctx.current.worker';
 const tags = `[{'key':'QualificationRun','value':$ctx.run.uuid},{'key':'QualificationProbe','value':$ctx.run.probeKind},{'key':'MeriComponent','value':'native-enforcement'}]`;
 const exactTags = `$type($ctx.current.tags)='array' and $count($ctx.current.tags)=$count($distinct($ctx.current.tags.key)) and $count($filter(${tags},function($e){$count($filter($ctx.current.tags,function($t){$t.key=$e.key and $t.value=$e.value}))=1}))=3`;
 const coverage = `$type($raw)='object' and $type($raw.tasks)='array' and $count($raw.tasks)=1 and $raw.tasks[0].taskArn=$ctx.currentArn and ($not($exists($raw.failures)) or ($type($raw.failures)='array' and $count($raw.failures)=0))`;
 const ownership = `${taskArnTest('$ctx.current.arn')} and $ctx.current.clusterArn=${lit(p.clusterArn)} and $ctx.current.definition=${selected} and $ctx.current.startedBy=$ctx.run.uuid and $ctx.current.group=(${group}) and (${exactTags}) and $type($createdMs)='number' and $createdMs>=$ctx.attemptStart-1000 and $createdMs<=$ctx.attemptEnd+1000 and $createdMs<=$observedMs+1000`;
 const containerPrefix = `arn:aws:ecs:${p.region}:${p.account}:container/${p.clusterArn.split('/')[1]}/`;
 const terminal = `$ctx.current.arn=$ctx.currentArn and $ctx.current.clusterArn=${lit(p.clusterArn)} and $ctx.current.definition=${currentOwned}.definition and $ctx.current.lastStatus='STOPPED' and $ctx.current.containerCount=1 and $count($keys(${worker}))>0 and ${worker}.lastStatus='STOPPED' and ($type(${worker}.containerArn)='string'?$count($match(${worker}.containerArn,/^${containerPrefix.replaceAll('/','\\/')}[a-f0-9]{32}$/))=1:false) and ($type(${worker}.exitCode)='number'?${worker}.exitCode=$floor(${worker}.exitCode):false) and (${currentOwned}.containerArn=null or ${worker}.containerArn=${currentOwned}.containerArn)`;
 const emptyOverrides = `($o:=$ctx.current.overrides; $not($exists($o)) or ($type($o)='object' and $count($keys($o)[$not($ in ['containerOverrides','inferenceAcceleratorOverrides'])]) =0 and ($not($exists($o.containerOverrides)) or $string($o.containerOverrides) in ['[]','[{\\"name\\":\\"worker\\"}]']) and ($not($exists($o.inferenceAcceleratorOverrides)) or ($type($o.inferenceAcceleratorOverrides)='array' and $count($o.inferenceAcceleratorOverrides)=0))))`;
 // Explicit three-way attachment classification. Compatible and genuinely pending /
 // legitimate teardown are distinct from present malformed/contradictory facts.
 const attachments = '$ctx.current.attachments';
 const attIsArray = `$type(${attachments})='array'`;
 const eniAtts = `$filter(${attachments},function($a){$a.type='ElasticNetworkInterface'})`;
 // This exact task template has no EBS/Service-Connect volumes, so any non-ENI
 // attachment is unsupported and contradictory.
 const otherAtts = `$filter(${attachments},function($a){$a.type!='ElasticNetworkInterface'})`;
 const a1Details = `${eniAtts}[0].details`;
 const a1Status = `${eniAtts}[0].status`;
 // details must be a KeyValuePair array: each entry an object with string name/value and
 // unique names. Extra known names (e.g. MAC address) are allowed; wrong nested types are not.
 const detailsTyped = `$type(${a1Details})='array' and $count(${a1Details})=$count($filter(${a1Details},function($d){$type($d)='object' and $type($d.name)='string' and $type($d.value)='string'})) and $count(${a1Details})=$count($distinct(${a1Details}.name))`;
 const niDetail = `${a1Details}[name='networkInterfaceId']`;
 const subnetDetail = `${a1Details}[name='subnetId']`;
 const ipDetail = `${a1Details}[name='privateIPv4Address']`;
 // Reviewed ECS attachment lifecycle: PRECREATED/CREATED/ATTACHING are pending; teardown
 // statuses may legitimately lack details; ATTACHED/FAILED with missing details is not pending.
 const reconcilableStatus = `$type(${a1Status})='string' and ${a1Status} in ['PRECREATED','CREATED','ATTACHING','DETACHING','DETACHED','DELETED']`;
 const subnetConflict = `${detailsTyped} and $count(${subnetDetail})=1 and ${subnetDetail}.value!=${lit(p.network.subnetId)}`;
 // Immutable per-ARN positive-network ledger: the FIRST validated ENI id / private IPv4 for an
 // owned task is retained; a later observation presenting a different well-typed id/address is
 // contradictory even under a pending/teardown status (never cleared). Absent details stay
 // inconclusive; before any positive is retained there is no authority to compare against.
 const pinnedId = `${currentOwned}.netId`;
 const pinnedIp = `${currentOwned}.netIp`;
 const netPinConflict = `(($type(${pinnedId})='string' and $count(${niDetail})=1 and $type(${niDetail}.value)='string' and ${niDetail}.value!=${pinnedId}) or ($type(${pinnedIp})='string' and $count(${ipDetail})=1 and $type(${ipDetail}.value)='string' and ${ipDetail}.value!=${pinnedIp}))`;
 // Reviewed EC2 identity, required before any positive RetainENI: an ENI id is `eni-` plus 8 or
 // 17 lowercase hex characters (<=21 ASCII); an address is dotted-decimal IPv4 (<=15 ASCII, four
 // octets 0..255). No fixture value is invented; a present malformed identity never satisfies the
 // compatible path (so it is contradictory) while an absent detail stays inconclusive.
 const eniIdExpr = `${niDetail}.value`;
 const eniIpExpr = `${ipDetail}.value`;
 const eniIdReviewed = `($type(${eniIdExpr})='string' and $count($match(${eniIdExpr},/^eni-(?:[0-9a-f]{8}|[0-9a-f]{17})$/))=1)`;
 const ipReviewed = `($type(${eniIpExpr})='string' and $count($match(${eniIpExpr},/^(?:25[0-5]|2[0-4][0-9]|1[0-9]{2}|[1-9]?[0-9])(?:\\.(?:25[0-5]|2[0-4][0-9]|1[0-9]{2}|[1-9]?[0-9])){3}$/))=1)`;
 // Mutually exclusive partition: compatible and pending explicitly exclude any retained-pin
 // conflict, so a changed frame can never be simultaneously compatible and contradictory.
 const attachmentsCompatible = `${attIsArray} and $count(${eniAtts})=1 and $count(${otherAtts})=0 and ${a1Status}='ATTACHED' and ${detailsTyped} and $count(${niDetail})=1 and ${eniIdReviewed} and $count(${subnetDetail})=1 and ${subnetDetail}.value=${lit(p.network.subnetId)} and $count(${ipDetail})=1 and ${ipReviewed} and $not(${netPinConflict})`;
 // Genuinely pending/teardown statuses may legitimately omit `details` entirely (ECS declares
 // it optional): that is inconclusive, not contradictory. A PRESENT `details` must still be a
 // well-typed unique-name KeyValuePair array; present malformed details stay contradictory.
 const attachmentsPending = `${attIsArray} and $count(${eniAtts})=1 and $count(${otherAtts})=0 and ${reconcilableStatus} and ($not($exists(${a1Details})) or (${detailsTyped} and $not(${subnetConflict}))) and $not(${netPinConflict})`;
 const attachmentsAbsent = `$not($exists(${attachments})) or (${attIsArray} and $count(${attachments})=0)`;
 const attachmentsContradictory = `($exists(${attachments}) and $not(${attachmentsAbsent}) and $not(${attachmentsCompatible}) and $not(${attachmentsPending})) or (${netPinConflict})`;
 const mismatch = `$ctx.current.clusterArn!=${lit(p.clusterArn)} or $ctx.current.definition!=${selected} or ($exists($ctx.current.launchType) and $ctx.current.launchType!='FARGATE') or ($exists($ctx.current.platformFamily) and $ctx.current.platformFamily!='Linux') or ($exists($ctx.current.platformVersion) and $ctx.current.platformVersion!='1.4.0') or $ctx.current.enableExecuteCommand=true or $ctx.current.containerCount>1 or ($exists(${worker}.image) and ${worker}.image!=${lit(p.image)}) or ($exists(${worker}.imageDigest) and ${worker}.imageDigest!=${lit(p.image.split('@')[1])}) or $not(${emptyOverrides}) or (${attachmentsContradictory})`;
 const ready = `$ctx.current.launchType='FARGATE' and $ctx.current.platformFamily='Linux' and $ctx.current.platformVersion='1.4.0' and $ctx.current.enableExecuteCommand=false and $ctx.current.containerCount=1 and ${worker}.image=${lit(p.image)} and ${worker}.imageDigest=${lit(p.image.split('@')[1])} and (${emptyOverrides})`;
 const safeRaw = `$type($raw)='object' and ${byteBound('$raw', LIMITS.recordBytes)}`;
 const e = '$raw.NetworkInterfaces[0]';
 const eniGood = `$type($raw.NetworkInterfaces)='array' and $count($raw.NetworkInterfaces)=1 and ${eniIdReviewed} and ${ipReviewed} and ${e}.NetworkInterfaceId=${eniIdExpr} and ${e}.OwnerId=${lit(p.account)} and ${e}.VpcId=${lit(p.network.vpcId)} and ${e}.SubnetId=${lit(p.network.subnetId)} and ${e}.AvailabilityZone=$ctx.current.availabilityZone and ${e}.PrivateIpAddress=${eniIpExpr} and $type(${e}.Groups)='array' and $count(${e}.Groups)=1 and ${e}.Groups[0].GroupId=${lit(p.network.securityGroupId)} and $type(${e}.PrivateIpAddresses)='array' and $count(${e}.PrivateIpAddresses)=1 and ${e}.PrivateIpAddresses[0].PrivateIpAddress=${e}.PrivateIpAddress and $count(${e}.Ipv6Addresses)=0 and $not($exists(${e}.Association.PublicIp)) and $count(${e}.PrivateIpAddresses.Association.PublicIp)=0 and (${safeRaw})`;
 return { taskArnTest, selected, group, worker, coverage, ownership, terminal, mismatch, ready, safeRaw, attachmentsCompatible, attachmentsPending, attachmentsAbsent, attachmentsContradictory, eniIdExpr, eniIpExpr, eniGood };
}
