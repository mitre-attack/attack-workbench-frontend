import type { WorkflowStatusType } from 'src/app/utils/types';
import type { Composition, CompositionResolution } from './composition';
import type { ReleaseTrackConfig } from './config';
import {
  ReleaseTrackType,
  type ExportFormatType,
  type ReleasePreviewFormatType,
} from './enums';
import type { SnapshotSchedule } from './release-track';
import type { SnapshotCreationCause } from './snapshot-creation-cause';
import type { SnapshotCreationActor } from './snapshot-creation-actor';

export type StixObjectRef = string | { id: string; modified?: string };

export interface CreateReleaseTrackPayload {
  name: string;
  description?: string;
  snapshot_description?: string;
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
  /** URL-safe slug accepted wherever the track ID is; null clears it. */
  alias?: string | null;
}

export interface UpdateContentsPayload {
  x_mitre_contents: string[];
}

export type ReleasePayload = (
  | { increment: 'major' | 'minor'; version?: never }
  | { increment?: never; version: string }
  | { increment?: undefined; version?: undefined }
) & { description?: string };

export interface RetagReleasePayload {
  version: string;
}

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
  /** Workbench responses only; bundles reject it (they replay the sealed manifest). */
  include?: 'members' | 'staged' | 'candidates' | 'quarantine' | 'all';
  stixVersion?: '2.0' | '2.1';
}

export interface SnapshotHistoryOptions {
  tagged?: boolean;
  limit?: number;
  offset?: number;
}

export interface SnapshotContentStatistics {
  primary_count: number;
  secondary_count: number;
  relationship_count: number;
  supporting_count: number;
  link_target_count: number;
  total_count: number;
}

export interface SnapshotPublication {
  collection_id: string;
  created: string;
  created_by_ref: string;
  object_marking_refs: string[];
  attack_spec_version: string;
}

export interface PreviewRelationshipChange {
  object_ref: string;
  object_modified: string;
  relationship_type?: string;
  source_ref?: string;
  target_ref?: string;
  stale_endpoints?: ('source' | 'target')[];
}

export interface PreviewRelationshipChanges {
  selected_count: number;
  added_count: number;
  removed_count: number;
  unchanged_count: number;
  added: PreviewRelationshipChange[];
  removed: PreviewRelationshipChange[];
  stale_endpoints: PreviewRelationshipChange[];
}

export type ReleasePreviewOptions = ReleasePayload & {
  format?: ReleasePreviewFormatType;
};

export interface ReleasePreviewSummaryBase {
  track_id: string;
  type: ReleaseTrackType;
  source_snapshot_modified: string;
  release_snapshot_modified?: string;
  version: string;
  version_bounds: {
    lower: { version: string; modified: string } | null;
    upper: { version: string; modified: string } | null;
  };
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
  relationships?: PreviewRelationshipChanges;
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

export interface SnapshotBundleHashes {
  manifest_id: string;
  stix_2_0: string;
  stix_2_1: string;
}

export interface ReleaseTrackSnapshotHistoryItem {
  creation_cause?: SnapshotCreationCause;
  creation_actor?: SnapshotCreationActor;
  id?: string;
  modified?: string | Date;
  version?: string | null;
  /** Exact draft snapshot retained when a standard release was created. */
  release_source_modified?: string | Date;
  content_manifest_id?: string;
  publication?: SnapshotPublication;
  bundle_id?: string;
  bundle_hashes?: SnapshotBundleHashes;
  content_statistics?: SnapshotContentStatistics;
  snapshot_description?: string;
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
  statistics?: Record<string, any>;
  composition_resolution?: CompositionResolution | null;
  stix?: {
    id?: string;
    modified?: string | Date;
    x_mitre_version?: string | null;
    x_mitre_contents?: any[];
    [key: string]: any;
  };
  [key: string]: any;
}
