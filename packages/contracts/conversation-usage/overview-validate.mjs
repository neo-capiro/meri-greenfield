import Ajv from 'ajv/dist/2020.js';import formats from 'ajv-formats';
import {data} from '../commands-0.2/execution-boundary.mjs';
import {usageOverviewSchema} from './overview-schema.mjs';
import {assertUsageOverviewSemantics,overviewFail} from './overview-semantics.mjs';
const schema=usageOverviewSchema(),ajv=new Ajv({strict:true,allErrors:false});formats(ajv);ajv.addSchema(schema);
const request=ajv.compile({$ref:schema.$id+'#/$defs/UsageOverviewRequest'}),response=ajv.compile({$ref:schema.$id+'#/$defs/UsageOverviewResponse'});
export function assertUsageOverviewRequest(raw){const value=data(raw);if(!request(value))overviewFail('USAGE_OVERVIEW_REQUEST_INVALID');return value;}
export function assertUsageOverviewResponse(raw){const value=data(raw);if(!response(value))overviewFail('INVALID_USAGE_OVERVIEW');return assertUsageOverviewSemantics(value);}
