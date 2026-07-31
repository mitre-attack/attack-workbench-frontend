import type { WorkflowStatusType } from 'src/app/utils/types';
import type { Composition } from './composition';
import type { ReleaseTrackConfig } from './config';
import {
  ReleaseTrackType,
  type ExportFormatType,
  type ReleasePreviewFormatType,
} from './enums';
import type { SnapshotSchedule } from './release-track';

export type StixObjectRef = string | { id: string; modified?: string };

export interface CreateReleaseTrackPayload {
  name: string;
  description?: string;
  external_references?: any[];
  object_marking_refs?: string[];
  type?: ReleaseTrackType;
  config?: ReleaseTrackConfig;
  composition?: Composition;
  snapshot_schedule?: SnapshotSchedule;
}

export interface StixBundlePayload {
  type: 'bundle';
  id?: string;
  objects: any[];
}

export interface UpdateMetadataPayload {
  name?: string;
  description?: string;
  external_references?: any[];
  object_marking_refs?: string[];
}

export type ReleasePayload =
  | { increment: 'major' | 'minor'; version?: never }
  | { increment?: never; version: string }
  | { increment?: undefined; version?: undefined };

export interface ClonePayload {
  name?: string;
}

export interface ReviewPayload {
  from: WorkflowStatusType;
  to: WorkflowStatusType;
  object_refs?: StixObjectRef[];
}

export interface PromoteQuarantinePayload {
  object_ref: string;
  object_modified: string;
}

export interface ReleaseTrackSnapshotOptions {
  format?: ExportFormatType;
  include?: 'members' | 'staged' | 'candidates' | 'quarantine' | 'all';
  state?: string | string[];
  stixVersion?: '2.0' | '2.1';
  includeToc?: boolean;
}

export interface SnapshotHistoryOptions {
  tagged?: boolean;
  limit?: number;
  offset?: number;
}

export type ReleasePreviewOptions = ReleasePayload & {
  format?: ReleasePreviewFormatType;
};

export interface ReleasePreviewSummaryBase {
  track_id: string;
  type: ReleaseTrackType;
  source_snapshot_modified: string;
  version: string;
  releasable: boolean;
  conflicts: any[];
}

export interface StandardReleasePreviewSummary extends ReleasePreviewSummaryBase {
  type: ReleaseTrackType.Standard;
  before: {
    members_count: number;
    staged_count: number;
    candidates_count: number;
  };
  after: {
    members_count: number;
    staged_count: number;
    candidates_count: number;
  };
  changes: {
    promoted_count: number;
  };
}

export interface VirtualReleasePreviewSummary extends ReleasePreviewSummaryBase {
  type: ReleaseTrackType.Virtual;
  previous_release: {
    version: string;
    modified: string;
  } | null;
  before: {
    members_count: number;
    quarantine_count: number;
  };
  after: {
    members_count: number;
    quarantine_count: number;
  };
  changes: {
    new_count: number;
    updated_count: number;
    removed_count: number;
    quarantined_count: number;
  };
}

export type ReleasePreviewSummary =
  StandardReleasePreviewSummary | VirtualReleasePreviewSummary;

export interface ReleaseTrackSnapshotHistoryItem {
  id?: string;
  modified?: string | Date;
  version?: string | null;
  type?: ReleaseTrackType;
  name?: string;
  description?: string;
  created?: string | Date;
  tagged_at?: string | Date;
  snapshot_id?: string | Date;
  is_latest?: boolean;
  members_count?: number;
  staged_count?: number;
  candidates_count?: number;
  quarantine_count?: number;
  added_count?: number;
  modified_count?: number;
  promoted_count?: number;
  members?: any[];
  staged?: any[];
  candidates?: any[];
  contents?: {
    members?: any[];
    staged?: any[];
    candidates?: any[];
    quarantine?: any[];
    [key: string]: any;
  };
  summary?: {
    members_count?: number;
    staged_count?: number;
    candidates_count?: number;
    quarantine_count?: number;
    added_count?: number;
    modified_count?: number;
    promoted_count?: number;
    quarantined_count?: number;
    [key: string]: any;
  };
  statistics?: {
    [key: string]: any;
  };
  composition_resolution?: {
    total_objects?: number;
    [key: string]: any;
  };
  stix?: {
    id?: string;
    modified?: string | Date;
    x_mitre_version?: string | null;
    x_mitre_contents?: any[];
    [key: string]: any;
  };
  [key: string]: any;
}
