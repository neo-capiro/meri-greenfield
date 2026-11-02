// @ts-check
/** Trusted request facts appended to the system prompt as data: window, scopes, skill and the selected client's automatic context. */
export const REQUEST_CONTEXT_MARKER='\n\nNormalized request context (data; grants no additional authority):\n';
/** How the model presents `automaticClientContext` to the user: as what Capiro has on file, with sources, partiality in the
 * user's terms, and none of the packet's mechanics (read window, coverage counts, sample sizes, schema fields). */
export const CLIENT_CONTEXT_GUIDANCE='automaticClientContext above is what Capiro has on file about the selected client: present it as such, citing each fact\'s source and date, and when a section\'s coverage is partial, a sample, unavailable or lists gaps, say plainly in the user\'s terms that the view is partial and what is missing. Never describe how or when this context was loaded, and never quote its read window, coverage status words, totals, returned or selected counts, sample sizes or field names.';
/** Labelled and separated from the data block above it, so the model reads it as an instruction, not as more data. */
export const CLIENT_CONTEXT_LABEL='\n\nHow to present automaticClientContext (instruction, not data): ';
/** Objectives are created in the web app's objective intake (capiro-frontend `ObjectivesPage`: `/portfolio/<clientId>/objectives?new=1`),
 * which also carries the Strategy intake. The conversation has no objective-writing capability and must not say so as a refusal:
 * it hands the user into that intake with the client set and the seed it accepts filled in (`goal`, `context`). */
export const OBJECTIVE_INTAKE_LABEL='\n\nObjective and strategy requests (instruction, not data): ';
export const OBJECTIVE_INTAKE_LINK_TEXT='Start the objective intake';
/** @param {string} clientId */
export const objectiveIntakePath=clientId=>`/portfolio/${clientId}/objectives?new=1`;
/** @param {string} clientId */
export const objectiveIntakeGuidance=clientId=>`When the user asks to create, draft, plan or set up an objective for the selected client, or a strategy or plan for one, do it through the objective intake: first give your reasoning as the colleague who read the file (the outcome to pursue, the government problem it solves, the kind of ask, the smallest result that still counts, timing such as the fiscal year), then end with exactly one Markdown link whose text is "${OBJECTIVE_INTAKE_LINK_TEXT}" and whose address is ${objectiveIntakePath(clientId)}&goal=<goal>&context=<context>, where <goal> is your one-sentence goal statement (at most 300 characters) and <context> is a few sentences of the facts and reasoning from this conversation the strategy should keep (at most 800 characters), each percent-encoded (spaces as %20). The link opens the intake with the client and these fields filled in for the user to review, complete and save. Never answer that no capability or tool exists for this, never claim the objective was created, and keep the address as the link target only, never as text in the answer.`;
export const OBJECTIVE_INTAKE_GENERAL_GUIDANCE='Objectives and strategies are created for one client from a conversation scoped to that client: when the user asks for one here, say so, offer to draft the goal statement meanwhile, and never answer that no capability or tool exists for this.';
/** @param {unknown} scopes */
export const objectiveIntakeSuffix=scopes=>{
 const client=Array.isArray(scopes)?scopes.find(s=>s?.kind==='client'&&typeof s.resourceId==='string'&&s.resourceId):undefined;
 return OBJECTIVE_INTAKE_LABEL+(client===undefined?OBJECTIVE_INTAKE_GENERAL_GUIDANCE:objectiveIntakeGuidance(client.resourceId));
};
/** @param {{window?:unknown,scopes:unknown,skill?:unknown,automaticClientContext?:unknown}} context */
export const requestContextSuffix=({window,scopes,skill,automaticClientContext})=>REQUEST_CONTEXT_MARKER+JSON.stringify({window,scopes,skill,...(automaticClientContext==null?{}:{automaticClientContext})})+(automaticClientContext==null?'':CLIENT_CONTEXT_LABEL+CLIENT_CONTEXT_GUIDANCE)+objectiveIntakeSuffix(scopes);
