/** Canonical owner pair lease composition; observations come only from pinned AWS discovery. */
import {createProductServicePairDiscovery,parseProductServicePairConfiguration} from './service-pair-discovery.mjs';
import {createOwnerPairLease} from './owner-pair-lease.mjs';
export async function createProductServiceTaskLeaseReader(configuration,dependencies={}){
 const pins=parseProductServicePairConfiguration(configuration.configuration);
 return createOwnerPairLease({pins,createDiscovery:()=>createProductServicePairDiscovery(configuration),
  now:configuration.now,maxLeaseMs:configuration.limits.maxLeaseMs,maxRequestMs:configuration.limits.maxRequestMs,
  enabled:configuration.enabled??false,...dependencies});
}
