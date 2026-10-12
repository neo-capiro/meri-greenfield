/** Owned transactions over a trusted pg 8.23.1-compatible pool. No import-time I/O. */
export class BudgetStateDenied extends Error {}
export class BudgetCommitUncertain extends BudgetStateDenied {}
export const refuse = code => { throw new BudgetStateDenied(code); };

export class PostgresBudgetStore {
  constructor(pool) {
    if (!pool || typeof pool.connect !== 'function') refuse('TRUSTED_POOL_REQUIRED');
    this.pool = pool;
  }
  async transact(operation, check = () => {}) {
    let client; let begun = false; let committing = false; let result; let failure; let reusable = false;
    try {
      check(); client = await this.pool.connect(); check();
      await client.query('BEGIN'); begun = true; check();
      await client.query("SET LOCAL statement_timeout = '5s'"); check();
      await client.query("SET LOCAL lock_timeout = '2s'"); check();
      result = await operation(client); check();
      committing = true;
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
    const row = (await client.query('SELECT * FROM meri_qualification.budget WHERE id=1 FOR UPDATE')).rows[0];
    if (!row) refuse('BUDGET_UNAVAILABLE');
    const now = (await client.query('SELECT clock_timestamp() AS now')).rows[0]?.now;
    if (!(now instanceof Date) || !Number.isFinite(now.getTime())) refuse('DATABASE_TIME_UNAVAILABLE');
    return { ...row, now };
  }
}
