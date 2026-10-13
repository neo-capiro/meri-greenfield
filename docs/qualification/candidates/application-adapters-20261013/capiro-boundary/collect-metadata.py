#!/usr/bin/env python3
"""Offline Git-object identities only; no source bodies, imports, service calls or credentials."""
import hashlib,json,pathlib,subprocess
OUT=pathlib.Path(__file__).resolve().parent
REPOS={
 'capiro':('/workspace/capirov2','4be13b0b1ed0f2f3fa014040eedbb2fc2c27dace'),
 'frontend':('/workspace/capiro-frontend','02c02d95bdf3949662b9123f425271c6491ffdab'),
 'meri':('/tmp/meri-action-session-20261013','ad0bdfeb830fee11f1f39c4a8a7037215595c4cf')}
FILES={
'capiro':[
('clerk','apps/api/src/auth/clerk.service.ts',[('verifySessionToken',77,101),('change_control',1,12)]),
('tenant','apps/api/src/tenant/tenant-context.middleware.ts',[('verified_principal',111,134),('membership_and_selfheal',146,305),('impersonation_and_context',307,366)]),
('shared','packages/shared/src/index.ts',[('TenantContext',195,201)]),
('me','apps/api/src/users/users.controller.ts',[('me',99,154)]),
('app','apps/api/src/app.module.ts',[('middleware_registration',148,179)]),
('http','apps/api/src/bootstrap/configure-api-http-app.ts',[('api_prefix',76,87)]),
('context_decorator','apps/api/src/tenant/current-tenant.decorator.ts',[('CurrentTenant',10,20)]),
('conversation','apps/api/src/meri/meri.service.ts',[('getConversation',544,549),('active_and_archived_owners',873,906),('ensureClientVisible',955,963)]),
('routes','apps/api/src/meri/meri.controller.ts',[('controller',310,312),('conversation_get',357,361),('research_run_active',969,984)]),
('scope','apps/api/src/context/context-security-scope.service.ts',[('resolve',27,61),('client_wall',64,92),('mailbox_owner',95,125)]),
('scope_types','apps/api/src/context/context.types.ts',[('scope_upper_bounds',33,45),('ui_hints',64,70)]),
('portfolio','apps/api/src/research-portfolios/research-portfolio-artifact-authority.ts',[('conversation_authority',37,72)]),
('webhook','apps/api/src/webhooks/clerk-webhook.service.ts',[('user_deleted',154,174),('membership_deleted',237,254),('unsupported_event_noop',256,267)]),
('research','apps/api/src/meri/meri-research.service.ts',[('assertRunActive',1039,1045)]),
('research_state','apps/api/src/meri/meri-research-run-state.ts',[('ResearchRunState',55,75)]),
('prisma','apps/api/prisma/schema.prisma',[('TenantMembership',652,672),('ClientMemoryAccess',1003,1028),('ClioConversation',2036,2071),('AiRun',2680,2725),('unrelated_filing_fence',16397,16423)])],
'frontend':[
('frontend_rules','AGENTS.md',[]),('frontend_architecture','docs/ARCHITECTURE.md',[]),
('frontend_auth_route','apps/portfolio-web/src/app/api/backend/[service]/[...path]/route.ts',[('Clerk_template_proxy',1,24)]),
('frontend_proxy','apps/portfolio-web/src/shared/api/proxy.ts',[('allowed_roots',2,24),('token_forwarding',96,131)]),
('frontend_session','apps/portfolio-web/src/shared/auth/SessionBoundary.tsx',[])],
'meri':[
('meri_instructions','AGENTS.md',[]),('meri_standards','docs/IMPLEMENTATION-STANDARDS.md',[]),
('session_readme','apps/control/action-host/session/README.md',[]),
('session_owner','apps/control/action-host/session/owner.mjs',[]),
('current_authority','apps/gateway/authorization/current-tool-authority.mjs',[('injected_currentRun',1,42),('final_currentRun',81,88)]),
('qualification_registry','apps/control/qualification-sdk-fixture/state/registry.mjs',[('qualification_scope_only',1,15)]),
('synthetic_current_run','apps/control/action-host/local-integration/ports.mjs',[])]}
def git(root,*args):return subprocess.check_output(['git','-C',root,*args],stderr=subprocess.PIPE)
refs=[]
for name,items in FILES.items():
 root,commit=REPOS[name]
 for id,path,locators in items:
  content=git(root,'show',commit+':'+path)
  refs.append({'id':id,'repository':name,'commit':commit,'path':path,'blob':git(root,'rev-parse',commit+':'+path).decode().strip(),'sha256':hashlib.sha256(content).hexdigest(),'bytes':len(content),'locators':[{'symbol':s,'firstLine':a,'lastLine':b} for s,a,b in locators]})
result={'kind':'immutable-source-metadata-only','capturedAtUtc':'2026-10-13','repositories':{k:{'path':v[0],'commit':v[1]} for k,v in REPOS.items()},'references':refs,'privateBodiesRetained':False,'runtimeExecuted':False}
(OUT/'reference-identities.json').write_text(json.dumps(result,indent=2)+'\n')
print(json.dumps({'references':len(refs),'privateBodiesRetained':False,'runtimeExecuted':False}))
