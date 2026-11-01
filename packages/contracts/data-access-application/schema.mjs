/** The data-access center read: what the actor's runs can read right now, for a selected client or General. Derived from the
 * reader's actual answer (`apps/control/data-access/reader.mjs`); it grants nothing and is not deployment or installation evidence. */
export const DATA_ACCESS_SCHEMA_ID='urn:meri:data-access-application:0.1.0';
export const DATA_ACCESS_SCHEMA_VERSION='meri.data-access/1';
const UUID='^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$',MILLIS='^\\d{4}-\\d{2}-\\d{2}T\\d{2}:\\d{2}:\\d{2}\\.\\d{3}Z$';
const object=(properties,required=Object.keys(properties))=>({type:'object',properties,required,additionalProperties:false});
const ref=name=>({$ref:'#/$defs/'+name});
export function dataAccessSchema({errorStatuses,fieldPattern,states,requirements}){return {$schema:'https://json-schema.org/draft/2020-12/schema',$id:DATA_ACCESS_SCHEMA_ID,$defs:{
 DataAccessClientId:{anyOf:[{type:'string',pattern:UUID},{type:'null'}]},
 DataAccessRequest:object({clientId:ref('DataAccessClientId')}),
 DataAccessState:{enum:[...states]},
 /** One constructible read family: what it covers and which result fields carry freshness come from the family guidance; the
  * state is the reader's composition of installation, policy and client scope. `requires` names a connection the member
  * must own besides policy; the caller joins it with their own connections rather than this contract claiming one. */
 DataAccessFamily:object({family:{type:'string',pattern:'^[a-z][a-z0-9-]{0,63}$'},covers:{anyOf:[{type:'string',minLength:1,maxLength:240},{type:'null'}]},
  freshness:{anyOf:[{type:'string',minLength:1,maxLength:260},{type:'null'}]},structured:{type:'boolean'},clientScope:{enum:['required','optional']},
  state:ref('DataAccessState'),
  requires:{anyOf:[{enum:[...requirements]},{type:'null'}]}}),
 /** A relation the describe path publishes; client_records relations need a selected client. */
 DataAccessRelation:object({name:{type:'string',pattern:'^[a-z][a-z0-9_]{0,63}$'},source:{enum:['public','client_records']},state:ref('DataAccessState')}),
 DataAccessResponse:object({schemaVersion:{const:DATA_ACCESS_SCHEMA_VERSION},checkedAt:{type:'string',pattern:MILLIS},clientId:ref('DataAccessClientId'),generalReads:{type:'boolean'},
  families:{type:'array',items:ref('DataAccessFamily'),maxItems:256},relations:{type:'array',items:ref('DataAccessRelation'),maxItems:256}}),
 DataAccessErrorResponse:object({error:object({code:{type:'string',enum:Object.keys(errorStatuses)},outcome:{enum:['NOT_DISPATCHED']},field:{type:'string',pattern:fieldPattern}},['code'])}),
}};}
