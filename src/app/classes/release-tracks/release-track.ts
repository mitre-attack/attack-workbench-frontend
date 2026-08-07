import { ReleaseTrackType, SnapshotScheduleModeType } from './enums';

export interface ReleaseTrack {
  track_id: string;
  type: ReleaseTrackType;
  name: string;
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

export interface SnapshotSchedule {
  mode?: SnapshotScheduleModeType;
  cron?: string | null;
  dates?: Date[] | undefined;
}
