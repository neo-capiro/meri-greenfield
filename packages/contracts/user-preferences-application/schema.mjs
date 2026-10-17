import {USER_PREFERENCES_DOCUMENT_SCHEMA} from './document.mjs';
export const USER_PREFERENCES_SCHEMA_ID='urn:meri:user-preferences-application:0.1.0';
const object=(properties,required=Object.keys(properties))=>({type:'object',properties,required,additionalProperties:false});
const ref=name=>({$ref:'#/$defs/'+name});
export function userPreferencesSchema({errorStatuses,errorOutcomes,fieldPattern}){return {$schema:'https://json-schema.org/draft/2020-12/schema',$id:USER_PREFERENCES_SCHEMA_ID,$defs:{
 UserPreferences:USER_PREFERENCES_DOCUMENT_SCHEMA,
 UserPreferencesOwner:{$ref:'urn:meri:contracts:0.1.0#/$defs/Identity'},
 UserPreferencesReadRequest:object({}),
 UserPreferencesSaveRequest:object({expectedRevision:{type:'integer',minimum:0,maximum:Number.MAX_SAFE_INTEGER-1},preferences:ref('UserPreferences')}),
 UserPreferencesResponse:object({owner:ref('UserPreferencesOwner'),revision:{type:'integer',minimum:0,maximum:Number.MAX_SAFE_INTEGER},preferences:ref('UserPreferences')}),
 UserPreferencesErrorResponse:object({error:object({code:{type:'string',enum:Object.keys(errorStatuses)},outcome:{type:'string',enum:errorOutcomes},field:{type:'string',pattern:fieldPattern}},['code'])}),
 }};}
