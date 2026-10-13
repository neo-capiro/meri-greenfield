/** Explicit owned fixture composition; never imported by a product entry point. */
import {types} from 'node:util';
import {createDocumentApplication} from '../index.mjs';
import {createActionSessionApplication,actionSessionPath} from '../../action-host/session/http.mjs';
import {bindPreparedBriefArtifactOptions} from '../research-brief/binding.mjs';

export function mountLocalDocumentApplication(fixture,{enabled = true,researchBrief} = {}) {
  const {sessions,selectedClientId,artifactOptions,credential,now,limits} = fixture;
  const app = createDocumentApplication({sessions: {authenticateSession: sessions.authenticateSession,readCurrentState: sessions.readCurrentState},
    selectedClientId,artifactOptions:researchBrief===undefined?artifactOptions:bindPreparedBriefArtifactOptions(researchBrief,artifactOptions),credential,now,limits,enabled});
  const issuance = createActionSessionApplication({owner: sessions,now,maxRequestMs: 3000});
  const url = Object.getOwnPropertyDescriptor(Request.prototype,'url').get;
  return Object.freeze({async handle(request) {
    if (!types.isProxy(request) && request instanceof Request && new URL(url.call(request)).pathname === actionSessionPath) return issuance.handle(request);
    return app.handle(request);
  }});
}
