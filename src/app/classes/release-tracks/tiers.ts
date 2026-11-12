import { WorkflowStatusType } from 'src/app/utils/types';
import { SnapshotTier } from './enums';

export type ReleaseTrackObjectTier =
  SnapshotTier.Candidate | SnapshotTier.Staged;

export type WorkflowRevisionSelector = Date | 'latest';

export interface TierEntryModifiedByUser {
  id?: string;
  username?: string;
  displayName?: string;
  name?: string;
}

export interface TierEntryDisplayFields {
  attack_id?: string;
  name?: string;
  /** STIX object type of the selected revision */
  type?: string;
  /** ATT&CK version of the selected revision */
  x_mitre_version?: string;
  description?: string;
  modified_by_user?: TierEntryModifiedByUser;
}

export interface MemberEntry extends TierEntryDisplayFields {
  object_ref: string;
  object_modified: Date;
}

export interface StagedEntry extends TierEntryDisplayFields {
  object_ref: string;
  object_modified: WorkflowRevisionSelector;
  object_status: WorkflowStatusType;
  object_staged_at: Date;
  object_staged_by: string;
}

export interface CandidateEntry extends TierEntryDisplayFields {
  object_ref: string;
  object_modified: WorkflowRevisionSelector;
  object_status: WorkflowStatusType;
  object_added_at: Date;
  object_added_by: string;
}

export interface QuarantineEntry {
  object_ref: string;
  object_modified: Date;
  source_track_id: string;
  source_track_name: string;
  source_snapshot_version?: string | null;
  conflict_reason: string;
}
