import {canonicalSha256} from '../validate.mjs';
export const workflowManifest=Object.freeze({schema:'meri-site-workflow-manifest/0',siteId:'synthetic-records',workflowId:'download-filings',version:1,
 taskSummary:'Read synthetic filings',origins:['https://records.example'],idpOrigins:[],signInUrl:'https://records.example/login',
 signedInProbe:{kind:'selector',value:'#account'},sensitiveSelectors:['#secret'],tools:['browser_navigate','browser_snapshot','browser_click'],
 approvalRequired:['browser_click'],downloads:{formats:['txt'],maxBytes:4096,maxFiles:1},sessionTtlMs:60000,
 logoutUrl:null,tosReviewRef:'terms/synthetic',qualificationEvidenceRef:'qualification/synthetic'});
export const workflowSelection=Object.freeze({siteId:workflowManifest.siteId,workflowId:workflowManifest.workflowId,version:1,manifestSha256:canonicalSha256(workflowManifest)});
export const workflowCurrent=()=>({manifest:structuredClone(workflowManifest),manifestSha256:workflowSelection.manifestSha256,enabled:true});
