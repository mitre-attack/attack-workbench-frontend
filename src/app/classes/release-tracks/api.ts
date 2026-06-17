import type { WorkflowStatusType } from 'src/app/utils/types';
import type { Composition } from './composition';
import type { ReleaseTrackConfig } from './config';
import type { ExportFormatType, ReleaseTrackType } from './enums';
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

export interface UpdateContentsPayload {
  x_mitre_contents: string[];
}

export interface BumpPayload {
  type?: 'major' | 'minor';
  version?: string;
  dry_run?: boolean;
}

export interface ClonePayload {
  name?: string;
}

export interface ReviewPayload {
  from: WorkflowStatusType;
  to: WorkflowStatusType;
  object_refs?: StixObjectRef[];
}

export interface ReleaseTrackSnapshotOptions {
  format?: ExportFormatType;
  include?: 'members' | 'staged' | 'candidates' | 'all';
  releases?: 'only';
  version?: string;
  versions?: 'all';
  [key: string]: any;
}

export interface ReleaseTrackSnapshotHistoryItem {
  id?: string;
  modified?: string | Date;
  version?: string | null;
  created?: string | Date;
  tagged_at?: string | Date;
  snapshot_id?: string | Date;
  members?: any[];
  staged?: any[];
  candidates?: any[];
  contents?: {
    members?: any[];
    staged?: any[];
    candidates?: any[];
    [key: string]: any;
  };
  summary?: {
    members_count?: number;
    added_count?: number;
    modified_count?: number;
    promoted_count?: number;
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
