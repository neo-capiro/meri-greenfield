import type {ConversationSubmitRequest,ConversationStoredRequest} from '@capiro/meri-contracts/conversation-application';
import type {ConversationInitialInputRequest} from '@capiro/meri-contracts/conversation-initial-input';
import type {ConversationInputAdmittedResponse} from '@capiro/meri-contracts/conversation-input';
import type {ConversationHistoryTranscriptResponse} from '@capiro/meri-contracts/conversation-history';
const revision={artifactId:'id',versionId:'id',objectSha256:'a'.repeat(64)};
const request:ConversationSubmitRequest={requestId:'id',prompt:'Revise',skill:{skillId:'quick_skill.cited_report',skillVersion:'1.0.0'},documentRevision:revision,uploads:[{uploadId:'id',sha256:'b'.repeat(64)}]};
const allocation:ConversationInitialInputRequest=request;
const stored:ConversationStoredRequest={...request,skill:{skillId:'quick_skill.cited_report',skillVersion:'1.0.0',manifestSha256:'c',proseSha256:'d',catalogSha256:'e'},window:null,windowRequest:null};
const admitted:ConversationInputAdmittedResponse['request']=stored,history:ConversationHistoryTranscriptResponse['turns'][number]['request']=stored;
// @ts-expect-error the additive identity set stays closed
const invented:ConversationSubmitRequest={requestId:'id',prompt:'Revise',skill:{skillId:'quick_skill.invented_report',skillVersion:'1.0.0'}};
void [allocation,admitted,history,invented];
