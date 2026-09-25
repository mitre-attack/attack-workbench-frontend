import { ReleaseTrackType } from './enums';

export interface ReleaseTrack {
  track_id: string;
  type: ReleaseTrackType;
  name: string;
  /** Optional URL-safe slug accepted wherever the track ID is. */
  alias?: string | null;
  description?: string;
  created_at: Date;
  updated_at: Date;

  latest_snapshot_modified?: Date | null;
  latest_tagged_version?: string | null;
  snapshot_count?: number;
  tagged_release_count?: number;

  // virtual tracks only
  snapshot_schedule?: SnapshotSchedule;
}

export type SnapshotSchedule =
  | { mode: 'manual'; cron?: never; dates?: never; draft_retention?: never }
  | {
      mode: 'dates';
      dates: (Date | string)[];
      cron?: never;
      draft_retention?: never;
    }
  | {
      mode: 'cron';
      cron: string;
      dates?: never;
      draft_retention?: DraftRetention;
    };

export interface DraftRetention {
  max_drafts: number | null;
}

export interface DraftCleanupResult {
  operation_id: string;
  status: 'pending' | 'completed' | 'failed';
  kind: 'retention' | 'squash';
  eligible_count: number;
  deleted_count: number;
  protected_count: number;
  target_modified?: string;
  release_committed?: boolean;
  error?: string;
}

export interface DraftSquashPreview {
  lower_bound: string | null;
  upper_bound: string;
  eligible_count: number;
  protected_count: number;
  fingerprint: string;
}
