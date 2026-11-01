import {receiveDataAccessRequest,receiveDataAccessResponse,dataAccessMetadata,DataAccessResponseError,type DataAccessRequest,type DataAccessResponse,type DataAccessErrorResponse,type DataAccessFamily,type DataAccessRelation,type DataAccessState} from '@capiro/meri-contracts/data-access-application';
const request:DataAccessRequest=receiveDataAccessRequest(JSON.stringify({clientId:null}));
const response=receiveDataAccessResponse(200,'{}',request);
const exact:DataAccessResponse|DataAccessErrorResponse=response;void exact;
if(!('error'in response)){
 const version:'meri.data-access/1'=response.schemaVersion,client:string|null=response.clientId,reads:boolean=response.generalReads;void version;void client;void reads;
 for(const family of response.families){const row:DataAccessFamily=family;const state:DataAccessState=row.state;const requires:'mailbox'|null=row.requires;const scope:'required'|'optional'=row.clientScope;void state;void requires;void scope;
  const covers:string|null=row.covers,freshness:string|null=row.freshness,structured:boolean=row.structured;void covers;void freshness;void structured;
  // @ts-expect-error operation names are not part of the wire contract
  const operations=row.operations;void operations;}
 for(const relation of response.relations){const row:DataAccessRelation=relation;const source:'public'|'client_records'=row.source;void row;void source;}
 const closed:'not_installed'|'policy_off'|'client_required'|'available'=response.families[0]!.state;void closed;
}
const path:'/api/data-access/read'=dataAccessMetadata.routes.read.path,status:403=dataAccessMetadata.errorStatuses.DATA_ACCESS_CLIENT_REFUSED;void path;void status;
const error:DataAccessResponseError|undefined=undefined;void error;
// @ts-expect-error receiving a response never issues read authority
const authorized:{authorized:true}=response;void authorized;
// @ts-expect-error the captured request is mandatory
receiveDataAccessResponse(200,'{}');
// @ts-expect-error the page has no control that changes policy
const control:{enable:boolean}=response;void control;
// @ts-expect-error the state vocabulary is closed
const wrong:DataAccessState='granted';void wrong;
