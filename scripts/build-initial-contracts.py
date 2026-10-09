"""Integration-owner bootstrap of independent JSON Schema contracts, no source imports."""
import json
from pathlib import Path

root = Path(__file__).resolve().parents[1]
dest = root / 'packages/contracts'
dest.mkdir(parents=True, exist_ok=True)

def obj(properties, required=None):
    return {'type':'object','properties':properties,'required':list(properties) if required is None else required,'additionalProperties':False}
def ref(name): return {'$ref':f'#/$defs/{name}'}
def enum(*values): return {'type':'string','enum':list(values)}
def array(item, **kwargs): return {'type':'array','items':item,**kwargs}
def text(**kwargs): return {'type':'string','minLength':1,**kwargs}
def integer(minimum=0): return {'type':'integer','minimum':minimum,'maximum':9007199254740991}
uuid = {'type':'string','format':'uuid'}
date = {'type':'string','format':'date-time','pattern':'Z$'}
hash256 = {'type':'string','pattern':'^[a-f0-9]{64}$'}
version = {'type':'string','pattern':'^[0-9]+\\.[0-9]+\\.[0-9]+$'}
defs = {}
defs['Identity'] = obj({'tenantId':text(maxLength=128),'actorId':text(maxLength=128)})
defs['Scope'] = obj({'tenantId':text(maxLength=128),'kind':enum('tenant','client','mailbox','memory','document','private-user','public'),'resourceId':text(maxLength=256),'policyRevision':text(maxLength=128)})
scopes = array(ref('Scope'), minItems=1, uniqueItems=True)
defs['RunBinding'] = obj({'tenantId':text(maxLength=128),'actorId':text(maxLength=128),'conversationId':uuid,'runId':uuid,'attemptId':uuid,'workerId':uuid,'writerFence':integer(1)})
defs['Budgets'] = obj({'maxTurns':integer(1),'maxRuntimeSeconds':integer(1),'maxCostMicrousd':integer(1),'maxOutputBytes':integer(1)})
defs['CapabilityClaims'] = obj({'capabilityId':uuid,'issuer':text(),'audience':enum('meri-gateway','meri-broker'),'binding':ref('RunBinding'),'actions':array(enum('tool.read','command.propose','command.execute','session.persist','workspace.persist','artifact.publish','browser.public'),minItems=1,uniqueItems=True),'scopes':scopes,'issuedAt':date,'expiresAt':date,'policyRevision':text(),'budgets':ref('Budgets')})
defs['AuthorizationDecision'] = obj({'decisionId':uuid,'actor':ref('Identity'),'operation':text(),'scopes':scopes,'policyRevision':text(),'evaluatedAt':date,'decision':enum('allowed','denied'),'reasonCode':text()})
defs['SourceEvidence'] = obj({'sourceId':text(),'recordId':text(),'sourceVersionId':text(),'observedAt':date,'sourceUpdatedAt':{'anyOf':[date,{'type':'null'}]},'citationId':uuid,'scopes':scopes,'contentSha256':hash256,'authorizationDecisionId':uuid})
defs['Coverage'] = obj({'completeness':enum('complete','partial','unknown'),'limitations':array(text()),'asOf':date,'historySupport':enum('supported','unsupported','bounded'),'truncated':{'type':'boolean'}})
defs['Coverage']['allOf'] = [{'if':{'properties':{'truncated':{'const':True}},'required':['truncated']},'then':{'properties':{'completeness':enum('partial','unknown')}}}]
defs['ReadRequest'] = obj({'contractVersion':{'const':'0.1.0'},'requestId':uuid,'capabilityId':uuid,'tool':text(pattern='^[a-z][a-z0-9_.-]+$'),'arguments':{'type':'object'},'idempotencyKey':text(maxLength=128),'cursor':{'anyOf':[text(),{'type':'null'}]}})
defs['ReadResult'] = obj({'contractVersion':{'const':'0.1.0'},'requestId':uuid,'binding':ref('RunBinding'),'data':{},'evidence':array(ref('SourceEvidence')),'scopes':scopes,'coverage':ref('Coverage'),'nextCursor':{'anyOf':[text(),{'type':'null'}]},'totalCount':{'anyOf':[integer(),{'type':'null'}]}})
defs['ObjectReference'] = obj({'objectId':uuid,'versionId':text(),'sha256':hash256,'bytes':integer(),'scopes':scopes})
defs['Command'] = obj({'contractVersion':{'const':'0.1.0'},'commandId':uuid,'binding':ref('RunBinding'),'action':enum('memory.propose','task.create','artifact.file'),'arguments':{'type':'object'},'attachments':array(ref('ObjectReference')),'scopes':scopes,'idempotencyKey':text(maxLength=128)})
defs['ApprovalProposal'] = obj({'proposalId':uuid,'command':ref('Command'),'commandSha256':hash256,'createdAt':date,'expiresAt':date,'requiredApprover':ref('Identity')})
defs['CommandExecutionRequest'] = obj({'contractVersion':{'const':'0.1.0'},'requestId':uuid,'capabilityId':uuid,'executorBinding':ref('RunBinding'),'proposalId':uuid,'commandSha256':hash256,'idempotencyKey':text(maxLength=128)})
defs['ApprovalDecision'] = obj({'proposalId':uuid,'commandSha256':hash256,'decision':enum('approved','rejected'),'decidedAt':date,'expiresAt':date,'approver':ref('Identity'),'policyRevision':text()})
defs['CommandReceipt'] = obj({'receiptId':uuid,'commandId':uuid,'commandSha256':hash256,'idempotencyKey':text(),'binding':ref('RunBinding'),'outcome':enum('succeeded','denied','failed','indeterminate'),'sourceTransactionId':{'anyOf':[text(),{'type':'null'}]},'completedAt':date,'scopes':scopes,'authorizationDecisionId':uuid})
defs['ArtifactVersion'] = obj({'contractVersion':{'const':'0.1.0'},'artifactId':uuid,'versionId':uuid,'parentVersionId':{'anyOf':[uuid,{'type':'null'}]},'binding':ref('RunBinding'),'object':ref('ObjectReference'),'filename':text(maxLength=255),'mimeType':text(),'scopes':scopes,'evidence':array(ref('SourceEvidence')),'generationStatus':enum('draft','validated','published','failed'),'previewStatus':enum('pending','validated','unsupported','failed'),'createdAt':date})
defs['WorkspaceEntry'] = obj({'path':text(maxLength=4096),'kind':{'const':'file'},'object':ref('ObjectReference'),'executable':{'type':'boolean'}})
defs['WorkspaceManifest'] = obj({'contractVersion':{'const':'0.1.0'},'manifestId':uuid,'binding':ref('RunBinding'),'logicalCwd':{'const':'/workspace/conversation'},'entries':array(ref('WorkspaceEntry')),'scopes':scopes,'createdAt':date})
defs['RuntimeVersions'] = obj({'imageDigest':text(pattern='^sha256:[a-f0-9]{64}$'),'sdk':version,'cli':version,'contracts':{'const':'0.1.0'},'skillsDigest':hash256,'checkpointFormat':{'const':'0.1.0'}})
defs['Checkpoint'] = obj({'contractVersion':{'const':'0.1.0'},'checkpointId':uuid,'parentCheckpointId':{'anyOf':[uuid,{'type':'null'}]},'binding':ref('RunBinding'),'sessionId':text(),'opaqueSession':ref('ObjectReference'),'workspace':ref('WorkspaceManifest'),'workspaceSha256':hash256,'versions':ref('RuntimeVersions'),'lastEventSequence':integer(),'scopes':scopes,'createdAt':date,'durableReceiptId':uuid})
defs['Lifecycle'] = obj({'lifecycleId':uuid,'tenantId':text(),'retentionPolicyVersion':text(),'resourceId':uuid,'state':enum('active','deletion-pending','tombstoned'),'deleteAfter':{'anyOf':[date,{'type':'null'}]},'tombstonedAt':{'anyOf':[date,{'type':'null'}]},'restoreBarrierRevision':text(),'legalHold':{'type':'boolean'}})
defs['UsageLedger'] = obj({'usageId':uuid,'binding':ref('RunBinding'),'attemptId':uuid,'providerRequestId':{'anyOf':[text(),{'type':'null'}]},'inputTokens':integer(),'outputTokens':integer(),'cacheReadTokens':integer(),'cacheWriteTokens':integer(),'costMicrousd':integer(),'measurement':enum('measured','pending-reconciliation'),'status':enum('running','succeeded','failed','cancelled','retried'),'recordedAt':date})
states = enum('queued','starting','running','waiting-for-approval','paused','completed','failed','cancelled')
defs['Run'] = obj({'binding':ref('RunBinding'),'state':states,'scopes':scopes,'createdAt':date,'policyRevision':text(),'versions':ref('RuntimeVersions')})
defs['Conversation'] = obj({'conversationId':uuid,'owner':ref('Identity'),'scopes':scopes,'createdAt':date,'policyRevision':text()})
defs['ScheduleProjection'] = obj({'scheduleId':uuid,'owner':ref('Identity'),'temporalScheduleId':text(),'timezone':text(),'scopes':scopes,'state':enum('active','paused','cancelled'),'maxCostMicrousd':integer(1),'maxRuntimeSeconds':integer(1),'retryLimit':integer(),'destinationId':text(),'createdAt':date})
defs['ToolAudit'] = obj({'auditId':uuid,'binding':ref('RunBinding'),'requestId':uuid,'tool':text(),'argumentsSha256':hash256,'scopes':scopes,'policyRevision':text(),'decision':enum('allowed','denied'),'createdAt':date})
event_data = {
 'run.status': obj({'state':states,'reasonCode':{'anyOf':[text(),{'type':'null'}]}}),
 'message.delta':obj({'messageId':uuid,'text':text()}),
 'tool.started':obj({'requestId':uuid,'tool':text()}),
 'tool.completed':obj({'requestId':uuid,'resultReference':uuid}),
 'source.available':ref('SourceEvidence'),
 'approval.required':obj({'proposalId':uuid,'commandSha256':hash256,'expiresAt':date}),
 'artifact.available':obj({'artifactId':uuid,'versionId':uuid}),
 'checkpoint.verified':obj({'checkpointId':uuid}),
 'usage.recorded':obj({'usageId':uuid}),
 'run.error':obj({'code':text(),'retryable':{'type':'boolean'},'message':text()})
}
defs['UIEvent'] = {'oneOf':[obj({'contractVersion':{'const':'0.1.0'},'eventId':uuid,'binding':ref('RunBinding'),'sequence':integer(1),'createdAt':date,'scopes':scopes,'type':{'const':kind},'data':data}) for kind,data in event_data.items()]}
schema = {'$schema':'https://json-schema.org/draft/2020-12/schema','$id':'urn:meri:contracts:0.1.0','title':'Meri shared contracts 0.1.0','$defs':defs}
(dest/'meri.schema.json').write_text(json.dumps(schema,indent=2)+'\n',encoding='utf-8')
package={'name':'meri-greenfield','version':'0.0.0','private':True,'type':'module','engines':{'node':'>=24 <25'},'scripts':{'check:contracts':'node --test packages/contracts/test/*.test.mjs'},'devDependencies':{'ajv':'8.20.0','ajv-formats':'3.0.1','canonicalize':'5.1.0'}}
(root/'package.json').write_text(json.dumps(package,indent=2)+'\n',encoding='utf-8')
print(f'Prepared {len(defs)} independent contract definitions at {dest}')
