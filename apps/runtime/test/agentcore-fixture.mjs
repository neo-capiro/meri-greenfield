/** Synthetic deployment facts only. No credentials, clients or effects are allocated here. */
import {versions} from '../../control/conversations/test/application-fixture.mjs';
import {MODEL_CATALOG} from '../../../packages/contracts/test/model-selection-fixture.mjs';
export function agentcoreConfig(){return {
 runtimeArn:'arn:aws:bedrock-agentcore:us-east-1:967807252336:runtime/meri_preview-synthetic',runtimeVersion:'2',qualifier:'preview',
 identity:{origin:'https://core.synthetic.invalid',},policyRevision:'policy-v1',runWindowMs:900000,maxOutputBytes:262144};}
export function agentcoreControlFixture(){return {configuration:{version:1,profile:'isolated-preview',sourceEnabled:false,
 limits:{startupMs:3000,shutdownMs:1000,requestMs:1000,requestBytes:131072},
 native:{origin:'https://control.synthetic.invalid',capabilityFile:'/run/secrets/control',loopback:false,maxResponseBytes:2097152},
 http:{hostname:'0.0.0.0',port:8080,frontendOrigin:'https://frontend.synthetic.invalid'},
 privateHttp:{hostname:'0.0.0.0',port:8082,frontendOrigin:'https://control.synthetic.invalid'},
 database:{connectionFile:'/run/secrets/database'},temporal:{address:'temporal.synthetic.invalid:7233',namespace:'meri-first',taskQueue:'meri-v1',
 tls:{caFile:'/run/secrets/ca',certFile:'/run/secrets/cert',keyFile:'/run/secrets/key'}},
 sessions:{mode:'process-local',replicas:1,maxSessions:10,maxTtlMs:300000},versions,agentcore:agentcoreConfig(),models:structuredClone(MODEL_CATALOG)}};}
