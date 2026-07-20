import { WorkflowStatusType } from 'src/app/utils/types';

export interface TierEntryModifiedByUser {
  id?: string;
  username?: string;
  displayName?: string;
  name?: string;
}

export interface TierEntryDisplayFields {
  attack_id?: string;
  name?: string;
  description?: string;
  modified_by_user?: TierEntryModifiedByUser;
}

export interface MemberEntry {
  object_ref: string;
  object_modified: Date;
}

export interface StagedEntry extends TierEntryDisplayFields {
  object_ref: string;
  object_modified: Date;
  object_status: WorkflowStatusType;
  object_staged_at: Date;
  object_staged_by: string;
}

export interface CandidateEntry extends TierEntryDisplayFields {
  object_ref: string;
  object_modified: Date;
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
