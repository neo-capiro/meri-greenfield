import {objectiveGenerationStartMetadata,requireObjectiveGenerationStartRequest,receiveObjectiveGenerationStartResponse,
 type ObjectiveGenerationStartRequest} from '@capiro/meri-contracts/objective-generation';
const request:ObjectiveGenerationStartRequest=requireObjectiveGenerationStartRequest({generationJobId:'synthetic'});
const response=receiveObjectiveGenerationStartResponse(202,'{}',request.generationJobId);
const path:'/api/objective-generation/start'=objectiveGenerationStartMetadata.path;
if('error' in response){const code:string=response.error.code;void code;}
else {const state:'requested'=response.state;void state;}
// @ts-expect-error wire body cannot choose a tenant or a run
const forged:ObjectiveGenerationStartRequest={generationJobId:'synthetic',tenantId:'foreign'};
void path;void forged;
