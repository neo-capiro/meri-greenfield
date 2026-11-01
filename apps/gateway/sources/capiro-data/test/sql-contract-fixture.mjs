/** Shared wire fixture: grammar copied from Core362's gate constants, never used to admit SQL. */
import {canonicalSha256} from '../../../../../packages/contracts/validate.mjs';
export const grammar={
  "version": "postgresql-select/1",
  "statements": [
    "SELECT",
    "WITH_SELECT"
  ],
  "parameterStyle": "dollar-numbered-contiguous",
  "blockedKeywords": [
    "insert",
    "update",
    "delete",
    "merge",
    "into"
  ],
  "blockedFunctions": [
    "set_config",
    "pg_sleep",
    "pg_sleep_for",
    "pg_sleep_until",
    "pg_terminate_backend",
    "pg_cancel_backend",
    "pg_advisory_lock",
    "pg_advisory_lock_shared",
    "pg_advisory_xact_lock",
    "pg_advisory_xact_lock_shared",
    "pg_try_advisory_lock",
    "pg_try_advisory_lock_shared",
    "pg_try_advisory_xact_lock",
    "pg_try_advisory_xact_lock_shared",
    "pg_advisory_unlock",
    "pg_advisory_unlock_all",
    "pg_advisory_unlock_shared",
    "pg_notify",
    "pg_reload_conf",
    "pg_rotate_logfile",
    "pg_logical_emit_message",
    "pg_export_snapshot",
    "pg_read_file",
    "pg_read_binary_file",
    "pg_ls_dir",
    "pg_stat_file",
    "lo_import",
    "lo_export",
    "lo_get",
    "lo_put",
    "lo_create",
    "lo_creat",
    "lo_unlink",
    "lo_open",
    "lo_from_bytea",
    "loread",
    "lowrite",
    "dblink",
    "dblink_connect",
    "dblink_exec"
  ],
  "blockedFunctionPatterns": [],
  "sourceMixing": false
};
export function withSqlContract(page){
 const result=structuredClone(page),limits=result.limits;
 const contract={version:'capiro.sql-contract/1',source:result.scope?'client_records':'public',grammar:structuredClone(grammar),limits,columnCountLimit:null};
 result.contract={...contract,revisionSha256:canonicalSha256({...contract,relations:result.relations})};
 return result;
}
