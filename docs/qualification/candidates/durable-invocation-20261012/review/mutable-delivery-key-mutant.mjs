// In-memory source negative control only. No repository source is modified.
import {registerHooks} from 'node:module';
import {pathToFileURL} from 'node:url';
const target=pathToFileURL(`${process.env.MERI_REVIEW_SOURCE_ROOT}/apps/gateway/budget/tool-invocation-record.mjs`).href;
const from='key: canonicalSha256({ producer: delivery.producer, deliveryId: delivery.deliveryId })';
const to='key: canonicalSha256({ producer: delivery.producer, deliveryId: delivery.deliveryId, context: delivery.context })';
registerHooks({load(url,context,next){const result=next(url,context);if(url!==target)return result;const s=String(result.source);if(!s.includes(from))throw Error('MUTANT_TARGET_NOT_EXACT');return {...result,source:s.replace(from,to)};}});
