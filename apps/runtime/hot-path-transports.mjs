/** Owned transports preserve the libraries' effective defaults and the caller's AbortSignal. */
import {Agent} from 'undici';
import {NodeHttpHandler} from '@smithy/node-http-handler';
import {budget} from '../../packages/runtime/hot-path-budgets.mjs';

export function createHotPathFetch(table,{fetchImpl=globalThis.fetch}={}){
 if(typeof fetchImpl!=='function')throw new TypeError('HOT_PATH_FETCH_CONFIGURATION');
 const dispatcher=new Agent({connect:{timeout:budget(table,'fetch.connect')},
  headersTimeout:budget(table,'fetch.headers'),bodyTimeout:budget(table,'fetch.body')});
 return Object.freeze({fetch:(input,init)=>fetchImpl(input,{...init,dispatcher}),close:()=>dispatcher.close()});
}

export function createHotPathAwsRequestHandler(table){
 return new NodeHttpHandler({connectionTimeout:budget(table,'aws.connection'),requestTimeout:budget(table,'aws.request')});
}
