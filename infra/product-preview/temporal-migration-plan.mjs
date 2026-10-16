/** Offline ordering contract only. This module never connects to PostgreSQL or runs SQL. */
import {createHash} from 'node:crypto';

export const TEMPORAL_MIGRATION_PLAN=Object.freeze({
 schemaVersion:1,
 status:'source-only-unexecuted',
 serverVersion:'1.32.1',
 serverImageAmd64Digest:'sha256:2695f2564ec51aa84232bf3fa59b31e2cce99bec437a64f5bc487cbe21b2de0e',
 adminToolsImageAmd64Digest:'sha256:4fdaf9122f8beb448c823976232f6616a8cd94687f6984eeaf25c2b1457d5fed',
 databaseKind:'existing-aurora-postgresql',
 observedEngineVersion:'16.11',
 isolatedQualificationPostgresVersion:'16.15',
 plugin:'postgres12',
 stages:Object.freeze([
  Object.freeze({order:1,action:'verify-existing-cluster-and-dedicated-database-owners',
   databases:Object.freeze(['temporal','temporal_visibility']),principal:'independent-qualifier'}),
  Object.freeze({order:2,action:'verify-dedicated-empty-or-exact-retained-schemas',
   databases:Object.freeze(['temporal','temporal_visibility']),principal:'migration-only'}),
  Object.freeze({order:3,action:'apply-primary-versioned-schema',database:'temporal',
   source:'schema/postgresql/v12/temporal/versioned',targetVersion:'1.19',principal:'migration-only'}),
  Object.freeze({order:4,action:'apply-visibility-versioned-schema',database:'temporal_visibility',
   source:'schema/postgresql/v12/visibility/versioned',targetVersion:'1.14',principal:'migration-only'}),
  Object.freeze({order:5,action:'grant-and-prove-distinct-nonowner-runtime-roles',
   databases:Object.freeze(['temporal','temporal_visibility']),principal:'migration-only'}),
  Object.freeze({order:6,action:'readback-schema-roles-and-restore-before-server-start',
   databases:Object.freeze(['temporal','temporal_visibility']),principal:'independent-qualifier'})
 ])
});

export const TEMPORAL_MIGRATION_PLAN_SHA256=createHash('sha256')
 .update(JSON.stringify(TEMPORAL_MIGRATION_PLAN),'utf8').digest('hex');
