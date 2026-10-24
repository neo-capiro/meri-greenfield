/** Fixed ordinary user-authenticated projected GET routes; no initialization I/O. */
import { canonicalSha256 } from '../../../../packages/contracts/validate.mjs';
import { assertResearchPortfolioEvidenceOutput } from '../../../../packages/contracts/retrieval-0.2/validate.mjs';
import { createDispatchLifetime } from '../../dispatch/dispatch-lifetime.mjs';
import { deny, safeFailure } from '../../dispatch/operation-result.mjs';
import { frozenData, ownFields } from '../source-admission.mjs';
import { cancelBody, responseBody, readJsonResponse } from '../json-response.mjs';
import { evidenceContext, operation } from './request-context.mjs';
import { projectPortfolioEvidence } from './projection.mjs';

export function createResearchPortfolioEvidenceHttpAdapter(options) {
  const {origin, getCredentials, readSource, fetchImpl=globalThis.fetch, now, maxResponseBytes, maxRequestMs} =
    ownFields(options,['origin','now','maxResponseBytes','maxRequestMs'],['getCredentials','readSource','fetchImpl']);
  if ((readSource === undefined ? typeof getCredentials !== 'function' : typeof readSource !== 'function' || getCredentials !== undefined) || typeof fetchImpl !== 'function' || typeof now !== 'function' ||
      !Number.isSafeInteger(maxResponseBytes) || maxResponseBytes < 1 || maxResponseBytes > 16*1024*1024 ||
      !Number.isSafeInteger(maxRequestMs) || maxRequestMs < 1 || maxRequestMs > 3600000) deny('GATEWAY_CONFIGURATION');
  try {
    const url = new URL(origin);
    if (typeof origin !== 'string' || url.protocol !== 'https:' || url.origin !== origin || url.username || url.password)
      deny('GATEWAY_CONFIGURATION');
  } catch { deny('GATEWAY_CONFIGURATION'); }
  async function read(call) {
    let lifetime, acquiredResponse;
    try {
      const context = evidenceContext(call,now), {input,authority} = context;
      const cutoff=Math.min(context.deadlineMs,now()+maxRequestMs);
      lifetime = createDispatchLifetime({deadlineMs:cutoff,now,signal:context.signal});
      const route = `/api/research-portfolios/${encodeURIComponent(input.portfolioId)}`;
      const paths = input.origin === 'review' ? ['mine','team','deferred','resolved'].map(lane => `${route}/reviews?lane=${lane}`)
        : [input.origin === 'snapshot' ? `${route}/snapshots/${encodeURIComponent(input.recordId)}` : `${route}/annual-review`];
      const responses = [];
      // Each fixed lane uses the selected control transport. The outer
      // canonical dispatcher repeats current authorization before result release.
      for (const [index,path] of paths.entries()) {
        if(readSource){
          const selection={portfolioId:input.portfolioId,...(input.origin==='review'?{source:'reviews',lane:['mine','team','deferred','resolved'][index]}:input.origin==='snapshot'?{source:'snapshot',recordId:input.recordId}:{source:'annual-review'})};
          const value=frozenData(await lifetime.run(signal=>readSource({operation:'job.readResearchEvidenceSource',input:selection,context:frozenData({binding:authority.binding,subject:authority.subject,policyRevision:authority.policyRevision,normalizationContext:null}),deadlineMs:cutoff,signal})));
          lifetime.check();if(Buffer.byteLength(JSON.stringify(value),'utf8')>Math.min(maxResponseBytes,authority.maxOutputBytes))deny('RESOURCE_LIMIT');
          responses.push(value);continue;
        }
        const credentials = frozenData(await lifetime.run(signal => getCredentials(Object.freeze({
          binding:authority.binding, subject:authority.subject, deadlineMs:context.deadlineMs, signal}))));
        ownFields(credentials,['binding','bearerToken','expiresAtMs']);
        if (canonicalSha256(credentials.binding) !== canonicalSha256(authority.binding) ||
            typeof credentials.bearerToken !== 'string' || !/^[\x21-\x7e]{1,8192}$/.test(credentials.bearerToken) ||
            !Number.isSafeInteger(credentials.expiresAtMs) || credentials.expiresAtMs <= now()) deny('ACCESS_DENIED');
        lifetime.limitDeadline(credentials.expiresAtMs);
        const response = await lifetime.run(async signal => {
          const result = await fetchImpl(new URL(path,origin).href, {method:'GET',redirect:'error',
            credentials:'omit',cache:'no-store',signal,headers:{authorization:`Bearer ${credentials.bearerToken}`,
              accept:'application/json','accept-encoding':'identity'}});
          // Own it before the lifetime handoff; an abort between the two await
          // continuations must still cancel a body whose reader was not acquired.
          acquiredResponse = result;
          try { lifetime.check(); return result; }
          catch (error) { try { cancelBody(responseBody(result)); } catch {} throw error; }
        });
        responses.push(await readJsonResponse(response,{lifetime,maxResponseBytes}));
        acquiredResponse = undefined;
      }
      const projected = projectPortfolioEvidence(input.origin === 'review' ? responses : responses[0],input,authority);
      const page = assertResearchPortfolioEvidenceOutput(operation.id,projected,context.request,
        {binding:authority.binding,subject:authority.subject});
      lifetime.check(); return frozenData(page);
    } catch (error) { throw safeFailure(error); }
    finally {
      try { if (acquiredResponse) cancelBody(responseBody(acquiredResponse)); } catch {}
      lifetime?.close();
    }
  }
  return Object.freeze({read});
}
