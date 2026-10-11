// Content-free failure codes for the qualification current-fence registry.
// A code is the whole message: no value, identity, hash, key, byte or row ever
// enters an error string, and no failure path reveals whether a peer, grant or
// receipt exists.

export class StateDenied extends Error {
  constructor(code) {
    super(code);
    this.name = 'StateDenied';
    this.code = code;
  }
}

/**
 * A transaction reached COMMIT but the acknowledgement was not observed. The
 * registry must never retry, never treat this as a new accepted commit and never
 * release anything it may have written; the caller reconciles by reading the
 * immutable commit row back.
 */
export class CommitUncertain extends StateDenied {
  constructor(code = 'COMMIT_ACKNOWLEDGEMENT_UNKNOWN') {
    super(code);
    this.name = 'CommitUncertain';
  }
}

export function fail(code) {
  throw new StateDenied(code);
}

export function isStateDenied(error) {
  return error instanceof StateDenied;
}
