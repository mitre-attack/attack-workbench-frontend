/** Snapshot-local invocation identity, distinct from the original track creator. */
export interface SnapshotCreationActor {
  kind: 'user' | 'system' | 'unknown';
  user_account_id?: string;
  user?: {
    id: string;
    name?: string;
    displayName?: string;
    username?: string;
  };
}
