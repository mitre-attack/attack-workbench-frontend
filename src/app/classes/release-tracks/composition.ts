// -----------------------------------------------------------------------------
// Composition
//
// Rules and configuration that defines how a virtual release track
// aggregates content from component tracks
// -----------------------------------------------------------------------------

import { DeduplicationStrategyType, SnapshotTierType } from './enums';
import { ComponentTrack, ComponentSnapshotResolution } from './component-track';
import { WorkflowStatusType } from 'src/app/utils/types';

export interface Composition {
  component_tracks?: ComponentTrack[];
  deduplication?: {
    strategy?: DeduplicationStrategyType;
    // When resolving conflicts between versions, which snapshot tier should be
    // preferred (e.g., prefer from 'staged' over 'candidate' or vice-versa).
    tier_resolution?: SnapshotTierType;
    // When resolving conflicts, prefer the object with the highest workflow
    // status (e.g., 'reviewed' over 'awaiting-review').
    status_resolution?: WorkflowStatusType;
  };
}

export interface CompositionResolution {
  resolved_at?: Date;
  component_snapshots?: ComponentSnapshotResolution[];
  deduplication?: {
    total_objects_before?: number;
    total_objects_after?: number;
    duplicates_found?: number;
    conflicts_resolved?: any[];
  };
  summary?: any;
}
