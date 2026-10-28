import Ajv from 'ajv/dist/2020.js';import formats from 'ajv-formats';
import {data} from '../commands-0.2/execution-boundary.mjs';
import {usageOverviewSchema,usageOverviewSchemaV2} from './overview-schema.mjs';
import {assertUsageOverviewSemantics,assertUsageOverviewSemanticsV2,overviewFail} from './overview-semantics.mjs';
const schema=usageOverviewSchema(),ajv=new Ajv({strict:true,allErrors:false});formats(ajv);ajv.addSchema(schema);
const request=ajv.compile({$ref:schema.$id+'#/$defs/UsageOverviewRequest'}),response=ajv.compile({$ref:schema.$id+'#/$defs/UsageOverviewResponse'});
export function assertUsageOverviewRequest(raw){const value=data(raw);if(!request(value))overviewFail('USAGE_OVERVIEW_REQUEST_INVALID');return value;}
export function assertUsageOverviewResponse(raw){const value=data(raw);if(!response(value))overviewFail('INVALID_USAGE_OVERVIEW');return assertUsageOverviewSemantics(value);}
// The successor pair compiles from the successor's own resolvable document, so the 2.0.0 urn names the
// schema actually enforced instead of an anchor inside the /1-named document. The v1 pair above still
// compiles from the unchanged /1 document, so ordinary /1 acceptance is byte-for-byte the same.
const schemaV2=usageOverviewSchemaV2(),ajvV2=new Ajv({strict:true,allErrors:false});formats(ajvV2);ajvV2.addSchema(schemaV2);
const request2=ajvV2.compile({$ref:schemaV2.$id+'#/$defs/UsageOverviewRequest2'}),response2=ajvV2.compile({$ref:schemaV2.$id+'#/$defs/UsageOverviewResponse2'});
/** Successor-version assertions over the same closed route. The v1 pair above is unchanged, so an
 * ordinary meri.usage-overview/1 body keeps its exact previous acceptance while a /2 body is refused. */
export function assertUsageOverviewRequestV2(raw){const value=data(raw);if(!request2(value))overviewFail('USAGE_OVERVIEW_REQUEST_INVALID');return value;}
export function assertUsageOverviewResponseV2(raw){const value=data(raw);if(!response2(value))overviewFail('INVALID_USAGE_OVERVIEW');return assertUsageOverviewSemanticsV2(value);}
