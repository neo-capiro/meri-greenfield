/** Owned transactions over a trusted pg 8.23.1-compatible pool. No import-time I/O. */
import {budgetTables} from './namespace.mjs';
export class BudgetStateDenied extends Error {}
export class BudgetCommitUncertain extends BudgetStateDenied {}
export const refuse = code => { throw new BudgetStateDenied(code); };

export class PostgresBudgetStore {
  constructor(pool,{namespace}={}) {
    this.tables=budgetTables(namespace);
    if(!this.tables)refuse('BUDGET_NAMESPACE_REFUSED');
    if (!pool || typeof pool.connect !== 'function') refuse('TRUSTED_POOL_REQUIRED');
    this.pool = pool;
  }
  async transact(operation, check = () => {}, onCommitting, readOnly = false) {
    if(typeof readOnly!=='boolean'||readOnly&&onCommitting!==undefined)refuse('TRANSACTION_CONFIGURATION');
    if(onCommitting!==undefined&&typeof onCommitting!=='function')refuse('TRANSACTION_OBSERVER_REFUSED');
    let client; let begun = false; let committing = false; let result; let failure; let reusable = false;
    try {
      check(); client = await this.pool.connect(); check();
      await client.query(readOnly?'BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY':'BEGIN'); begun = true; check();
      await client.query("SET LOCAL statement_timeout = '5s'"); check();
      await client.query("SET LOCAL lock_timeout = '2s'"); check();
      result = await operation(client); check();
      committing = true;
      onCommitting?.();
      await client.query('COMMIT'); check(); reusable = true;
    } catch (error) {
      if (committing) failure = new BudgetCommitUncertain('COMMIT_ACKNOWLEDGEMENT_UNKNOWN');
      else {
        if (begun) { try { await client.query('ROLLBACK'); reusable = true; } catch {} }
        failure = error instanceof BudgetStateDenied ? error : new BudgetStateDenied('BUDGET_STATE_UNAVAILABLE');
      }
    } finally {
      if (client) {
        // Any failed transaction/BEGIN acknowledgement may leave protocol or
        // transaction state unknown. pg release(error) evicts it from the pool.
        try { client.release(reusable ? undefined : failure); }
        catch { failure ??= new BudgetCommitUncertain('CONNECTION_RELEASE_UNKNOWN'); }
      }
    }
    if (failure) throw failure;
    return result;
  }
  async lock(client) {
    return this.readBudget(client,true);
  }
  async read(client) {
    return this.readBudget(client,false);
  }
  async readBudget(client,locked) {
    const row = (await client.query(`SELECT * FROM ${this.tables.budget} WHERE id=1${locked?' FOR UPDATE':''}`)).rows[0];
    if (!row) refuse('BUDGET_UNAVAILABLE');
    const now = (await client.query('SELECT clock_timestamp() AS now')).rows[0]?.now;
    if (!(now instanceof Date) || !Number.isFinite(now.getTime())) refuse('DATABASE_TIME_UNAVAILABLE');
    return { ...row, now };
  }
}
