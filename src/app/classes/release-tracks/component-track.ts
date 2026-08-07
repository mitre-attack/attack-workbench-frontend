// -----------------------------------------------------------------------------
// Component Tracks
//
// Release track (standard or virtual) referenced by a virtual release track
// -----------------------------------------------------------------------------

import { ResolutionStrategyType } from './enums';

export interface ComponentTrackFilters {
  object_types?: string[];
  domains?: string[];
}

export interface ComponentTrack {
  track_id: string;
  resolution_strategy: ResolutionStrategyType;
  priority: number;
  version?: string | null;
  snapshot?: Date;
  filters?: ComponentTrackFilters;
}

export interface ComponentSnapshotResolution {
  track_id: string;
  track_name: string;
  track_type: string;
  resolved_snapshot_id: Date;
  resolved_version?: string | null;
  strategy_used: string;
  filters_applied?: ComponentTrackFilters;
  total_objects_in_source: number;
  objects_after_filter: number;
  objects_contributed: number;
}
