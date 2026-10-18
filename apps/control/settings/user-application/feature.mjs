/** Explicit user-preferences composition; disabled construction touches no membership, store or native owner. */
import {randomUUID} from 'node:crypto';
import {own} from '../../../../packages/contracts/commands-0.2/execution-boundary.mjs';
import {ProductError} from '../../product-access/errors.mjs';
import {createPostgresSettingsStore} from '../postgres-store.mjs';
import {createUserPreferencesService} from '../user-service.mjs';
import {createUserPreferencesApplication} from './index.mjs';
import {USER_PREFERENCES_LIMITS} from './protocol.mjs';
export function createUserPreferencesFeature(configuration){
 const c=own(configuration,['enabled'],['gate','pool','now','newId','limits']);
 if(typeof c.enabled!=='boolean')throw new ProductError('PRODUCT_CONFIGURATION');
 if(!c.enabled)return null;
 const now=c.now??Date.now,newId=c.newId??randomUUID;
 const store=createPostgresSettingsStore({pool:c.pool}),service=createUserPreferencesService({store,newId});
 const application=createUserPreferencesApplication({gate:c.gate,service,now,limits:c.limits??USER_PREFERENCES_LIMITS});
 return Object.freeze({application});
}
