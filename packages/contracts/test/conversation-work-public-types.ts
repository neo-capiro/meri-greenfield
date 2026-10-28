import {receiveConversationRequest,type ConversationSubmitRequest,type ConversationStoredRequest,type AdmittedConversationRequest} from '@capiro/meri-contracts/conversation-application';
const dto:ConversationSubmitRequest={requestId:'00000000-0000-4000-8000-000000000001',prompt:'Hello',windowRequest:{basis:'unbounded'}};
// both frozen entries and all four frozen job kinds are typed, and no member grants authority
const startWork:ConversationSubmitRequest={...dto,work:{entry:'start-work',jobKind:'research',deliverables:[],dependencies:[]}};
const delegate:ConversationSubmitRequest={...dto,work:{entry:'delegate',jobKind:'scheduled',deliverables:['brief'],dependencies:['c9212b08']}};
const entry:'start-work'|'delegate'=startWork.work!.entry;
const kind:'research'|'deliverable'|'audit'|'scheduled'=delegate.work!.jobKind;
const storedWork:ConversationStoredRequest['work']=delegate.work!;
// the actual successor receiver admits the member and retains its typed shape
const admitted:AdmittedConversationRequest<'submit'>=receiveConversationRequest('submit',new TextEncoder().encode(JSON.stringify(delegate)));
const retained:ConversationStoredRequest['work']=admitted.work;
// @ts-expect-error a work label is never an approval or consent source
const consent:ConversationSubmitRequest={...dto,work:{entry:'start-work',jobKind:'scheduled',deliverables:[],dependencies:[],consentId:'x'}};
// @ts-expect-error a work label never names a scheduled origin
const origin:ConversationSubmitRequest={...dto,work:{entry:'delegate',jobKind:'scheduled',deliverables:[],dependencies:[],scheduledOrigin:'caller'}};
// @ts-expect-error tool grants are derived by current server owners, not selected here
const grants:ConversationSubmitRequest={...dto,work:{entry:'start-work',jobKind:'audit',deliverables:[],dependencies:[],allowedTools:['x']}};
// @ts-expect-error budget is not a client-selected member of the work label
const budget:ConversationSubmitRequest={...dto,work:{entry:'delegate',jobKind:'deliverable',deliverables:[],dependencies:[],budget:1}};
// @ts-expect-error job kinds are a frozen set, not an open string
const unknownKind:ConversationSubmitRequest={...dto,work:{entry:'start-work',jobKind:'chat',deliverables:[],dependencies:[]}};
// @ts-expect-error entries are a frozen set
const unknownEntry:ConversationSubmitRequest={...dto,work:{entry:'begin',jobKind:'audit',deliverables:[],dependencies:[]}};
// @ts-expect-error a work label cannot mark itself privileged
const privileged:ConversationSubmitRequest={...dto,work:{entry:'start-work',jobKind:'audit',deliverables:[],dependencies:[],privileged:true}};
void entry;void kind;void storedWork;void retained;void consent;void origin;void grants;void budget;void unknownKind;void unknownEntry;void privileged;
